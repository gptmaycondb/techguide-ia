#!/usr/bin/env python3
"""
TechGuide IA — Gerador de relatório de cobertura de códigos de erro

Detecta candidatos a código de erro nos PDFs (detector permissivo) e compara com
o error_codes_index.json commitado, gravando scripts/coverage_report.json.

O report inclui sha256 do índice usado — audit_index.py --fail-missing verifica
frescor e recusa o report se o índice tiver mudado desde a geração.

Uso:
  python3 scripts/coverage_report.py   # requer PDFs em /tmp (mesmo setup do reindex)

Para ignorar candidatos que são ruído:
  adicione em scripts/codes_ignore.json:
    { "<service_key>": { "<CÓDIGO>": "motivo" }, … }
"""

import hashlib
import json
import re
import sys
from pathlib import Path

# build_index.py tem guard if __name__ == '__main__' — import seguro (não chama main)
sys.path.insert(0, str(Path(__file__).parent))
from build_index import (
    PDF_SOURCES, pdf_to_text, clean_text,
    is_toc_chunk, is_book_index_chunk,
)

PROJECT_ROOT = Path(__file__).parent.parent
INDEX_PATH   = PROJECT_ROOT / 'assets' / 'error_codes_index.json'
REPORT_PATH  = Path(__file__).parent / 'coverage_report.json'
IGNORE_PATH  = Path(__file__).parent / 'codes_ignore.json'

# Keys que têm códigos de erro no índice (guia/parts não têm)
ERROR_KEYS = [
    'cpmd', 'service',
    'e62655_cpmd', 'e62655_service',
    'ricoh_imc3000_service', 'ricoh_mpc3004_service',
]

# Detectores permissivos por família
HP_FULL_RE     = re.compile(r'\b(\d{2}\.[0-9A-F]{1,2}\.[0-9A-F]{2})\b', re.IGNORECASE)
RICOH_FULL_RE  = re.compile(r'\bSC\s?(\d{3}-\d{2}|\d{5})\b', re.IGNORECASE)
RICOH_TABLE_RE = re.compile(r'^(\d{3}-\d{2})(?=[ \t])', re.MULTILINE)

# Padrões de orphans esperados (não gateiam)
PSEUDO_RE      = re.compile(r'^(PCU-YIELD|PM-PARTS|VIDA-UTIL)')
RICOH_GROUP_RE = re.compile(r'^SC\d{3}$')            # grupo sem subcódigo (SC681)
HP_PREFIX_RE   = re.compile(r'^\d{2}(\.[0-9A-F]{1,2})?$', re.IGNORECASE)  # 53 / 53.B0


def canon(code: str) -> str:
    """Forma canônica para matching — upper, remove separadores."""
    return re.sub(r'[\s.\-/]', '', code.upper())


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def toc_blocks(text: str, block: int = 600) -> set:
    """Retorna conjunto de índices de blocos classificados como ToC/índice remissivo."""
    out = set()
    for i in range(0, len(text), block):
        chunk = text[i:i + block]
        if is_toc_chunk(chunk) or is_book_index_chunk(chunk):
            out.add(i // block)
    return out


def in_toc(pos: int, tb: set, block: int = 600) -> bool:
    return (pos // block) in tb


def covered_canons(index: dict, service_key: str) -> set:
    """Formas canônicas de códigos já indexados para esta service_key."""
    return {canon(code) for code, ents in index.items()
            if any(e['key'] == service_key for e in ents)}


def is_expected_orphan(code: str) -> bool:
    """Orphan esperado: pseudo-código, grupo SC, prefixo HP, ou par duplo (SC285/SC285-00)."""
    return bool(PSEUDO_RE.match(code) or RICOH_GROUP_RE.match(code) or HP_PREFIX_RE.match(code))


def _ctx(text: str, pos: int, end: int) -> str:
    ls = text.rfind('\n', 0, pos) + 1
    le = text.find('\n', end)
    return text[ls:le if le >= 0 else len(text)].strip()[:200]


def extract_hp(text: str) -> dict:
    """
    Candidatos HP (XX.YY.ZZ completos).
    Descarta candidatos cujas ocorrências estão todas em blocos ToC/índice remissivo.
    """
    tb = toc_blocks(text)
    cands: dict = {}
    for m in HP_FULL_RE.finditer(text):
        code = m.group(1).upper()
        c = canon(code)
        if c not in cands:
            cands[c] = {'original': code, 'count': 0, 'context': '', 'toc_only': True}
        cands[c]['count'] += 1
        if not in_toc(m.start(), tb):
            cands[c]['toc_only'] = False
            if not cands[c]['context']:
                cands[c]['context'] = _ctx(text, m.start(), m.end())
    return {c: v for c, v in cands.items() if not v['toc_only']}


def extract_ricoh(text: str) -> dict:
    """
    Candidatos Ricoh: SC explicito (SC285-00, SC28500) e tabela sem prefixo (681-12).

    Tabela-only: exige ≥ 2 ocorrências OU descrição com letra maiúscula+minúscula
    na mesma linha para filtrar part-numbers e nº de página.
    """
    tb = toc_blocks(text)
    sc_exp: dict = {}  # encontrados via prefixo SC explícito
    table: dict  = {}  # encontrados na tabela sem prefixo SC

    for m in RICOH_FULL_RE.finditer(text):
        raw  = m.group(1)
        code = (f'SC{raw[:3]}-{raw[3:]}' if re.match(r'^\d{5}$', raw) else f'SC{raw}').upper()
        c    = canon(code)
        if c not in sc_exp:
            sc_exp[c] = {'original': code, 'count': 0, 'context': '', 'toc_only': True}
        sc_exp[c]['count'] += 1
        if not in_toc(m.start(), tb):
            sc_exp[c]['toc_only'] = False
            if not sc_exp[c]['context']:
                sc_exp[c]['context'] = _ctx(text, m.start(), m.end())

    for m in RICOH_TABLE_RE.finditer(text):
        raw  = m.group(1)
        code = f'SC{raw}'.upper()
        c    = canon(code)
        if c in sc_exp:
            continue  # já coberto pelo hit SC-explícito

        le        = text.find('\n', m.end())
        same_line = text[m.end():le if le >= 0 else m.end() + 200]
        has_desc  = bool(re.search(r'[A-Z][a-z]', same_line))

        if c not in table:
            table[c] = {'original': code, 'count': 0, 'context': '', 'toc_only': True, 'has_desc': False}
        table[c]['count'] += 1
        if has_desc:
            table[c]['has_desc'] = True
        if not in_toc(m.start(), tb):
            table[c]['toc_only'] = False
            if not table[c]['context'] and has_desc:
                table[c]['context'] = _ctx(text, m.start(), m.end())

    result: dict = {}
    for c, v in sc_exp.items():
        if not v['toc_only']:
            result[c] = {'original': v['original'], 'count': v['count'], 'context': v['context']}
    for c, v in table.items():
        if v['toc_only']:
            continue
        if not v['has_desc'] and v['count'] < 2:
            continue  # ruído: hit único sem descrição
        result[c] = {'original': v['original'], 'count': v['count'], 'context': v['context']}
    return result


def main() -> None:
    if not INDEX_PATH.exists():
        print(f'ERRO: {INDEX_PATH} não encontrado.', file=sys.stderr)
        sys.exit(1)

    index      = json.loads(INDEX_PATH.read_text(encoding='utf-8'))
    index_hash = sha256_file(INDEX_PATH)
    ignore     = json.loads(IGNORE_PATH.read_text(encoding='utf-8')) if IGNORE_PATH.exists() else {}

    per_key: dict = {}

    for svc in ERROR_KEYS:
        paths     = PDF_SOURCES.get(svc, [])
        available = [p for p in paths if p.exists()]
        if not available:
            print(f'  [skip] {svc}: PDFs não encontrados — {[str(p) for p in paths]}')
            continue

        print(f'  [{svc}] carregando {len(available)} PDF(s)…')
        text  = clean_text(''.join(pdf_to_text(p) for p in available))
        cov   = covered_canons(index, svc)
        ig    = {canon(k) for k in ignore.get(svc, {})}
        hp    = svc in ('cpmd', 'service', 'e62655_cpmd', 'e62655_service')
        cands = extract_hp(text) if hp else extract_ricoh(text)

        missing: list        = []
        missing_detail: dict = {}
        for c, info in sorted(cands.items()):
            if c in cov or c in ig:
                continue
            orig = info['original']
            missing.append(orig)
            missing_detail[orig] = {'count': info['count'], 'context': info['context']}

        orphans = sorted(
            code for code, ents in index.items()
            if any(e['key'] == svc for e in ents)
            and not is_expected_orphan(code)
            and canon(code) not in cands
        )

        per_key[svc] = {
            'candidates':     len(cands),
            'covered':        len(cands) - len(missing),
            'missing':        sorted(missing),
            'missing_detail': {k: missing_detail[k] for k in sorted(missing_detail)},
            'orphans':        orphans,
        }
        print(f'    cands={len(cands)} covered={len(cands)-len(missing)} '
              f'missing={len(missing)} orphans={len(orphans)}')

    report = {
        'index_sha256': index_hash,
        'per_key':      {k: per_key[k] for k in sorted(per_key)},
    }
    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True),
        encoding='utf-8',
    )
    print(f'\n✓ Relatório salvo: {REPORT_PATH}')


if __name__ == '__main__':
    print('TechGuide IA — Coverage Report')
    print('=' * 50)
    main()
