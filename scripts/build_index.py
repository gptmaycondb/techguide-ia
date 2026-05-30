#!/usr/bin/env python3
"""
TechGuide IA — Indexer v2
Gera search_index.json e error_codes_index.json de alta qualidade a partir dos PDFs.

Uso:
  python3 scripts/build_index.py

Requer: poppler-utils (pdftotext)
"""

import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

# ─── Caminhos ────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent

PDF_SOURCES = {
    'e52645_guia':           [PROJECT_ROOT / 'assets/manuals/guia_e52645.pdf'],
    'cpmd':                  [PROJECT_ROOT / 'assets/manuals/cpmd_2023.pdf'],
    'service':               [
        PROJECT_ROOT / 'assets/manuals/service_part1.pdf',
        PROJECT_ROOT / 'assets/manuals/service_part2.pdf',
        PROJECT_ROOT / 'assets/manuals/service_part3.pdf',
        PROJECT_ROOT / 'assets/manuals/service_part4.pdf',
    ],
    'ricoh_imc3000_guia':    [Path('/tmp/ricoh_guia.pdf')],
    'ricoh_imc3000_service': [Path('/tmp/ricoh_service.pdf')],
    'ricoh_imc3000_parts':   [Path('/tmp/ricoh_parts.pdf')],
}

OUT_SEARCH = PROJECT_ROOT / 'assets/search_index.json'
OUT_ERRORS = PROJECT_ROOT / 'assets/error_codes_index.json'

CHUNK_SIZE    = 2400   # chars por chunk
CHUNK_OVERLAP = 350    # chars de sobreposição entre chunks

# ─── Stopwords (espelho do search.js) ────────────────────────────────────────

STOPWORDS = {
    'de','da','do','das','dos','em','no','na','nos','nas','para','por','com',
    'que','um','uma','ao','aos','se','ou','mas','e','a','o','as','os','este',
    'esta','esse','essa','ele','ela','eles','elas','seu','sua','seus','suas',
    'nao','sim','ja','mais','bem','muito','pode','ser','ter','tem','foi','era',
    'como','quando','onde','qual','todo','toda','todos','cada','pelo','pela',
    'the','and','for','this','that','with','from','are','has','was','not','but',
    'have','been','will','can','its','they','their','more','also','when','into',
    'use','each','which','see','note','following','using','used','then','after',
    'before','during','press','select','open','close','make','sure','you','your',
    'all','any','new','page','figure','table','step','section','chapter',
    'product','information','available','provides','refer',
    'the','and','in','is','it','be','to','of','a','at','on','by','an',
}

# ─── Extração de texto ────────────────────────────────────────────────────────

def pdf_to_text(path: Path) -> str:
    """Extrai texto de um PDF usando pdftotext."""
    if not path.exists():
        print(f'  AVISO: {path} não encontrado — pulando', file=sys.stderr)
        return ''
    result = subprocess.run(
        ['pdftotext', '-enc', 'UTF-8', str(path), '-'],
        capture_output=True
    )
    return result.stdout.decode('utf-8', errors='replace')


def extract_texts(key: str) -> str:
    """Concatena texto de todos os PDFs de uma index key."""
    paths = PDF_SOURCES.get(key, [])
    parts = []
    for p in paths:
        print(f'  Lendo {p.name}…')
        t = pdf_to_text(p)
        if t:
            parts.append(t)
    return '\n\n'.join(parts)

# ─── Limpeza de texto ─────────────────────────────────────────────────────────

TOC_PATTERN = re.compile(r'\.{4,}')   # linhas de sumário com muitos pontos

def is_toc_line(line: str) -> bool:
    """Detecta linha de sumário (ex: 'Fuser ............... 37')."""
    dots = line.count('.')
    return dots > 5 and dots / max(len(line), 1) > 0.25

def clean_text(text: str) -> str:
    """Remove linhas de sumário e normaliza espaços."""
    lines = text.splitlines()
    cleaned = []
    for line in lines:
        if is_toc_line(line):
            continue
        cleaned.append(line)
    text = '\n'.join(cleaned)
    text = re.sub(r'[ \t]{2,}', ' ', text)        # múltiplos espaços → um
    text = re.sub(r'\n{4,}', '\n\n\n', text)       # máximo 3 quebras seguidas
    return text.strip()

# ─── Chunking inteligente ─────────────────────────────────────────────────────

def smart_chunk(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Divide o texto em chunks respeitando parágrafos.
    Chunks são delimitados por linhas em branco; nunca corta no meio de um parágrafo
    a menos que o parágrafo seja maior que o chunk_size.
    """
    # Separa em parágrafos
    paragraphs = re.split(r'\n\n+', text)
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    chunks = []
    buf = []
    buf_len = 0

    for para in paragraphs:
        # Parágrafo muito grande: dividir na fronteira de frase
        if len(para) > size:
            sentences = re.split(r'(?<=[.!?])\s+', para)
            for sent in sentences:
                if buf_len + len(sent) > size and buf:
                    chunks.append('\n\n'.join(buf))
                    # Overlap: manter últimos parágrafos até 'overlap' chars
                    overlap_buf, overlap_len = [], 0
                    for b in reversed(buf):
                        if overlap_len + len(b) > overlap:
                            break
                        overlap_buf.insert(0, b)
                        overlap_len += len(b)
                    buf = overlap_buf
                    buf_len = overlap_len
                buf.append(sent)
                buf_len += len(sent)
        else:
            if buf_len + len(para) > size and buf:
                chunks.append('\n\n'.join(buf))
                overlap_buf, overlap_len = [], 0
                for b in reversed(buf):
                    if overlap_len + len(b) > overlap:
                        break
                    overlap_buf.insert(0, b)
                    overlap_len += len(b)
                buf = overlap_buf
                buf_len = overlap_len
            buf.append(para)
            buf_len += len(para)

    if buf:
        chunks.append('\n\n'.join(buf))

    return [c for c in chunks if len(c) >= 80]

# ─── Extração de keywords ─────────────────────────────────────────────────────

# Termos que são sempre keywords mesmo sendo curtos
ALWAYS_KW = re.compile(
    r'\b(SC\d{3,6}|'
    r'\d{2}\.\d{2}(?:\.\d{2}(?:\.\d{2})?)?|'   # HP error codes
    r'[A-Z]{1,3}\d{3,}[A-Z]?(?:-\d+(?:CN)?)?|'  # Part numbers
    r'PCU|PCDU|ITB|ADF|EWS|BICU|PSU|FRU|'
    r'E52645|E52545|M527|M528|M506|M507|M501|'
    r'IM.C3[0-9]00|IM.C[0-9]000|D0B[A-Z])\b'
)

def extract_keywords(text: str) -> str:
    """
    Extrai keywords densas: frequência de palavras + termos especiais + bigramas.
    """
    text_lower = text.lower()

    # Tokens normais (min 3 chars, sem stopwords)
    words = re.findall(r'[a-záéíóúâêîôûãõçàèìòùä-ÿa-z][a-záéíóúâêîôûãõçàèìòùä-ÿa-z0-9]{2,}', text_lower)
    freq: dict[str, int] = {}
    for w in words:
        if w not in STOPWORDS:
            freq[w] = freq.get(w, 0) + 1

    # Top-60 por frequência
    top = sorted(freq, key=lambda x: -freq[x])[:60]

    # Termos especiais (sempre incluir)
    specials = [m.lower() for m in ALWAYS_KW.findall(text)]

    # Bigramas dos top-40 tokens
    top_set = set(top[:40])
    top_seq = [w for w in words if w in top_set]
    bigrams = []
    for i in range(len(top_seq) - 1):
        a, b = top_seq[i], top_seq[i + 1]
        if len(a) > 3 and len(b) > 3:
            bigrams.append(f'{a}+{b}')

    all_kw = list(dict.fromkeys(top + specials + bigrams[:30]))
    return ' '.join(all_kw)

# ─── Construção do search_index ───────────────────────────────────────────────

def build_search_index() -> dict:
    index = {}
    for key in PDF_SOURCES:
        print(f'\n[search] {key}')
        text = extract_texts(key)
        if not text:
            index[key] = []
            continue
        text = clean_text(text)
        chunks = smart_chunk(text)
        print(f'  → {len(chunks)} chunks')
        entries = []
        for chunk in chunks:
            kw = extract_keywords(chunk)
            entries.append({'t': chunk, 'k': kw})
        index[key] = entries
    return index

# ─── Extração de error codes — HP ────────────────────────────────────────────

# Regex que reconhece início de seção de erro HP
# Exemplos: "49.XX.YY", "50.WX.YZ", "13.02.00", "13.B9"
HP_CODE_RE = re.compile(
    r'(?:^|\n)('
    r'(?:\d{2}\.(?:[0-9A-Z]{1,2}\.){1,2}[0-9A-Z]{2})'   # XX.YY.ZZ
    r'|(?:\d{2}\.[0-9A-Z]{2})'                            # XX.YY
    r')\s+(?:error|Error|jam|Jam|fault|Fault|[A-Z][a-z])',
    re.MULTILINE
)

def extract_hp_error_sections(text: str, source_key: str) -> dict:
    """
    Extrai seções de erro HP do CPMD e service manual.
    Retorna dict: código → lista de dicts {key, text}
    """
    results = defaultdict(list)

    # Encontra todas as posições de início de seção de erro
    matches = list(HP_CODE_RE.finditer(text))

    for i, m in enumerate(matches):
        code = m.group(1).strip()
        start = m.start()
        # Pega até o próximo código ou 2500 chars
        end = matches[i + 1].start() if i + 1 < len(matches) else start + 2500
        end = min(end, start + 2500)
        section = text[start:end].strip()

        if len(section) < 80:
            continue

        entry = {'key': source_key, 'text': section}

        # Indexar pelo código exato
        results[code].append(entry)

        # Indexar também por prefixos: "49.38.07" → "49.38" e "49"
        parts = code.split('.')
        if len(parts) >= 3:
            results['.'.join(parts[:2])].append(entry)
        if len(parts) >= 2:
            results[parts[0]].append(entry)

    return results


def is_toc_chunk(text: str) -> bool:
    """Detecta se o texto é majoritariamente sumário (ToC)."""
    # Conta linhas com "... N" (referências de página)
    lines = text.split('\n')
    toc_lines = sum(1 for l in lines if re.search(r'\.{3,}\s*\d+', l))
    if len(lines) > 0 and toc_lines / len(lines) > 0.3:
        return True
    # Conta proporção de pontos consecutivos
    dot_runs = len(re.findall(r'\.{4,}', text))
    if dot_runs > 3:
        return True
    return False


def extract_hp_error_type_table(text: str) -> dict:
    """
    Extrai a tabela de tipos de erro HP (XX.WX.YZ Categoria Descrição).
    Usada para códigos que não têm seção própria no CPMD (ex.: 82.WX.YZ).
    """
    results = defaultdict(list)

    # Padrão: "XX.WX.YZ Categoria Descrição. YY.WX.YZ..."
    # Encontra a tabela de tipos de erro
    table_match = re.search(
        r'(\d{2}\.\w{2}\.\w{2}\s+\w+\s+\w[^\n]{20,}(?:\n\d{2}\.\w{2}\.\w{2}[^\n]+)+)',
        text
    )
    if not table_match:
        return results

    table_text = table_match.group(0)

    # Extrai cada entrada da tabela
    entries_re = re.compile(
        r'(\d{2})\.\w{2}\.\w{2}\s+(\w[^\n.]+?)(?=\s+\d{2}\.\w{2}\.\w{2}|\Z)',
        re.DOTALL
    )
    for m in entries_re.finditer(table_text):
        prefix = m.group(1)
        description = m.group(0).strip()[:400]
        if len(description) > 40 and not is_toc_chunk(description):
            entry = {'key': 'cpmd', 'text': description}
            results[prefix].append(entry)

    return results


def extract_hp_errors_from_cpmd(text: str) -> dict:
    """
    Parser específico para o CPMD HP.
    Suporta:
    - Códigos no início de linha: "49.38.07\nDescription..."
    - Códigos no meio de frase: "...text. 50.1X.YZ Fuser Error Low..."
    - Múltiplos códigos: "82.73.46, 82.73.47\nDescription..."
    """
    results = defaultdict(list)

    # Padrão que captura a PRIMEIRA linha com um ou mais códigos HP
    # Suporta "XX.YY.ZZ", "XX.YY.ZZ, XX.YY.ZZ", "XX.YY.ZZ or XX.YY.ZZ"
    CODE = r'\d{2}(?:\.[0-9A-Z*]{2,3})+'
    MULTI_CODE = rf'({CODE}(?:(?:,\s*|\s+or\s+){CODE})*)'
    SECTION_START = re.compile(
        rf'(?:^|(?<=\n)|(?<=\. ))({CODE}(?:(?:,\s*|\s+or\s+){CODE})*)'
        rf'(?:\s+(?!error messages|errors|\*))',
        re.MULTILINE
    )

    matches = list(SECTION_START.finditer(text))
    for i, m in enumerate(matches):
        raw_codes_str = m.group(1)
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else start + 3000
        end = min(end, start + 3000)
        section = text[start:end].strip()

        if is_toc_chunk(section) or len(section) < 80:
            continue

        # Extrair todos os códigos desta entrada (ex.: "82.73.46, 82.73.47")
        individual_codes = re.findall(rf'{CODE.replace(r"+", r"{1,3}")}', raw_codes_str)
        if not individual_codes:
            individual_codes = [raw_codes_str.split(',')[0].strip()]

        entry = {'key': 'cpmd', 'text': section}

        for code in individual_codes:
            code = code.strip()
            results[code].append(entry)
            parts = code.split('.')
            if len(parts) >= 3:
                results['.'.join(parts[:2])].append(entry)
            if len(parts) >= 2:
                results[parts[0]].append(entry)

    return results

# ─── Extração de error codes — Ricoh SC ──────────────────────────────────────

# SC codes no service manual aparecem como "SC20200" no início de uma linha
RICOH_SC_RE = re.compile(
    r'(?:^|\n)(SC(\d{3})(\d{2}))\s*\n',   # SC20200 → SC202, sufixo 00
    re.MULTILINE
)

def extract_ricoh_sc_sections(text: str) -> dict:
    """
    Extrai seções SC do service manual Ricoh.
    Indexa por: SC20200 (código completo), SC202 (grupo), SC202-00 (formato com hífen).
    """
    results = defaultdict(list)

    matches = list(RICOH_SC_RE.finditer(text))

    for i, m in enumerate(matches):
        full   = m.group(1)            # SC20200
        group  = 'SC' + m.group(2)    # SC202
        suffix = m.group(3)           # 00
        hyphen = f'{group}-{suffix}'  # SC202-00

        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else start + 3000
        end = min(end, start + 3000)
        section = text[start:end].strip()

        if len(section) < 60:
            continue

        # Limpar artefatos de coluna (múltiplos espaços)
        section = re.sub(r'[ \t]{3,}', '  ', section)

        entry = {'key': 'ricoh_imc3000_service', 'text': section}

        results[full].append(entry)      # SC20200
        results[hyphen].append(entry)   # SC202-00
        # Só adicionar ao grupo se ainda não tiver (primeiro representa o grupo)
        if not results[group]:
            results[group].append(entry)

    return results

def extract_ricoh_sc_groups(text: str) -> dict:
    """
    Extrai descrições de grupos SC do Ricoh (SC100, SC200, SC300, etc.)
    que representam categorias de erro (não têm código de 5 dígitos).
    """
    results = defaultdict(list)

    SC_GROUPS = {
        'SC100': 'Engine: Scanning',
        'SC200': 'Engine: Image Writing',
        'SC300': 'Engine: Charge, Development',
        'SC400': 'Engine: Around the Drum',
        'SC500': 'Engine: Fusing',
        'SC600': 'Engine: Communication and Others',
        'SC700': 'Engine: Peripherals',
        'SC800': 'Controller',
        'SC900': 'Engine: Others',
    }

    other_keys = '|'.join(k for k in SC_GROUPS)

    for group, category in SC_GROUPS.items():
        # Procurar seção do grupo fora do ToC (segunda ocorrência = conteúdo real)
        pattern = re.compile(
            rf'{group}\s*\({re.escape(category)}\)(.*?)(?={other_keys}|\Z)',
            re.DOTALL
        )
        best_section = None
        for m in pattern.finditer(text):
            candidate = f'{group} ({category}){m.group(1)[:2000]}'.strip()
            if not is_toc_chunk(candidate) and len(candidate) > 100:
                best_section = candidate
                break   # usar a primeira ocorrência fora do ToC

        if best_section:
            results[group].append({'key': 'ricoh_imc3000_service', 'text': best_section})
        else:
            # Fallback: criar entrada descritiva com grupo + exemplos de códigos
            prefix_num = group[2:]  # '400' de 'SC400'
            # Coletar alguns códigos específicos deste grupo do texto
            sub_codes = re.findall(rf'SC{prefix_num}\d{{2,3}}\b', text)
            sub_codes = list(dict.fromkeys(sub_codes))[:8]   # primeiros 8 únicos
            desc = (
                f'{group} — {category}\n\n'
                f'Grupo de erros Ricoh IM C3000/C3500.\n'
                f'Códigos específicos neste grupo: {", ".join(sub_codes) if sub_codes else "consulte o service manual"}.\n'
                f'Consulte o código completo (ex.: {sub_codes[0] if sub_codes else group + "xx"}) '
                f'para diagnóstico e solução detalhados.'
            )
            results[group].append({'key': 'ricoh_imc3000_service', 'text': desc})

    return results


# ─── Construção do error_codes_index ─────────────────────────────────────────

def build_error_codes_index() -> dict:
    index = defaultdict(list)

    # ── HP CPMD ──────────────────────────────────────────────────────────────
    print('\n[errors] HP CPMD')
    cpmd_paths = PDF_SOURCES['cpmd']
    cpmd_text = ''
    for p in cpmd_paths:
        cpmd_text += pdf_to_text(p)
    cpmd_text = clean_text(cpmd_text)

    # Parser dedicado para o CPMD
    cpmd_errors = extract_hp_errors_from_cpmd(cpmd_text)
    # Também tentar o parser genérico
    generic_cpmd = extract_hp_error_sections(cpmd_text, 'cpmd')
    for code, entries in cpmd_errors.items():
        for e in entries:
            if e not in index[code]:
                index[code].append(e)
    for code, entries in generic_cpmd.items():
        for e in entries:
            if not any(x['key'] == 'cpmd' and x['text'] == e['text'] for x in index[code]):
                index[code].append(e)
    print(f'  → {len(cpmd_errors)} códigos do CPMD')

    # ── HP Service Manual ─────────────────────────────────────────────────────
    print('[errors] HP Service Manual')
    svc_text = ''
    for p in PDF_SOURCES['service']:
        t = pdf_to_text(p)
        if t:
            svc_text += t
    svc_text = clean_text(svc_text)
    # Usar o mesmo parser aprimorado com suporte a vírgulas e inline codes
    svc_cpmd_style = extract_hp_errors_from_cpmd(svc_text)
    # Rekey as 'service' em vez de 'cpmd'
    svc_errors = defaultdict(list)
    for code, entries in svc_cpmd_style.items():
        for e in entries:
            svc_errors[code].append({'key': 'service', 'text': e['text']})
    for code, entries in svc_errors.items():
        for e in entries:
            if not any(x['key'] == 'service' and x['text'] == e['text'] for x in index[code]):
                index[code].append(e)
    print(f'  → {len(svc_errors)} códigos do service')

    # ── Ricoh Service Manual ──────────────────────────────────────────────────
    print('[errors] Ricoh Service Manual')
    ricoh_svc_path = PDF_SOURCES['ricoh_imc3000_service'][0]
    ricoh_svc_text = pdf_to_text(ricoh_svc_path)
    ricoh_svc_text = clean_text(ricoh_svc_text)
    ricoh_errors = extract_ricoh_sc_sections(ricoh_svc_text)
    sc_groups = extract_ricoh_sc_groups(ricoh_svc_text)
    for src in [ricoh_errors, sc_groups]:
        for code, entries in src.items():
            for e in entries:
                if not any(x['key'] == 'ricoh_imc3000_service' and x['text'] == e['text'] for x in index[code]):
                    index[code].append(e)
    unique_sc = len([k for k in ricoh_errors if k.startswith('SC') and '-' not in k and len(k) == 8])
    print(f'  → {unique_sc} SC codes completos + {len(sc_groups)} grupos do service Ricoh')

    # ── Ricoh Parts (Product Support Guide) ───────────────────────────────────
    print('[errors] Ricoh Parts')
    parts_path = PDF_SOURCES['ricoh_imc3000_parts'][0]
    parts_text = pdf_to_text(parts_path)
    parts_text = clean_text(parts_text)
    # O parts guide não tem SC codes mas tem info de yield — indexar como 'PARTS'
    # Adicionar um entry especial para "PCU" e "yield" queries
    if len(parts_text) > 200:
        # Extrair seção de PM Parts (vida útil)
        pm_match = re.search(r'PM Parts.*?(?=\n\n\n|\Z)', parts_text, re.DOTALL)
        if pm_match:
            pm_text = pm_match.group(0)[:3000]
            entry = {'key': 'ricoh_imc3000_parts', 'text': pm_text}
            for pseudo_code in ['PCU-YIELD', 'PM-PARTS', 'VIDA-UTIL']:
                index[pseudo_code].append(entry)

    return dict(index)

# ─── Dedup e limpeza final ────────────────────────────────────────────────────

def dedup_entries(entries: list) -> list:
    """Remove entradas duplicadas preservando ordem."""
    seen = set()
    result = []
    for e in entries:
        sig = (e['key'], e['text'][:100])
        if sig not in seen:
            seen.add(sig)
            result.append(e)
    return result


def finalize_error_index(raw: dict) -> dict:
    """
    Pós-processa o índice de erros:
    - Remove duplicatas
    - Limita a 5 entradas por código
    - Ordena: entradas com texto mais longo (mais contexto) primeiro
    """
    final = {}
    for code, entries in raw.items():
        entries = dedup_entries(entries)
        # Preferir entradas com mais contexto real (mais longa)
        entries.sort(key=lambda x: -len(x['text']))
        final[code] = entries[:5]
    return final

# ─── Validação de qualidade ───────────────────────────────────────────────────

def validate(search_idx: dict, error_idx: dict):
    print('\n=== VALIDAÇÃO ===')

    # Search index
    for key, chunks in search_idx.items():
        avg_t = sum(len(c['t']) for c in chunks) / max(len(chunks), 1)
        avg_k = sum(len(c['k']) for c in chunks) / max(len(chunks), 1)
        print(f'  {key}: {len(chunks)} chunks | avg_text={avg_t:.0f} avg_kw={avg_k:.0f}')

    print()

    # Error index — verificar codes críticos
    critical_hp = ['49', '50', '59', '82', '13.B9', '13.B2', '13.02', '10.00.60']
    critical_ricoh = ['SC202', 'SC543', 'SC400', 'SC300', 'SC312']

    print('  HP errors:')
    for c in critical_hp:
        if c in error_idx:
            e = error_idx[c][0]
            print(f'    {c} ✓ key={e["key"]} len={len(e["text"])} preview: {e["text"][:80]!r}')
        else:
            print(f'    {c} ✗ AUSENTE')

    print('  Ricoh SC:')
    for c in critical_ricoh:
        if c in error_idx:
            e = error_idx[c][0]
            print(f'    {c} ✓ key={e["key"]} len={len(e["text"])} preview: {e["text"][:80]!r}')
        else:
            print(f'    {c} ✗ AUSENTE')

    print(f'\n  Total de códigos: {len(error_idx)}')

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print('TechGuide IA — Indexer v2')
    print('=' * 50)

    # 1. Build search index
    print('\n── Construindo search_index.json ──')
    search_idx = build_search_index()

    print(f'\nSalvando {OUT_SEARCH}…')
    with open(OUT_SEARCH, 'w', encoding='utf-8') as f:
        json.dump(search_idx, f, ensure_ascii=False, separators=(',', ':'))
    size_mb = OUT_SEARCH.stat().st_size / 1024 / 1024
    print(f'  → {size_mb:.1f} MB')

    # 2. Build error codes index
    print('\n── Construindo error_codes_index.json ──')
    raw_errors = build_error_codes_index()
    error_idx = finalize_error_index(raw_errors)

    print(f'\nSalvando {OUT_ERRORS}…')
    with open(OUT_ERRORS, 'w', encoding='utf-8') as f:
        json.dump(error_idx, f, ensure_ascii=False, separators=(',', ':'))
    size_kb = OUT_ERRORS.stat().st_size / 1024
    print(f'  → {size_kb:.0f} KB')

    # 3. Validate
    validate(search_idx, error_idx)

    print('\n✓ Indexação concluída!')


if __name__ == '__main__':
    main()
