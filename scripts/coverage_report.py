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
    PDF_SOURCES, pdf_to_text, pdf_to_text_raw, clean_text,
    is_toc_chunk, is_book_index_chunk,
    extract_sp3710_service_call_text, extract_mp2555_sc_sections,
    MP2555_SERVICE_KEY,
)

PROJECT_ROOT = Path(__file__).parent.parent
INDEX_PATH   = PROJECT_ROOT / 'assets' / 'error_codes_index.json'
REPORT_PATH  = Path(__file__).parent / 'coverage_report.json'
IGNORE_PATH  = Path(__file__).parent / 'codes_ignore.json'

# Keys que têm códigos de erro no índice (guia/parts não têm)
ERROR_KEYS = [
    'cpmd', 'service',
    'e62655_cpmd', 'e62655_service',
    'hp_e826_cpmd',
    'ricoh_imc3000_service', 'ricoh_mpc3004_service', 'ricoh_sp3710_service',
    'ricoh_mp2555_service',
]

# Grupos de equivalência por modelo — espelham os searchKeys de src/data.js.
# searchErrorCode() aceita array → um código é "findable" se estiver sob QUALQUER
# key do grupo. O relatório per_key é granular; per_model dá a visão do usuário.
MODEL_SEARCHKEYS: dict[str, list[str]] = {
    'E52645':   ['cpmd', 'service'],            # e52645_guia não tem error codes
    'E62655':   ['e62655_cpmd', 'e62655_service'],
    'E826':     ['hp_e826_cpmd'],
    'imc3000':  ['ricoh_imc3000_service'],
    'mpc3004':  ['ricoh_mpc3004_service'],
    'sp3710':   ['ricoh_sp3710_service'],
    'mp2555':   ['ricoh_mp2555_service'],
}

# Detectores permissivos por família
# [0-9A-FO] inclui letra O maiúscula — OCR comum confunde 0 com O em fontes de manual HP.
# O código extraído é normalizado (O→0) antes do canon para casar com a chave do índice.
HP_FULL_RE     = re.compile(r'\b(\d{2}\.[0-9A-FO]{1,2}\.[0-9A-FO]{2})\b', re.IGNORECASE)
RICOH_FULL_RE  = re.compile(r'\bSC\s?(\d{3}-\d{2}|\d{5})\b', re.IGNORECASE)
RICOH_TABLE_RE    = re.compile(r'^(\d{3}-\d{2})(?=[ \t])', re.MULTILINE)
# Mirrors RICOH_CONDITION_ROW_RE in build_index.py: code on its own line, description on next.
# Covers SC681/682 subcodes and SC215/SC533 that appear as "681-01\n\nToner bottle…"
RICOH_TABLE_NL_RE = re.compile(r'(?:^|\n)(\d{3}-\d{2})\s*\n+\s*([A-Z][^\n]{7,})', re.MULTILINE)
SP3710_SC_RE = re.compile(r'(?m)^SC\s?(\d{3}(?:-\d{2})?)\s+(?:[A-D]\b|$)')
SP3710_SERVICE_KEY = 'ricoh_sp3710_service'

# Padrões de orphans esperados (não gateiam)
PSEUDO_RE      = re.compile(r'^(PCU-YIELD|PM-PARTS|VIDA-UTIL)')
RICOH_GROUP_RE = re.compile(r'^SC\d{3}$')            # grupo sem subcódigo (SC681)
HP_PREFIX_RE   = re.compile(r'^\d{2}(\.[0-9A-F]{1,2})?$', re.IGNORECASE)  # 53 / 53.B0
# HP partial wildcard codes: 50.2X, 82.0X, 33.05.0X, 13.B2.DX etc. — prefix matchers, never literal in PDF
HP_WILDCARD_RE = re.compile(r'[WXYZ]', re.IGNORECASE)


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


def is_expected_orphan(code: str, service_key: str = '') -> bool:
    """Orphan esperado: pseudo-código, grupo SC, prefixo HP, ou código HP com wildcard."""
    if PSEUDO_RE.match(code) or HP_PREFIX_RE.match(code):
        return True
    if RICOH_GROUP_RE.match(code) and service_key != SP3710_SERVICE_KEY:
        return True
    # HP partial/wildcard entries (50.2X, 82.0X, 33.05.0X, 13.B2.DX, 41.03.FZ …)
    # are prefix-matchers in searchErrorCode, not codes that literally appear in PDFs.
    if re.match(r'^\d', code) and HP_WILDCARD_RE.search(code):
        return True
    return False


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
        code = m.group(1).upper().replace('O', '0')  # O→0: OCR artifact normalization
        c = canon(code)
        if c not in cands:
            cands[c] = {'original': code, 'count': 0, 'context': '', 'toc_only': True}
        cands[c]['count'] += 1
        if not in_toc(m.start(), tb):
            cands[c]['toc_only'] = False
            if not cands[c]['context']:
                cands[c]['context'] = _ctx(text, m.start(), m.end())
        else:
            # TOC block: bypass discard if description text follows within 200 chars.
            local_ctx = text[m.end(): min(len(text), m.end() + 200)]
            if re.search(r'[a-z]{4,}', local_ctx):
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
        else:
            # TOC block: bypass discard if description text follows within 200 chars.
            # Covers: "SC914-00  External controller error" (same line) and
            # "SC914-00\n\nExternal controller error" (next line).
            local_ctx = text[m.end(): min(len(text), m.end() + 200)]
            if re.search(r'[a-z]{4,}', local_ctx):
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

    for m in RICOH_TABLE_NL_RE.finditer(text):
        raw  = m.group(1)
        desc = m.group(2)
        code = f'SC{raw}'.upper()
        c    = canon(code)
        if c in sc_exp or c in table:
            continue  # já coberto por forma SC-explícita ou tabela same-line

        # Next-line descriptions: use [a-z]{2,} (covers acronyms like "FCU error")
        has_desc = bool(re.search(r'[a-z]{2,}', desc))
        if c not in table:
            table[c] = {'original': code, 'count': 0, 'context': '', 'toc_only': True, 'has_desc': False}
        table[c]['count'] += 1
        if has_desc:
            table[c]['has_desc'] = True
        if not in_toc(m.start(), tb):
            table[c]['toc_only'] = False
            if not table[c]['context'] and has_desc:
                table[c]['context'] = _ctx(text, m.start(), m.end())
        elif has_desc:
            # Description on next line: bypass TOC discard — real table entry
            table[c]['toc_only'] = False
            if not table[c]['context']:
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


def extract_sp3710(text: str) -> dict:
    """Candidates for SP 3710 where SC### is a full service-call code."""
    section = extract_sp3710_service_call_text(text)
    result: dict = {}
    for m in SP3710_SC_RE.finditer(section):
        code = ('SC' + m.group(1).replace(' ', '')).upper()
        c = canon(code)
        if c not in result:
            result[c] = {'original': code, 'count': 0, 'context': '', 'toc_only': False}
        result[c]['count'] += 1
        if not result[c]['context']:
            result[c]['context'] = _ctx(section, m.start(), m.end())
    return result


def main() -> None:
    if not INDEX_PATH.exists():
        print(f'ERRO: {INDEX_PATH} não encontrado.', file=sys.stderr)
        sys.exit(1)

    index      = json.loads(INDEX_PATH.read_text(encoding='utf-8'))
    index_hash = sha256_file(INDEX_PATH)
    ignore     = json.loads(IGNORE_PATH.read_text(encoding='utf-8')) if IGNORE_PATH.exists() else {}

    # Pré-check: falha imediata se qualquer PDF estiver ausente.
    # Skip silencioso resultaria em candidatos=0 para aquela key → interseção com
    # vazio no --shrink-baseline → dívida some do baseline sem ter sido paga.
    missing_pdfs = [
        (svc, PDF_SOURCES.get(svc, []))
        for svc in ERROR_KEYS
        if not any(p.exists() for p in PDF_SOURCES.get(svc, []))
    ]
    if missing_pdfs:
        for svc, paths in missing_pdfs:
            print(f'❌ {svc}: PDFs não encontrados — {[str(p) for p in paths]}', file=sys.stderr)
        print('   Providencie todos os PDFs antes de rodar coverage_report.py.', file=sys.stderr)
        sys.exit(1)

    per_key: dict = {}
    raw_cands_by_key: dict = {}  # cands dict por key (para per_model, não vai pro JSON)

    for svc in ERROR_KEYS:
        paths     = PDF_SOURCES.get(svc, [])
        available = [p for p in paths if p.exists()]

        print(f'  [{svc}] carregando {len(available)} PDF(s)…')
        text  = clean_text(''.join(pdf_to_text(p) for p in available))
        cov   = covered_canons(index, svc)
        ig    = {canon(k) for k in ignore.get(svc, {})}
        hp    = svc in ('cpmd', 'service', 'e62655_cpmd', 'e62655_service', 'hp_e826_cpmd')
        if svc == MP2555_SERVICE_KEY:
            extracted = extract_mp2555_sc_sections(
                ''.join(pdf_to_text_raw(p) for p in available),
                MP2555_SERVICE_KEY,
            )
            cands = {
                canon(code): {
                    'original': code,
                    'count': 1,
                    'context': entries[0]['text'][:300],
                    'toc_only': False,
                }
                for code, entries in extracted.items()
            }
        elif hp:
            cands = extract_hp(text)
        elif svc == SP3710_SERVICE_KEY:
            cands = extract_sp3710(text)
        else:
            cands = extract_ricoh(text)
        raw_cands_by_key[svc] = cands

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
            and not is_expected_orphan(code, svc)
            and canon(code) not in cands
            and not all(e.get('src') in ('propagated', 'xref', 'range', 'stub')
                        for e in ents if e['key'] == svc)
        )

        # Candidatos cobertos via entrada sintética (src=propagated/xref) — informativo.
        # Cobertura real = covered − covered_by_synthetic. Cobertura sintética não
        # substitui extração direta do PDF.
        # Build canon→index_key map for fast lookup
        canon_to_key = {}
        for idx_key, ents in index.items():
            if any(e['key'] == svc for e in ents):
                canon_to_key.setdefault(canon(idx_key), idx_key)
        covered_by_synthetic = sum(
            1 for c in cands
            if c in cov
            and c in canon_to_key
            and all(e.get('src') in ('propagated', 'xref')
                    for e in index[canon_to_key[c]] if e['key'] == svc)
        )

        per_key[svc] = {
            'candidates':          len(cands),
            'covered':             len(cands) - len(missing),
            'covered_by_synthetic': covered_by_synthetic,
            'missing':             sorted(missing),
            'missing_detail':      {k: missing_detail[k] for k in sorted(missing_detail)},
            'orphans':             orphans,
        }
        print(f'    cands={len(cands)} covered={len(cands)-len(missing)} '
              f'(synth={covered_by_synthetic}) missing={len(missing)} orphans={len(orphans)}')

    # ── Visão per_model ───────────────────────────────────────────────────────
    # Espelha MODEL_SEARCHKEYS (= searchKeys do data.js): um candidato é "covered"
    # se estiver no índice sob QUALQUER key do modelo — mesma semântica de
    # searchErrorCode(q, searchKeys[]).
    per_model: dict = {}
    for model, keys in MODEL_SEARCHKEYS.items():
        available_keys = [k for k in keys if k in raw_cands_by_key]
        if not available_keys:
            continue
        model_cands: dict = {}
        for k in available_keys:
            model_cands.update(raw_cands_by_key[k])
        model_cov: set = set()
        for k in keys:
            model_cov |= covered_canons(index, k)
        model_ig: set = set()
        for k in keys:
            model_ig |= {canon(c) for c in ignore.get(k, {})}
        model_missing = sorted(
            info['original'] for c, info in sorted(model_cands.items())
            if c not in model_cov and c not in model_ig
        )
        per_model[model] = {
            'keys':       keys,
            'candidates': len(model_cands),
            'covered':    len(model_cands) - len(model_missing),
            'missing':    model_missing,
        }

    report = {
        'index_sha256': index_hash,
        'per_key':      {k: per_key[k] for k in sorted(per_key)},
        'per_model':    per_model,
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
