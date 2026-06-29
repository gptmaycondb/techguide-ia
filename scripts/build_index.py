#!/usr/bin/env python3
"""
TechGuide IA — Indexer v2
Gera search_index.json e error_codes_index.json de alta qualidade a partir dos PDFs.

Uso:
  python3 scripts/build_index.py               # indexa PDFs (padrão)
  python3 scripts/build_index.py --embeddings  # gera embeddings_index.json (requer sentence-transformers)

Requer: poppler-utils (pdftotext)
Para --embeddings: pip install sentence-transformers
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
    'ricoh_mpc3004_guia':    [Path('/tmp/ricoh_mpc3004_guia.pdf')],
    'ricoh_mpc3004_service': [Path('/tmp/ricoh_mpc3004_service.pdf')],
    # gdown "https://drive.google.com/uc?id=1Iu_GneoZmhtSf-v9P3pQpsafJm2tVks1" -O /tmp/sp3710_guia.pdf
    # gdown "https://drive.google.com/uc?id=1aNq74FQyNCwiHEUhi_Io45Dbdf8UsNpQ" -O /tmp/sp3710_service.pdf
    # gdown "https://drive.google.com/uc?id=1JSD6dOuxOkXfdwe-N-RCctHkUU9FMWLD" -O /tmp/sp3710_psg.pdf
    'ricoh_sp3710_guia':     [Path('/tmp/sp3710_guia.pdf')],
    'ricoh_sp3710_service':  [Path('/tmp/sp3710_service.pdf')],
    'ricoh_sp3710_psg':      [Path('/tmp/sp3710_psg.pdf')],
    'ricoh_mp2555_guia':     [Path('/tmp/mp2555_guia.pdf')],
    'ricoh_mp2555_service':  [Path('/tmp/mp2555_service.pdf')],
    'e62655_guia':           [Path('/tmp/e62655_guia.pdf')],
    'e62655_cpmd':           [Path('/tmp/e62655_cpmd.pdf')],
    'e62655_service':        [Path('/tmp/e62655_service.pdf')],
    # gdown "https://drive.google.com/uc?id=1T6jWaRzZ2c-Rqxwl0naHSPXG-u27y_aj" -O /tmp/e826_guia.pdf
    # gdown "https://drive.google.com/uc?id=1hMzpRhjfF8Omei0gLZTFujwpoOW6LLAJ" -O /tmp/e826_service.pdf
    # gdown "https://drive.google.com/uc?id=1zvkbys7ZODegZhkUkJmSwobfUUwIMP_Y" -O /tmp/e826_cpmd.pdf
    'hp_e826_guia':          [Path('/tmp/e826_guia.pdf')],
    'hp_e826_service':       [Path('/tmp/e826_service.pdf')],
    'hp_e826_cpmd':          [Path('/tmp/e826_cpmd.pdf')],
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


def pdf_to_text_raw(path: Path) -> str:
    """Extrai texto preservando a ordem do stream; usado nas tabelas da MP 2555."""
    if not path.exists():
        print(f'  AVISO: {path} não encontrado — pulando', file=sys.stderr)
        return ''
    result = subprocess.run(
        ['pdftotext', '-raw', '-enc', 'UTF-8', str(path), '-'],
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
    return dots > 5 and dots / max(len(line), 1) > 0.50

# Padrão de capa/cabeçalho de manual que polui o índice com keywords gerais
COVER_PAGE_RE = re.compile(
    r"reader'?s responsibility|SERVICE MANUAL Ver\.\s*\d|"
    r"It is the reader'?s responsibility|Rev\.\s*\d{2}/\d{2}/\d{4}|"
    r"Contact Information.*Technical Services|Subject to Change.*Contact Information|"
    r"Revisions.*Original.*Revised.*Added",
    re.IGNORECASE | re.DOTALL
)

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

    return [c for c in chunks if len(c) >= 80 and not COVER_PAGE_RE.search(c)]

# ─── Extração de keywords ─────────────────────────────────────────────────────

# Termos que são sempre keywords mesmo sendo curtos
ALWAYS_KW = re.compile(
    r'\b(SC\d{3,6}|'
    r'\d{2}\.\d{2}(?:\.\d{2}(?:\.\d{2})?)?|'   # HP error codes
    r'[A-Z]{1,3}\d{3,}[A-Z]?(?:-\d+(?:CN)?)?|'  # Part numbers
    r'PCU|PCDU|ITB|ADF|EWS|BICU|PSU|FRU|'
    r'E82650|E82660|E82670|E826|E52645|E52545|M527|M528|M506|M507|M501|'
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
        # Pega até o próximo código ou 5000 chars (cobre procedimento completo)
        end = matches[i + 1].start() if i + 1 < len(matches) else start + 5000
        end = min(end, start + 5000)
        section = text[start:end].strip()

        if len(section) < 80 or is_toc_chunk(section) or is_book_index_chunk(section):
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
    # Linhas com "... N" (sumário com pontos)
    lines = text.split('\n')
    toc_lines = sum(1 for l in lines if re.search(r'\.{3,}\s*\d+', l))
    if len(lines) > 0 and toc_lines / len(lines) > 0.3:
        return True
    dot_runs = len(re.findall(r'\.{4,}', text))
    if dot_runs > 3:
        return True
    return False


def is_book_index_chunk(text: str) -> bool:
    """
    Detecta índice remissivo alfabético (back-of-book index) do HP service manual
    e tabelas-resumo de erro do CPMD — que não contêm troubleshooting real.

    Padrões detectados:
    - "accessories, FAX remove and replace 1267" → índice remissivo do HP service manual
    - "B backup error 32.WX.YZ error 4 reset error 4..." → tabela resumo do CPMD
    - "80.WX.YZ error 136, 270 embedded Multi-Media Card..." → entrada de índice

    NÃO deve filtrar:
    - Seções SC do Ricoh que têm "Type" codes (D, D, D) como coluna da tabela
    - Seções reais de CPMD que têm "Recommended action" e part numbers (alta densidade de
      números 3-4 dígitos), que seriam erroneamente descartadas pelo check de density
    """
    # Real troubleshooting sections always contain "Recommended action" — never an index page.
    if re.search(r'Recommended action\b', text, re.IGNORECASE):
        return False

    # Múltiplas ocorrências de "remove/removing and replace/replacing NNN"
    # → índice remissivo do HP service manual
    if len(re.findall(r'remov(?:e|ing) and replac(?:e|ing)\s+\d{3,4}', text, re.IGNORECASE)) >= 2:
        return True

    # TOC-row curta: código HP imediatamente seguido só por número de página na mesma linha.
    # Ex: "76.00.24 5\nB\nbackup error" (25 chars) — sem descrição na linha do código → ruído de sumário.
    # Guard de comprimento (< 50) é essencial: seções reais onde o código é seguido de número de página
    # antes do conteúdo de bullets (ex: "66.00.79 335\n● 66.80.22…") têm texto muito mais longo.
    if len(text) < 50 and re.match(r'\d{2}\.[0-9A-F]{2,3}\.[0-9A-F]{2}\s+\d{1,4}\s*(?:\n|$)', text, re.IGNORECASE):
        return True

    # Tabela resumo do CPMD: letra de seção + "word error XX.YY error N"
    # Ex: "B backup error 32.WX.YZ error 4 reset error 4..."
    if re.search(r'(?:^|\n)[A-Z]\s+\w+ error \d{2}\.', text):
        return True

    # Muitas referências a páginas via "error/features/replacing/installing NNN"
    # (padrão típico de índice HP: "error 136, 270", "features 136, 182")
    page_label_refs = re.findall(
        r'\b(?:error|features?|replacing|installing|diagnostics)\s+\d{3,4}',
        text, re.IGNORECASE
    )
    if len(page_label_refs) >= 4:
        return True

    # Alta densidade de números de 3-4 dígitos (página de índice tem muitos refs)
    # Exige mínimo absoluto de 10 refs para evitar falsos positivos em seções Ricoh
    standalone_pages = re.findall(r'(?<!\d)(\d{3,4})(?!\d)', text)
    long_words = re.findall(r'[a-zA-Z]{5,}', text)
    if len(standalone_pages) >= 10 and len(long_words) > 0 and len(standalone_pages) / len(long_words) > 0.3:
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
        if len(description) > 40 and not is_toc_chunk(description) and not is_book_index_chunk(description):
            entry = {'key': 'cpmd', 'text': description}
            results[prefix].append(entry)

    return results


# Bullet sub-codes "● XX.YY.ZZ" inside HP CPMD parent sections.
# These codes precede their code with "●" so SECTION_START never captures them.
# Families in cpmd/e62655_cpmd: 13.B2, 13.B9, 33.05, 66.80, 80.03 (Lote 1).
BULLET_CODE_RE = re.compile(r'●\s*(\d{2}\.[0-9A-Z]{2,3}\.[0-9A-Z]{2})', re.IGNORECASE)
BULLET_ACTION_RE = re.compile(r'\nRecommended action\b', re.IGNORECASE)
# Comma-separated additional codes on the same bullet line:
# "● 13.A3.D3, 13.A3.D4, 13.A3.D5 = Tray 3: Paper did not reach..."
COMMA_CODE_RE = re.compile(r',\s*(\d{2}\.[0-9A-Z]{2,3}\.[0-9A-Z]{2})', re.IGNORECASE)

def extract_hp_errors_from_cpmd(text: str) -> dict:
    """
    Parser específico para o CPMD HP.
    Suporta:
    - Códigos no início de linha: "49.38.07\nDescription..."
    - Códigos no meio de frase: "...text. 50.1X.YZ Fuser Error Low..."
    - Múltiplos códigos: "82.73.46, 82.73.47\nDescription..."
    - Subcódigos inline: "● 13.B9.A1\nDescription..." (Lote 1)
    """
    results = defaultdict(list)

    # Padrão que captura a PRIMEIRA linha com um ou mais códigos HP
    # Suporta "XX.YY.ZZ", "XX.YY.ZZ, XX.YY.ZZ", "XX.YY.ZZ or XX.YY.ZZ"
    # O delimitador após o código aceita espaço OU ":" colado — alguns blocos
    # (ex.: base 53 "53.B0.01: Tray 1 feed roller…", 60.xx, 65.80.A0, 80.03.xx)
    # usam dois-pontos sem espaço, que o padrão antigo (só "\s+") descartava.
    CODE = r'\d{2}(?:\.[0-9A-Z*]{2,3})+'
    MULTI_CODE = rf'({CODE}(?:(?:,\s*|\s+or\s+){CODE})*)'
    SECTION_START = re.compile(
        rf'(?:^|(?<=\n)|(?<=\. ))({CODE}(?:(?:,\s*|\s*/\s*|\s+or\s+){CODE})*)'
        rf'(?:\s*:|\s+(?!error messages|errors|\*))',
        re.MULTILINE | re.IGNORECASE
    )

    matches = list(SECTION_START.finditer(text))
    for i, m in enumerate(matches):
        raw_codes_str = m.group(1)
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else start + 5000
        end = min(end, start + 5000)
        section = re.sub(r'\n+●\s*$', '', text[start:end].strip())

        if is_toc_chunk(section) or is_book_index_chunk(section):
            continue

        # Short/tiny section (< 80 chars): extend with shared action block from the same
        # family. Handles both 20-79 char description-only lines and even tiny sub-codes
        # (< 20 chars like "41.03.F0" or "60.00.02: Tray 2") whose "Recommended action"
        # lives in a later section of the same family. The length gate moves to AFTER this
        # lookahead so those sub-codes can still be extended before the discard check.
        if len(section) < 80 and len(raw_codes_str) >= 2:
            la_text = text[end:min(end + 8000, len(text))]
            la_action = BULLET_ACTION_RE.search(la_text)
            if la_action:
                cross = any(
                    mm.group(1)[:2] != raw_codes_str[:2]
                    for mm in SECTION_START.finditer(la_text[:la_action.start()])
                )
                if not cross:
                    section = section + '\n\n' + la_text[la_action.start():la_action.start() + 3000].strip()

        if len(section) < 20:
            continue

        # Extrair todos os códigos desta entrada (ex.: "82.73.46, 82.73.47")
        individual_codes = re.findall(rf'{CODE.replace(r"+", r"{1,3}")}', raw_codes_str, re.IGNORECASE)
        if not individual_codes:
            individual_codes = [raw_codes_str.split(',')[0].strip()]

        entry = {'key': 'cpmd', 'text': section}

        for code in individual_codes:
            code = code.strip().upper()
            # Uppercase letter O is not a hex digit in HP codes — common OCR artifact (F0 → FO).
            # Normalize key only; entry text preserves the original PDF text.
            code = code.replace('O', '0')
            results[code].append(entry)
            parts = code.split('.')
            if len(parts) >= 3:
                results['.'.join(parts[:2])].append(entry)
            if len(parts) >= 2:
                results[parts[0]].append(entry)

        # ── Bullet sub-codes within this section (Lote 1 + Lote 4) ────────────
        # Codes like "● 13.B9.A1\nDesc" are prefixed with "●" so SECTION_START
        # never sees them at line-start. Extract and index each with its own
        # description plus the inherited "Recommended action" block.
        #
        # Two independent reasons to search beyond the 5 000-char `section`:
        # 1. Multi-family sections (13.B2.E2): bullets start beyond 5 000 chars →
        #    extend raw window up to 50 000 chars from section start.
        # 2. Short-section lookahead: a short section (< 80 chars) is extended via
        #    lookahead to include "Recommended action" + bullet codes from a later
        #    section (e.g. 99.00.xx → 99.01.00/10/20; 13.60 → 66.80.20).
        #    In that case `section` is already extended — use it directly.
        bullet_end = matches[i + 1].start() if i + 1 < len(matches) else start + 50000
        bullet_end = min(bullet_end, start + 50000)
        raw_window = text[start:bullet_end]
        # If `section` was extended by the lookahead (longer than the raw next-match
        # window), bullet codes live in `section`; otherwise use the extended raw window.
        bullet_section = section if len(section) > len(raw_window) else raw_window
        bullet_ms = list(BULLET_CODE_RE.finditer(bullet_section))

        # Build per-family action blocks so multi-family sections (e.g. 13.B2.E2
        # containing A/B/C/D sub-families) each inherit the correct "Recommended
        # action" — not the last family's block spilling over to earlier ones.
        # family_action_block[prefix] = action text for that code family.
        family_action_block: dict = {}
        if bullet_ms:
            # Group bullets by their family prefix (first two dotted parts, e.g. "13.B9")
            # and for each group find the "Recommended action" after the group's last bullet.
            prev_family = None
            family_start_j = 0
            for j_scan, bm_scan in enumerate(bullet_ms):
                sc = bm_scan.group(1).upper().replace('O', '0')
                parts = sc.split('.')
                if len(parts) < 3:
                    continue
                fam = '.'.join(parts[:2])
                if fam != prev_family:
                    prev_family = fam
                    family_start_j = j_scan
            # Walk families in order and assign action blocks
            seen_fam = None
            last_bm_of_fam = {}
            for bm_scan in bullet_ms:
                sc = bm_scan.group(1).upper().replace('O', '0')
                parts = sc.split('.')
                if len(parts) < 3:
                    continue
                fam = '.'.join(parts[:2])
                last_bm_of_fam[fam] = bm_scan
            for fam, last_bm in last_bm_of_fam.items():
                act = BULLET_ACTION_RE.search(bullet_section, last_bm.start())
                if act:
                    family_action_block[fam] = bullet_section[act.start():act.start() + 3000].strip()
            # Fallback: if still no action blocks found (all families), use lookahead
            if not family_action_block and len(raw_codes_str) >= 2:
                la_text = text[bullet_end:min(bullet_end + 8000, len(text))]
                la_action = BULLET_ACTION_RE.search(la_text)
                if la_action:
                    cross = any(
                        mm.group(1)[:2] != raw_codes_str[:2]
                        for mm in SECTION_START.finditer(la_text[:la_action.start()])
                    )
                    if not cross:
                        fallback_action = la_text[la_action.start():la_action.start() + 3000].strip()
                        for bm_scan in bullet_ms:
                            sc = bm_scan.group(1).upper().replace('O', '0')
                            parts = sc.split('.')
                            if len(parts) >= 3:
                                family_action_block.setdefault('.'.join(parts[:2]), fallback_action)

        for j, bm in enumerate(bullet_ms):
            sub_code = bm.group(1).upper().replace('O', '0')
            sub_parts = sub_code.split('.')
            if len(sub_parts) != 3 or re.search(r'[XYZ*]', sub_code):
                continue  # skip wildcards
            fam = '.'.join(sub_parts[:2])
            next_bullet = bullet_ms[j + 1].start() if j + 1 < len(bullet_ms) else len(bullet_section)
            # Boundary = next bullet OR next action AFTER this bullet (whichever is sooner).
            # Searching from bm.start() avoids inheriting a preceding action block.
            action_after_bm = BULLET_ACTION_RE.search(bullet_section, bm.start())
            action_start = action_after_bm.start() if action_after_bm else len(bullet_section)
            boundary = min(next_bullet, action_start)
            bullet_text = bullet_section[bm.start():boundary].strip()
            if len(bullet_text) < 10:
                continue
            fam_action = family_action_block.get(fam, '')
            full_text = (bullet_text + '\n\n' + fam_action) if fam_action else bullet_text
            sub_entry = {'key': 'cpmd', 'text': full_text}
            results[sub_code].append(sub_entry)
            results['.'.join(sub_parts[:2])].append(sub_entry)
            results[sub_parts[0]].append(sub_entry)

            # Additional comma-separated codes on the same bullet line:
            # "● 13.A3.D3, 13.A3.D4, 13.A3.D5 = Tray 3: ..."
            line_end = bullet_section.find('\n', bm.end())
            if line_end == -1:
                line_end = bm.end() + 200
            for ecm in COMMA_CODE_RE.finditer(bullet_section[bm.end():line_end]):
                ec = ecm.group(1).upper().replace('O', '0')
                ec_parts = ec.split('.')
                if len(ec_parts) != 3 or re.search(r'[XYZ*]', ec):
                    continue
                results[ec].append(sub_entry)
                results['.'.join(ec_parts[:2])].append(sub_entry)
                results[ec_parts[0]].append(sub_entry)

    return results

# ─── Extração de error codes — Ricoh SC ──────────────────────────────────────

# SC codes no service manual aparecem em dois formatos conforme o modelo:
#   IM C3000/3500 → "SC20200" (sem separador, no início de uma linha)
#   MP C3004/3504 → "SC285-00" (com hífen, seguido de \n ou parêntese)
# O grupo 2 captura os 3 dígitos do grupo (202/285) e o grupo 3 o sufixo (00),
# com o hífen opcional para cobrir ambos.
RICOH_SC_RE = re.compile(
    # Allow optional space after SC: "SC 81699\n" (imc3000) / "SC 816-99\n" (mpc3004).
    # Allow optional trailing comma: "SC816-23,\n" (mpc3004 comma-pair column artifact).
    r'(?:^|\n)(SC\s?(\d{3})-?(\d{2})),?\s*(?:\n|\()',
    re.MULTILINE
)

# Range patterns in Ricoh condition tables (Lote 2).
# Inline (same line): "SC81610 to 12\n\nD" or "SC87461 to -65\n\nD"
RICOH_INLINE_RANGE_RE = re.compile(
    r'(?:^|\n)(SC(\d{3})-?(\d{2}))\s+to\s+[-]?(\d{2})\b',
    re.MULTILINE
)
# Cross-line (end-suffix on next line): "SC865-50 to\n73\n\nD"
RICOH_XLINE_RANGE_RE = re.compile(
    r'(?:^|\n)(SC(\d{3})-?(\d{2}))\s+to\s*\n\s*[-]?(\d{2})\b',
    re.MULTILINE
)
# Split-column (Type between "to" and suffix): "SC864-02 to\n\nD\n\n23"
RICOH_SPLIT_RANGE_RE = re.compile(
    r'(?:^|\n)(SC(\d{3})-?(\d{2}))\s+to\s*\n+\s*[A-D]\s*\n+\s*(\d{2})\b',
    re.MULTILINE
)
# Reversed (imc3000 partition table): "SC86302\n\nD\n\nto 23"
RICOH_REVERSED_RANGE_RE = re.compile(
    r'(?:^|\n)(SC(\d{3})-?(\d{2}))\s*\n+\s*[A-D]\s*\n+\s*to\s+(\d{2})\b',
    re.MULTILINE
)
# Comma-pair (imc3000): "SC81623, 24\n\nD"
RICOH_COMMA_PAIR_RE = re.compile(
    r'(?:^|\n)(SC(\d{3})-?(\d{2})),\s+(\d{2})\b',
    re.MULTILINE
)
# Partition range (mpc3004 HDD codes): "(SC863-02) to partition "v" (SC863-23)"
# Covers all intermediate partition codes SC863-03 … SC863-22 and the endpoint SC863-23.
RICOH_PARTITION_RANGE_RE = re.compile(
    r'\(SC(\d{3})-(\d{2})\)\s+to\s+partition\s+"[a-z]"\s+\(SC\d{3}-(\d{2})\)',
    re.IGNORECASE
)

# Section header "SC843-02 OCCURS" (mpc3004 troubleshooting chapters).
SC_OCCURS_RE = re.compile(
    r'(?:^|\n)(SC(\d{3})-(\d{2}))\s+OCCURS\s*\n',
    re.MULTILINE
)

# Limite de fim de seção: início da PRÓXIMA seção quando ela não é um SCxxx-yy
# normal (que o RICOH_SC_RE já delimita). Cobre cabeçalho curinga "SC816-**" e
# marcador de capítulo "6.10 SERVICE CALL 816-899" / "SERVICE CALL 700-792".
SECTION_BOUNDARY_RE = re.compile(
    r'(?:\n|^)(?:SC\d{3}-?\*\*|\d+(?:\.\d+)+\s+SERVICE\s+CALL\b|SERVICE\s+CALL\s+\d{3}-\d{3}\b)',
    re.IGNORECASE
)

# Seções "When SC… is Displayed" — contêm Causa + Solução completas.
# Cobre imc3000 (mixed case) e mpc3004 (UPPERCASE + numeração "6.12.2 WHEN SC370...").
# Parênteses: [^\n]* greedy (acha o último ")" da linha sem backtracking exponencial).
WHEN_SC_RE = re.compile(
    r'(?:^|\n)(?:\d+(?:\.\d+)+\s+)?When\s+SC(\d{3,5}(?:-\d{2})?)\s*(?:\([^\n]*\)\s*)?(?:is\s+)?Displayed',
    re.MULTILINE | re.IGNORECASE
)

SP3710_SERVICE_KEY = 'ricoh_sp3710_service'
SP3710_CODES = [
    'SC202', 'SC203', 'SC204', 'SC220', 'SC268', 'SC491', 'SC520', 'SC530',
    'SC541', 'SC542-01', 'SC542-02', 'SC542-03', 'SC543', 'SC544', 'SC545',
    'SC546', 'SC547', 'SC551', 'SC552', 'SC553', 'SC554', 'SC557', 'SC559',
    'SC580', 'SC688',
]
SP3710_HEADER_RE = re.compile(r'(?m)^SC\s?(\d{3}(?:-\d{2})?)\s+(?:[A-D]\b|$)')
PROPAGATION_EXCLUDED_SERVICE_KEYS = {SP3710_SERVICE_KEY}
MP2555_SERVICE_KEY = 'ricoh_mp2555_service'
MP2555_MIN_TEXT = 120
MP2555_RICH_SIBLING = 400
MP2555_STRUCTURAL_GROUPS = {
    'SC549', 'SC622', 'SC669', 'SC670', 'SC672', 'SC682',
    'SC700', 'SC720', 'SC721', 'SC722', 'SC724', 'SC727',
    'SC761', 'SC816', 'SC845', 'SC863', 'SC864', 'SC865',
}

def extract_ricoh_sc_sections(text: str, service_key: str = 'ricoh_imc3000_service') -> dict:
    """
    Extrai seções SC do service manual Ricoh.
    Indexa por: SC20200 (código completo), SC202 (grupo), SC202-00 (formato com hífen).
    `service_key` define o índice de origem para os entries gerados.
    """
    results = defaultdict(list)

    matches = list(RICOH_SC_RE.finditer(text))

    for i, m in enumerate(matches):
        group  = 'SC' + m.group(2)    # SC202
        suffix = m.group(3)           # 00
        full   = f'{group}{suffix}'   # SC20200 (forma canônica sem separador)
        hyphen = f'{group}-{suffix}'  # SC202-00

        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else start + 3000
        end = min(end, start + 3000)
        section = text[start:end]

        # A próxima seção pode usar cabeçalho curinga (ex.: "SC816-**") ou um
        # marcador de capítulo ("6.10 SERVICE CALL 816-899") que o RICOH_SC_RE
        # não reconhece como delimitador — então a seção "vaza" e engole texto
        # de navegação que parece índice (e seria descartado em finalize, ex.:
        # SC792-00 do MP C3004). Cortar no primeiro desses marcadores após o
        # cabeçalho atual mantém só o conteúdo real da seção.
        cut = SECTION_BOUNDARY_RE.search(section, 40)
        if cut:
            section = section[:cut.start()]
        section = section.strip()

        if len(section) < 10:
            continue

        # Limpar artefatos de coluna (múltiplos espaços)
        section = re.sub(r'[ \t]{3,}', '  ', section)

        entry = {'key': service_key, 'text': section}

        results[full].append(entry)      # SC20200
        results[hyphen].append(entry)   # SC202-00
        # Só adicionar ao grupo se ainda não tiver (primeiro representa o grupo)
        if not results[group]:
            results[group].append(entry)

    return results


def normalize_mp2555_sc_text(text: str) -> str:
    """
    Recompõe códigos quebrados entre colunas sem alterar o parser Ricoh comum.

    Cobre pypdf/Poppler -raw ("SC541-\\n02") e Poppler padrão
    ("SC541-\\nA\\n02"). O Level é mantido após o código para que possa ser
    removido do texto exibido, sem participar da chave.
    """
    text = re.sub(
        r'(?m)^(SC\s?\d{3})-\s*\n+\s*([A-D])\s*\n+\s*(\d{2})\s*$',
        lambda m: f'{m.group(1)}-{m.group(3)}\n{m.group(2)}',
        text,
    )
    return re.sub(r'(SC\s?\d{3})-\s*\n\s*(\d{2})', r'\1-\2', text)


def extract_mp2555_sc_sections(text: str, service_key: str = MP2555_SERVICE_KEY) -> dict:
    """Extrai os 471 subcódigos e somente os 18 grupos aprovados da série MP 2555."""
    normalized = clean_text(normalize_mp2555_sc_text(text))
    sources = [
        extract_ricoh_sc_sections(normalized, service_key),
        expand_ricoh_ranges(normalized, service_key),
        extract_ricoh_sc_detailed_sections(normalized, service_key),
    ]
    results = defaultdict(list)

    full_codes = sorted({
        code for source in sources for code in source
        if re.fullmatch(r'SC\d{3}-\d{2}', code)
    })
    for code in full_codes:
        candidates = [
            entry for source in sources for entry in source.get(code, [])
            if entry.get('key') == service_key
        ]
        if not candidates:
            continue
        entry = dict(max(candidates, key=lambda item: len(item['text'])))
        entry['text'] = re.sub(
            rf'^\s*{re.escape(code)}\s*\n\s*[A-D]\s+',
            f'{code}\n',
            entry['text'],
            count=1,
        ).strip()
        results[code].append(entry)

    for group in sorted(MP2555_STRUCTURAL_GROUPS):
        candidates = [
            entry for source in sources for entry in source.get(group, [])
            if entry.get('key') == service_key
        ]
        if candidates:
            entry = dict(max(candidates, key=lambda item: len(item['text'])))
            entry['text'] = re.sub(
                rf'^\s*(?:SC\d{{3}}-\d{{2}}|{re.escape(group)})\s*\n\s*[A-D]\s+',
                f'{group}\n',
                entry['text'],
                count=1,
            ).strip()
            results[group].append(entry)

    # O manual traz SC670 apenas como cabeçalho estrutural da seção 6.13.1,
    # sem corpo próprio antes da seção SC672.
    if 'SC670' not in results and re.search(
        r'(?im)^\s*(?:6\.13\.1\s+)?WHEN\s+SC670\s+IS\s+DISPLAYED\s*$',
        normalized,
    ):
        results['SC670'].append({
            'key': service_key,
            'text': 'SC670\nWhen SC670 is displayed (Service Manual section 6.13.1).',
        })

    # Algumas linhas da tabela trazem apenas o nome do erro; reutilize a seção
    # mais completa do mesmo grupo, como a propagação Ricoh global já faz.
    by_group = defaultdict(list)
    for code in results:
        if re.fullmatch(r'SC\d{3}-\d{2}', code):
            by_group[code[:5]].append(code)
    for siblings in by_group.values():
        rich_code = max(
            siblings,
            key=lambda code: len(results[code][0]['text']),
        )
        rich_text = results[rich_code][0]['text']
        if len(rich_text) < MP2555_RICH_SIBLING:
            continue
        for code in siblings:
            entry = results[code][0]
            if len(entry['text']) >= MP2555_MIN_TEXT:
                continue
            entry['text'] = (
                entry['text'].rstrip()
                + f'\n\nShared diagnostic procedure from {rich_code}:\n'
                + rich_text
            )
            entry['src'] = 'propagated'

    return results


def expand_ricoh_ranges(text: str, service_key: str) -> dict:
    """
    Expands range references in Ricoh service manuals into individual code entries.
    Handles:
    - Inline:   SC81610 to 12  →  SC816-10, SC816-11, SC816-12
    - Cross-line: SC865-50 to\\n73  →  SC865-50 … SC865-73
    - Split-col:  SC864-02 to\\n\\nD\\n\\n23  →  SC864-02 … SC864-23
    - Reversed:   SC86302\\n\\nD\\n\\nto 23  →  SC863-02 … SC863-23
    - Comma-pair: SC81623, 24  →  SC816-23, SC816-24
    All entries are marked src='range'.
    """
    results = defaultdict(list)
    seen: set = set()  # (full_code, service_key) pairs already added

    def _ctx(text_after: str) -> str:
        m = re.match(r'\s*\n+\s*(?:[A-D]\s*\n+\s*)?(Error Name[^\n]*\n)?(.{10,400})',
                     text_after[:700], re.DOTALL)
        return m.group(0).strip()[:400] if m else text_after[:150].strip()

    def _add(base: str, start: int, end: int, body: str) -> None:
        if end < start or end - start > 100:
            return
        group = f'SC{base}'
        for suf in range(start, end + 1):
            full   = f'{group}{suf:02d}'
            hyphen = f'{group}-{suf:02d}'
            k = (full, service_key)
            if k in seen:
                continue
            seen.add(k)
            entry = {'key': service_key, 'text': f'{hyphen}\n{body}', 'src': 'range'}
            results[full].append(entry)
            results[hyphen].append(entry)
        if group not in results:
            results[group].append(
                {'key': service_key, 'text': f'{group}\n{body[:100]}', 'src': 'range'}
            )

    for pat in (RICOH_INLINE_RANGE_RE, RICOH_XLINE_RANGE_RE,
                RICOH_SPLIT_RANGE_RE, RICOH_REVERSED_RANGE_RE):
        for m in pat.finditer(text):
            base, s, e = m.group(2), int(m.group(3)), int(m.group(4))
            _add(base, s, e, _ctx(text[m.end():m.end() + 700]))

    for m in RICOH_PARTITION_RANGE_RE.finditer(text):
        base, s, e = m.group(1), int(m.group(2)), int(m.group(3))
        _add(base, s, e, _ctx(text[m.end():m.end() + 700]))

    for m in RICOH_COMMA_PAIR_RE.finditer(text):
        base, s1, s2 = m.group(2), int(m.group(3)), int(m.group(4))
        ctx = _ctx(text[m.end():m.end() + 700])
        for suf in (s1, s2):
            full   = f'SC{base}{suf:02d}'
            hyphen = f'SC{base}-{suf:02d}'
            k = (full, service_key)
            if k not in seen:
                seen.add(k)
                entry = {'key': service_key, 'text': f'{hyphen}\n{ctx}', 'src': 'range'}
                results[full].append(entry)
                results[hyphen].append(entry)

    return results

# Cabeçalho de seção de solução com curinga: "681**" ou "SC681-**" + tipo A-D.
# Esses blocos contêm a solução completa (passo a passo) válida para todos os
# subcódigos da base.
RICOH_WILDCARD_RE = re.compile(r'(?:^|\n)(?:SC)?(\d{3})-?\*\*\s*\n+\s*[A-D]\b', re.MULTILINE)

# Linha da tabela "Service Call Conditions": código SEM prefixo SC seguido da
# descrição curta — ex.: "681-12\n\nToner bottle: IDChip Communication error…".
RICOH_CONDITION_ROW_RE = re.compile(
    r'(?:^|\n)(\d{3})-(\d{2})\s*\n+\s*([A-Z][^\n]{7,})', re.MULTILINE)

def extract_ricoh_condition_table(text: str, service_key: str = 'ricoh_imc3000_service') -> dict:
    """
    Captura a tabela "Service Call Conditions" do service manual Ricoh, onde os
    subcódigos aparecem SEM o prefixo "SC" (ex.: "681-12" em vez de "SC681-12").

    Necessário porque alguns SC só existem nesse formato: SC681/SC682 (toner /
    TD sensor ID chip — 32 subcódigos cada) têm a solução num bloco curinga
    "681**" e a identificação por subcódigo apenas nesta tabela; e SC912
    (External controller error) aparece só aqui no IM C3000. O RICOH_SC_RE exige
    "SC" literal e perdia todos esses códigos.

    Cada entry recebe a descrição da linha + (quando existe) o bloco de solução
    curinga da base, para respostas completas por subcódigo.
    """
    results = defaultdict(list)

    # 1. Coletar blocos de solução curinga (SCxxx** … passos), por base.
    solutions = {}
    wc_matches = list(RICOH_WILDCARD_RE.finditer(text))
    for i, m in enumerate(wc_matches):
        base = m.group(1)
        start = m.start()
        end = min(wc_matches[i + 1].start() if i + 1 < len(wc_matches) else start + 2500,
                  start + 2500)
        sol = re.sub(r'[ \t]{3,}', '  ', text[start:end].strip())
        if len(sol) > 80 and base not in solutions:
            solutions[base] = sol

    # 2. Percorrer a tabela de condições (código sem SC + descrição curta).
    seen_groups = set()
    for m in RICOH_CONDITION_ROW_RE.finditer(text):
        base, suffix, desc = m.group(1), m.group(2), m.group(3).strip()
        if not (100 <= int(base) <= 999):
            continue
        # Filtro anti-ruído: descrição real tem ao menos uma minúscula
        # (descarta linhas de part number / cabeçalho em CAIXA ALTA).
        if not any(c.islower() for c in desc):
            continue

        group  = f'SC{base}'
        full   = f'{group}{suffix}'   # SC68112
        hyphen = f'{group}-{suffix}'  # SC681-12

        body = f'{group}-{suffix}\n{desc}'
        if base in solutions:
            body += f'\n\n{solutions[base]}'
        entry = {'key': service_key, 'text': body}

        results[full].append(entry)
        results[hyphen].append(entry)
        if group not in seen_groups:
            results[group].append(entry)
            seen_groups.add(group)

    return results

def extract_ricoh_sc_groups(text: str, service_key: str = 'ricoh_imc3000_service') -> dict:
    """
    Extrai descrições de grupos SC do Ricoh (SC100, SC200, SC300, etc.)
    que representam categorias de erro (não têm código de 5 dígitos).
    `service_key` define o índice de origem para os entries gerados.
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
            results[group].append({'key': service_key, 'text': best_section})
        else:
            # Fallback: criar entrada descritiva com grupo + exemplos de códigos
            prefix_num = group[2:]  # '400' de 'SC400'
            # Coletar alguns códigos específicos deste grupo do texto.
            # Cobre os dois formatos: SC40001 (IM C3000) e SC400-01 (MP C3004).
            sub_codes = re.findall(rf'SC{prefix_num}-?\d{{2,3}}\b', text)
            sub_codes = list(dict.fromkeys(sub_codes))[:8]   # primeiros 8 únicos
            # Nome do modelo derivado do índice de origem para não fixar IM C3000.
            modelo = ('MP C3004/3504' if 'mpc3004' in service_key
                      else 'IM C3000/C3500' if 'imc3000' in service_key
                      else 'Ricoh')
            desc = (
                f'{group} — {category}\n\n'
                f'Grupo de erros Ricoh {modelo}.\n'
                f'Códigos específicos neste grupo: {", ".join(sub_codes) if sub_codes else "consulte o service manual"}.\n'
                f'Consulte o código completo (ex.: {sub_codes[0] if sub_codes else group + "xx"}) '
                f'para diagnóstico e solução detalhados.'
            )
            results[group].append({'key': service_key, 'text': desc})

    return results


def extract_ricoh_sc_detailed_sections(text: str, service_key: str = 'ricoh_imc3000_service') -> dict:
    """
    Extrai seções 'When SC… is Displayed' com Causa e Solução completas.
    Indexa por: SC37003 (sem hífen), SC370-03 (com hífen), SC370 (grupo).
    """
    results = defaultdict(list)
    matches = list(WHEN_SC_RE.finditer(text))

    for i, m in enumerate(matches):
        raw = m.group(1)
        if '-' in raw:
            group_num, suffix = raw.split('-', 1)
        elif len(raw) >= 5:
            group_num, suffix = raw[:3], raw[3:]
        else:
            group_num, suffix = raw, None

        group   = 'SC' + group_num
        full_nh = group + (suffix or '')          # SC37003
        full_h  = group + '-' + suffix if suffix else group  # SC370-03

        start = m.start()
        end   = matches[i + 1].start() if i + 1 < len(matches) else start + 5000
        end   = min(end, start + 5000)
        section = text[start:end].strip()
        section = re.sub(r'[ \t]{3,}', '  ', section)

        if len(section) < 100:
            continue

        entry = {'key': service_key, 'text': section}
        results[full_nh].append(entry)
        results[full_h].append(entry)
        if not results[group]:
            results[group].append(entry)

    # Also extract "SC843-02 OCCURS" style sections (mpc3004 troubleshooting chapters).
    occurs_matches = list(SC_OCCURS_RE.finditer(text))
    for i, m in enumerate(occurs_matches):
        group_num, suffix = m.group(2), m.group(3)
        group   = 'SC' + group_num
        full_nh = group + suffix          # SC84302
        full_h  = group + '-' + suffix   # SC843-02

        start = m.start()
        end   = occurs_matches[i + 1].start() if i + 1 < len(occurs_matches) else start + 3000
        end   = min(end, start + 3000)
        section = text[start:end].strip()
        section = re.sub(r'[ \t]{3,}', '  ', section)

        if len(section) < 100:
            continue

        entry = {'key': service_key, 'text': section}
        if not any(e['text'] == section for e in results[full_nh]):
            results[full_nh].append(entry)
        if not any(e['text'] == section for e in results[full_h]):
            results[full_h].append(entry)
        if not results[group]:
            results[group].append(entry)

    return results


def extract_sp3710_service_call_text(text: str) -> str:
    """Return only the real SP 3710 section 6.2 Service Call body."""
    start = re.search(r'(?:^|\n)6\.2 SERVICE CALL\s*\n+\s*6\.2\.1 SC 2XX', text)
    if not start:
        return ''
    end = re.search(
        r'(?:^|\n)6\.2\.5 SERVICE CALL CONDITIONS\b|(?:^|\n)6\.3 ERROR MESSAGES\b|(?:^|\n)Error Messages\b',
        text[start.start():],
        re.IGNORECASE
    )
    if not end:
        return text[start.start():]
    return text[start.start():start.start() + end.start()]


def clean_sp3710_sc_section(section: str) -> str:
    """Remove page headers/footers without changing the SC diagnostic content."""
    keep = []
    for raw in section.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.match(r'^(M0C3|M0EV|SM|Troubleshooting|Service Call|No\.|Type)$', line):
            continue
        if re.match(r'^\d+-\d+$', line):
            continue
        keep.append(line)
    return '\n'.join(keep).strip()


def extract_sp3710_sc_sections(text: str, service_key: str = SP3710_SERVICE_KEY) -> dict:
    """
    Extract SP 3710 service-call codes.

    In this model, SC### is a complete code. Only SC542 has subcodes. This extractor
    is intentionally separate from RICOH_SC_RE because IM/MP models use SC### as a
    group for SC###-##.
    """
    results = defaultdict(list)
    service_call = extract_sp3710_service_call_text(text)
    if not service_call:
        return results

    matches = list(SP3710_HEADER_RE.finditer(service_call))
    for i, m in enumerate(matches):
        code = 'SC' + m.group(1).replace(' ', '').upper()
        if code.startswith('SC542-'):
            continue
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(service_call)
        section = clean_sp3710_sc_section(service_call[start:end])
        if len(section) < 80:
            continue
        results[code].append({'key': service_key, 'text': section})

    # The SC542 table is split by PDF column extraction. Recompose the three real
    # subcodes explicitly from section 6.2; do not index a partial row.
    sc542_solution = (
        "Solution:\n"
        "1. Reset the SC.\n"
        "2. Replace the fusing unit.\n"
        "3. Replace the drawer harness.\n"
        "4. Replace the PSU (PCB3)."
    )
    sc542_rows = {
        'SC542-01': (
            "SC542-01\n"
            "Type A\n"
            "Error Name/Error Condition/Major Cause/Solution\n"
            "Fuser reload error\n"
            "The fusing temperature rises 6C or less in 1.5 seconds; and this continues 5 times consecutively.\n"
            "Major cause:\n"
            "- Defective or deformed thermistor\n"
            "- Incorrect power supply input at the main power socket\n"
            f"{sc542_solution}"
        ),
        'SC542-02': (
            "SC542-02\n"
            "Type A\n"
            "Error Name/Error Condition/Major Cause/Solution\n"
            "Fuser reload error\n"
            "The fusing temperature has not reached 45C within 9 seconds after the fusing lamp comes ON while the machine is warming-up.\n"
            "Major cause:\n"
            "- Defective or deformed thermistor\n"
            "- Incorrect power supply input at the main power socket\n"
            f"{sc542_solution}"
        ),
        'SC542-03': (
            "SC542-03\n"
            "Type A\n"
            "Error Name/Error Condition/Major Cause/Solution\n"
            "Fuser reload error\n"
            "The fusing unit does not attain reload temperature within a predetermined time after the fusing temperature control starts.\n"
            "Major cause:\n"
            "- Defective fusing lamp (H1)\n"
            "- The overheat protection mechanism started working\n"
            f"{sc542_solution}"
        ),
    }
    for code, body in sc542_rows.items():
        results[code].append({'key': service_key, 'text': body, 'src': 'sp3710_recomposed'})

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

    # ── HP E62655 CPMD ────────────────────────────────────────────────────────
    print('[errors] HP E62655 CPMD')
    e62655_cpmd_text = ''
    for p in PDF_SOURCES['e62655_cpmd']:
        e62655_cpmd_text += pdf_to_text(p)
    e62655_cpmd_text = clean_text(e62655_cpmd_text)
    e62655_cpmd_errors = extract_hp_errors_from_cpmd(e62655_cpmd_text)
    for code, entries in e62655_cpmd_errors.items():
        for e in entries:
            ee = {'key': 'e62655_cpmd', 'text': e['text']}
            if not any(x['key'] == 'e62655_cpmd' and x['text'] == ee['text'] for x in index[code]):
                index[code].append(ee)
    print(f'  → {len(e62655_cpmd_errors)} códigos do E62655 CPMD')

    # ── HP E826 CPMD ─────────────────────────────────────────────────────────
    print('[errors] HP E826 CPMD')
    e826_cpmd_text = ''
    for p in PDF_SOURCES['hp_e826_cpmd']:
        e826_cpmd_text += pdf_to_text(p)
    e826_cpmd_text = clean_text(e826_cpmd_text)
    e826_cpmd_errors = extract_hp_errors_from_cpmd(e826_cpmd_text)
    for code, entries in e826_cpmd_errors.items():
        for e in entries:
            ee = {'key': 'hp_e826_cpmd', 'text': e['text']}
            if not any(x['key'] == 'hp_e826_cpmd' and x['text'] == ee['text'] for x in index[code]):
                index[code].append(ee)
    print(f'  → {len(e826_cpmd_errors)} códigos do E826 CPMD')

    # E826 CPMD: códigos reais que aparecem em seções agrupadas/inline sem
    # cabeçalho individual próprio capturado pelo parser compartilhado.
    _HP_E826_STUBS = [
        ('30.03.30',
         "30.03.30 Flatbed alignment calibration failed.\n"
         "Context: Section '30.03.22, 30.03.23, and 30.03.30' in the E826 CPMD.\n"
         "Recommended action: Turn the printer off and then on. Attempt to copy or scan a page. "
         "If the error persists, dispatch an onsite technician to check the interface cable and follow the CPMD procedure."),
        ('59.05.50',
         "59.05.50 Black drum motor error.\n"
         "Condition: The black drum motor is operating, but the printer indicates that it is stopped.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, dispatch an onsite technician and follow the E826 CPMD procedure."),
        ('59.05.60',
         "59.05.60 Black drum motor error.\n"
         "Condition: The black drum motor is operating, but the printer indicates that it is stopped.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, dispatch an onsite technician and follow the E826 CPMD procedure."),
        ('59.10.B0',
         "59.10.B0 Black toner dispense motor error.\n"
         "Condition: The black toner dispense motor operates, but the toner is not supplied. Copy, print, and fax services are unavailable.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, diagnose the black toner dispense motor and follow the E826 CPMD procedure."),
        ('59.10.C0',
         "59.10.C0 Black toner dispense motor error.\n"
         "Condition: The black toner dispense motor operates, but the toner is not supplied. Copy, print, and fax services are unavailable.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, diagnose the black toner dispense motor and follow the E826 CPMD procedure."),
        ('59.20.D0',
         "59.20.D0 Black developer motor error.\n"
         "Condition: The black developer motor was activated, but it stops after a certain amount of time.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, dispatch an onsite technician and follow the E826 CPMD procedure."),
        ('59.20.E0',
         "59.20.E0 Black developer motor error.\n"
         "Condition: The black developer motor was activated, but it stops after a certain amount of time.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, dispatch an onsite technician and follow the E826 CPMD procedure."),
        ('63.00.17',
         "63.00.17 Engine communication failure.\n"
         "Context: Section '63.00.17, 63.00.18, 63.00.19, or 63.00.1A' in the E826 CPMD.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, follow the E826 CPMD engine communication troubleshooting procedure."),
        ('63.00.18',
         "63.00.18 Engine communication failure.\n"
         "Context: Section '63.00.17, 63.00.18, 63.00.19, or 63.00.1A' in the E826 CPMD.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, follow the E826 CPMD engine communication troubleshooting procedure."),
        ('63.00.19',
         "63.00.19 Engine communication failure.\n"
         "Context: Section '63.00.17, 63.00.18, 63.00.19, or 63.00.1A' in the E826 CPMD.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, follow the E826 CPMD engine communication troubleshooting procedure."),
        ('63.00.1A',
         "63.00.1A Engine communication failure.\n"
         "Context: Section '63.00.17, 63.00.18, 63.00.19, or 63.00.1A' in the E826 CPMD.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, follow the E826 CPMD engine communication troubleshooting procedure."),
        ('63.00.39',
         "63.00.39 Black developer T/C sensor failure.\n"
         "Context: Section '63.00.39, 63.00.3A, 64.00.41, 63.00.42' in the E826 CPMD.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, check the formatter connection and developer unit connector; replace the developer unit if needed."),
        ('63.00.3A',
         "63.00.3A Black developer T/C sensor failure.\n"
         "Context: Section '63.00.39, 63.00.3A, 64.00.41, 63.00.42' in the E826 CPMD.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, check the formatter connection and developer unit connector; replace the developer unit if needed."),
        ('63.00.42',
         "63.00.42 Black developer T/C sensor failure.\n"
         "Context: Section '63.00.39, 63.00.3A, 64.00.41, 63.00.42' in the E826 CPMD.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, check the formatter connection and developer unit connector; replace the developer unit if needed."),
        ('64.00.41',
         "64.00.41 Black developer T/C sensor failure.\n"
         "Context: Section '63.00.39, 63.00.3A, 64.00.41, 63.00.42' in the E826 CPMD.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, check the formatter connection and developer unit connector; replace the developer unit if needed."),
        ('66.90.23',
         "66.90.23 Finisher buffer unit error.\n"
         "Condition: The buffer unit experienced an error; BM-exit CAM assembly unable to move paper downwards during buffering or not positioned correctly.\n"
         "Recommended action: Open and close the finisher door, check the finisher for jammed paper or obstacles, and follow the E826 CPMD procedure."),
        ('99.39.67',
         "99.39.67 eMMC Not Bootable.\n"
         "Context: The boot sequence is expected to stop at 99.39.67 when firmware must be downloaded after hard disk/eMMC service.\n"
         "Recommended action: Download firmware from the Preboot menu. If the download fails, check hard disk installation and replace the hard disk drive if the error persists."),
    ]
    for code, name in {
        '50.FF.01': 'Open heat error',
        '50.FF.03': 'Open heat error',
        '50.FF.04': 'Open heat error',
        '50.FF.05': 'Open heat error',
        '50.FF.06': 'Over heat error',
        '50.FF.07': 'Over heat error',
        '50.FF.08': 'Fuser error',
        '50.FF.09': 'Fuser error',
        '50.FF.0A': 'Fuser error',
        '50.FF.0B': 'Open heat error',
        '50.FF.0C': 'Low heat error',
        '50.FF.0D': 'Low heat error',
        '50.FF.0E': 'Low heat error',
        '50.FF.0F': 'Low heat error',
        '50.FF.10': 'Low heat error',
        '50.FF.11': 'Low heat error',
        '50.FF.12': 'Over heat error',
        '50.FF.13': 'Over heat error',
    }.items():
        _HP_E826_STUBS.append((
            code,
            f"{code} {name}.\n"
            "Condition: 50.FF.XX fuser error; the fuser temperature is less or higher than the target.\n"
            "Recommended action: Turn the printer off, open the right door, remove jammed paper, check for obstructions inside the printer, open the fuser access door with the green tab, remove wrapped media, and contact HP support if the error persists.",
        ))
    for code, fan_name in {
        '57.00.15': 'LSU fan',
        '57.00.19': 'Developer fan',
        '57.00.24': 'SMPS fan 2',
        '57.00.26': 'FDB fan',
    }.items():
        _HP_E826_STUBS.append((
            code,
            f"{code} {fan_name} error.\n"
            f"Condition: The {fan_name} was not activated, but the printer indicates that it is operating.\n"
            f"Recommended action: Turn the printer off and then on. If the error persists, check for abnormal fan noise, dispatch an onsite technician, diagnose the {fan_name}, reconnect the fan harness if needed, retest the fan, and replace the fan if the test fails.",
        ))
    _HP_E826_STUBS.extend([
        ('64.01.01',
         "64.01.01 Imaging ASIC card not detected.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, dispatch an onsite technician, remove the formatter cover, disconnect and secure the external +5v cable from the accelerator board, and follow the CPMD procedure."),
        ('64.04.06',
         "64.04.06 Workflow Accelerator Card assertion failure.\n"
         "Recommended action: Turn the printer off and then on. If the error persists, remove and reseat the accelerator card. If the issue is intermittent, capture logs and elevate the case using the Standard Support Process."),
    ])
    e826_stub_count = 0
    for code, text_body in _HP_E826_STUBS:
        entry = {'key': 'hp_e826_cpmd', 'text': text_body, 'src': 'stub'}
        family = code.rsplit('.', 1)[0]
        major = code.split('.', 1)[0]
        for k in (code, family, major):
            if not any(x['key'] == 'hp_e826_cpmd' and x['text'] == text_body for x in index[k]):
                index[k].append(entry)
                e826_stub_count += 1
    print(f'  → {e826_stub_count} entradas de stub E826 adicionadas')

    # ── HP E62655 Service Manual ──────────────────────────────────────────────
    print('[errors] HP E62655 Service Manual')
    e62655_svc_text = ''
    for p in PDF_SOURCES['e62655_service']:
        t = pdf_to_text(p)
        if t:
            e62655_svc_text += t
    e62655_svc_text = clean_text(e62655_svc_text)
    e62655_svc_errors = extract_hp_errors_from_cpmd(e62655_svc_text)
    for code, entries in e62655_svc_errors.items():
        for e in entries:
            ee = {'key': 'e62655_service', 'text': e['text']}
            if not any(x['key'] == 'e62655_service' and x['text'] == ee['text'] for x in index[code]):
                index[code].append(ee)
    print(f'  → {len(e62655_svc_errors)} códigos do E62655 service')

    # ── HP stubs: códigos reais sem seção própria no PDF ──────────────────────
    # Estes códigos aparecem apenas inline (sem cabeçalho próprio de seção) ou
    # em contextos que os parsers acima não conseguem capturar. O texto deriva da
    # menção real no manual; sobrevivem ao reindex por estarem no código.
    _HP_STUBS = [
        # 13.B2.FF (cpmd): aparece mid-sentence após ")" — SECTION_START não captura.
        # Contexto: "(J151, J110, J144) 13.B2.FF Jam in top cover Paper residual jam..."
        ('13.B2.FF', '13.B2', '13', 'cpmd',
         "13.B2.FF Jam in top cover\n"
         "Paper residual jam in top cover at image area. Paper present at SR2 at power on or after clearing jam.\n"
         "Recommended action for customers: Open the top cover and check for paper jammed in feed area. "
         "Check under the toner cartridge at the transfer area for any paper or obstructions. "
         "If the error persists, please contact customer support.\n"
         "Recommended action for onsite technicians: Test the top of page sensor (SR2). "
         "Check connections J151, J110, J144 on the DC controller PCA."),
        # 59.A2.03/04/05 (cpmd): inline dentro da seção wildcard 59.A2.0X (não capturada).
        ('59.A2.03', '59.A2', '59', 'cpmd',
         "59.A2.03 Tray 3 lifter drive assembly motor failure.\n"
         "Recommended action: Open the failing tray and remove all paper. Ensure the paper stack "
         "is below the tray full indicator. If the error persists, check the lifter drive motor "
         "and connector. Dispatch an onsite CE with a Cassette Tray if needed."),
        ('59.A2.04', '59.A2', '59', 'cpmd',
         "59.A2.04 Tray 4 lifter drive assembly motor failure.\n"
         "Recommended action: Open the failing tray and remove all paper. Ensure the paper stack "
         "is below the tray full indicator. If the error persists, check the lifter drive motor "
         "and connector. Dispatch an onsite CE with a Cassette Tray if needed."),
        ('59.A2.05', '59.A2', '59', 'cpmd',
         "59.A2.05 Tray 5 lifter drive assembly motor failure.\n"
         "Recommended action: Open the failing tray and remove all paper. Ensure the paper stack "
         "is below the tray full indicator. If the error persists, check the lifter drive motor "
         "and connector. Dispatch an onsite CE with a Cassette Tray if needed."),
        # 48.05.05 (e62655_cpmd): bullet em seção sem cabeçalho numérico; cross-family
        # guard impede lookahead (98.03.11 precede "Recommended action" na mesma área).
        ('48.05.05', '48.05', '48', 'e62655_cpmd',
         "48.05.05 Printer control panel locked up during Retrieve from Device Memory.\n"
         "Condition: After selecting print jobs from Device Memory, 'Verifying, Please Wait' "
         "displays and locks up. Event log may show 48.05.05 after power cycling.\n"
         "Recommended action: Turn the printer off and then on again. "
         "Make sure the firmware is the latest revision."),
        # 31.13.01 (e62655_service): aparece apenas em URL de vídeo dentro da seção wildcard
        # 31.13.yz — sem cabeçalho numérico próprio.
        ('31.13.01', '31.13', '31', 'e62655_service',
         "31.13.01 Jam in Document Feeder (ADF).\n"
         "Recommended action: Lift the document-feeder latch and open the document-feeder cover. "
         "Gently remove any jammed paper. Close the document-feeder cover. "
         "If the error persists, ensure the paper meets the document feeder (ADF) specifications."),
        # 99.09.67 (e62655_service): aparece em descrição de menu pré-boot — sem seção própria.
        ('99.09.67', '99.09', '99', 'e62655_service',
         "99.09.67 Disk is not bootable — firmware download required.\n"
         "Condition: Occurs after Format Disk or disk replacement. The system is not bootable "
         "after this action.\n"
         "Recommended action: A firmware download must be performed to return the system to a "
         "bootable state. Reload firmware using a USB flash drive via the Pre-boot menu."),
        # 99.09.68 (e62655_service, service): aparece apenas em descrição de opção de menu
        # ('grayed out unless the 99.09.68 error is displayed') — sem seção própria.
        ('99.09.68', '99.09', '99', 'e62655_service',
         "99.09.68 Secure disk clear required.\n"
         "Condition: Displayed when a new or replaced secure disk needs to be cleared/unlocked "
         "for use with this printer.\n"
         "Recommended action: Open the Pre-boot menu, select Manage Disk, then select "
         "Clear disk to enable using the device for job storage."),
        ('99.09.68', '99.09', '99', 'service',
         "99.09.68 Secure disk clear required.\n"
         "Condition: Displayed when a new or replaced secure disk needs to be cleared/unlocked "
         "for use with this printer.\n"
         "Recommended action: Open the Pre-boot menu, select Manage Disk, then select "
         "Clear disk to enable using the device for job storage."),
    ]
    hp_stub_count = 0
    for code, family, major, svc_key, text_body in _HP_STUBS:
        entry = {'key': svc_key, 'text': text_body, 'src': 'stub'}
        for k in (code, family, major):
            if not any(x['key'] == svc_key and x['text'] == text_body for x in index[k]):
                index[k].append(entry)
                hp_stub_count += 1
    print(f'  → {hp_stub_count} entradas de stub HP adicionadas')

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
    unique_sc = len([k for k in ricoh_errors if re.fullmatch(r'SC\d{3}-\d{2}', k)])
    print(f'  → {unique_sc} SC codes completos + {len(sc_groups)} grupos do service Ricoh')
    ricoh_table = extract_ricoh_condition_table(ricoh_svc_text)
    table_count = 0
    for code, entries in ricoh_table.items():
        for e in entries:
            if not any(x['key'] == 'ricoh_imc3000_service' and x['text'] == e['text'] for x in index[code]):
                index[code].append(e)
                table_count += 1
    print(f'  → {table_count} entradas da tabela de condições (sem prefixo SC: SC681/682/912 etc) (imc3000)')
    ricoh_detailed = extract_ricoh_sc_detailed_sections(ricoh_svc_text)
    detailed_count = 0
    for code, entries in ricoh_detailed.items():
        for e in entries:
            if not any(x['key'] == 'ricoh_imc3000_service' and x['text'] == e['text'] for x in index[code]):
                index[code].append(e)
                detailed_count += 1
    print(f'  → {detailed_count} entradas detalhadas "When SC" adicionadas (imc3000)')
    ricoh_ranges = expand_ricoh_ranges(ricoh_svc_text, 'ricoh_imc3000_service')
    range_count_imc = 0
    for code, entries in ricoh_ranges.items():
        for e in entries:
            if not any(x['key'] == 'ricoh_imc3000_service' and x['text'] == e['text'] for x in index[code]):
                index[code].append(e)
                range_count_imc += 1
    print(f'  → {range_count_imc} entradas de faixa expandidas (imc3000)')

    # ── Ricoh MP C3004/3504 Service Manual ────────────────────────────────────
    print('[errors] Ricoh MP C3004/3504 Service Manual')
    mpc_svc_path = PDF_SOURCES['ricoh_mpc3004_service'][0]
    mpc_svc_text = clean_text(pdf_to_text(mpc_svc_path))
    mpc_errors = extract_ricoh_sc_sections(mpc_svc_text, 'ricoh_mpc3004_service')
    mpc_groups = extract_ricoh_sc_groups(mpc_svc_text, 'ricoh_mpc3004_service')
    for src in [mpc_errors, mpc_groups]:
        for code, entries in src.items():
            for e in entries:
                if not any(x['key'] == 'ricoh_mpc3004_service' and x['text'] == e['text'] for x in index[code]):
                    index[code].append(e)
    mpc_unique = len([k for k in mpc_errors if re.fullmatch(r'SC\d{3}-\d{2}', k)])
    print(f'  → {mpc_unique} SC codes completos + {len(mpc_groups)} grupos do service MP C3004/3504')
    mpc_table = extract_ricoh_condition_table(mpc_svc_text, 'ricoh_mpc3004_service')
    mpc_table_count = 0
    for code, entries in mpc_table.items():
        for e in entries:
            if not any(x['key'] == 'ricoh_mpc3004_service' and x['text'] == e['text'] for x in index[code]):
                index[code].append(e)
                mpc_table_count += 1
    print(f'  → {mpc_table_count} entradas da tabela de condições (sem prefixo SC: SC681/682 etc) (mpc3004)')
    mpc_detailed = extract_ricoh_sc_detailed_sections(mpc_svc_text, 'ricoh_mpc3004_service')
    mpc_detailed_count = 0
    for code, entries in mpc_detailed.items():
        for e in entries:
            if not any(x['key'] == 'ricoh_mpc3004_service' and x['text'] == e['text'] for x in index[code]):
                index[code].append(e)
                mpc_detailed_count += 1
    print(f'  → {mpc_detailed_count} entradas detalhadas "When SC" adicionadas (mpc3004)')
    mpc_ranges = expand_ricoh_ranges(mpc_svc_text, 'ricoh_mpc3004_service')
    range_count_mpc = 0
    for code, entries in mpc_ranges.items():
        for e in entries:
            if not any(x['key'] == 'ricoh_mpc3004_service' and x['text'] == e['text'] for x in index[code]):
                index[code].append(e)
                range_count_mpc += 1
    print(f'  → {range_count_mpc} entradas de faixa expandidas (mpc3004)')

    # ── Ricoh SP 3710DN/SF Service Manual ─────────────────────────────────────
    print('[errors] Ricoh SP 3710DN/SF Service Manual')
    sp3710_svc_path = PDF_SOURCES['ricoh_sp3710_service'][0]
    sp3710_svc_text = clean_text(pdf_to_text(sp3710_svc_path))
    sp3710_errors = extract_sp3710_sc_sections(sp3710_svc_text, SP3710_SERVICE_KEY)
    sp3710_count = 0
    for code, entries in sp3710_errors.items():
        for e in entries:
            if not any(x['key'] == SP3710_SERVICE_KEY and x['text'] == e['text'] for x in index[code]):
                index[code].append(e)
                sp3710_count += 1
    print(f'  → {sp3710_count} SC codes do SP 3710 adicionados')

    # ── Ricoh MP 2555/3055/3555 Service Manual ───────────────────────────────
    print('[errors] Ricoh MP 2555/3055/3555 Service Manual')
    mp2555_path = PDF_SOURCES['ricoh_mp2555_service'][0]
    mp2555_errors = extract_mp2555_sc_sections(
        pdf_to_text_raw(mp2555_path),
        MP2555_SERVICE_KEY,
    )
    mp2555_count = 0
    for code, entries in mp2555_errors.items():
        for entry in entries:
            if not any(
                item['key'] == MP2555_SERVICE_KEY and item['text'] == entry['text']
                for item in index[code]
            ):
                index[code].append(entry)
                mp2555_count += 1
    print(f'  → {mp2555_count} códigos/grupos da série MP 2555 adicionados')

    # Stubs: códigos reais sem seção própria no PDF — texto derivado de menção inline.
    # Sobrevivem ao reindex por estarem no código, não no JSON.
    _RICOH_STUBS = [
        # SC375-02 (imc3000): mentioned inline in SC375 procedure ("if Vsg 0.3–2.2V, SC375-02 is issued")
        ('SC37502', 'SC375-02', 'SC375', 'ricoh_imc3000_service',
         "SC375-02: ID sensor output error — TM/ID sensor detected belt damage.\n"
         "Condition: Vsg output 0.3V ≤ Vsg ≤ 2.2V (belt damage range).\n"
         "Cause: Transfer belt damaged; TM/ID sensor defective.\n"
         "Solution: Check TM/ID sensor and transfer belt; replace belt if damaged. "
         "Refer to SC375-01 section for complete cause and solution procedure."),
        # SC543-03 (imc3000): inline mention in SC534-03 section (different lock threshold)
        ('SC54303', 'SC543-03', 'SC543', 'ricoh_imc3000_service',
         "SC543-03: Motor lock error.\n"
         "Condition: Lock signal not obtained for 140 consecutive attempts "
         "(higher threshold than other SC5xx fan codes: 50 attempts).\n"
         "Cause: Motor defective; connector disconnected; harness broken; IOB defective.\n"
         "Solution: Check connectors and harness; replace fan motor or IOB as needed."),
        # SC544-00 (both models): mentioned in fusing unit cancellation procedure note
        ('SC54400', 'SC544-00', 'SC544', 'ricoh_imc3000_service',
         "SC544-00: Fusing unit SC.\n"
         "Procedure: When canceling a fusing unit SC (SC544-00/SC554-00/SC564-00/SC574-00), "
         "perform part replacement per the prescribed procedure before restarting the machine.\n"
         "Cause: Fusing unit failure.\n"
         "Solution: Replace the fusing unit per the applicable replacement procedure "
         "before clearing the SC and restarting."),
        ('SC54400', 'SC544-00', 'SC544', 'ricoh_mpc3004_service',
         "SC544-00: Fusing unit SC.\n"
         "Procedure: When canceling a fusing unit SC (SC544-00/SC554-00/SC564-00/SC574-00), "
         "perform part replacement per the prescribed procedure before restarting the machine.\n"
         "Cause: Fusing unit failure.\n"
         "Solution: Replace the fusing unit per the applicable replacement procedure "
         "before clearing the SC and restarting."),
        # SC554-00 (both models): same fusing unit procedure
        ('SC55400', 'SC554-00', 'SC554', 'ricoh_imc3000_service',
         "SC554-00: Fusing unit SC.\n"
         "Procedure: When canceling a fusing unit SC (SC544-00/SC554-00/SC564-00/SC574-00), "
         "perform part replacement per the prescribed procedure before restarting the machine.\n"
         "Cause: Fusing unit failure.\n"
         "Solution: Replace the fusing unit per the applicable replacement procedure "
         "before clearing the SC and restarting."),
        ('SC55400', 'SC554-00', 'SC554', 'ricoh_mpc3004_service',
         "SC554-00: Fusing unit SC.\n"
         "Procedure: When canceling a fusing unit SC (SC544-00/SC554-00/SC564-00/SC574-00), "
         "perform part replacement per the prescribed procedure before restarting the machine.\n"
         "Cause: Fusing unit failure.\n"
         "Solution: Replace the fusing unit per the applicable replacement procedure "
         "before clearing the SC and restarting."),
        # SC852-02 (both models): inline note in SC845 section (ARFU firmware update failure)
        ('SC85202', 'SC852-02', 'SC852', 'ricoh_imc3000_service',
         "SC852-02: Firmware auto-update failure (ARFU) — HDD or memory issue.\n"
         "Condition: Firmware cannot be read or written normally; "
         "update cannot be completed even after 3 retries.\n"
         "Cause: Hardware abnormality of target board, HDD, or memory.\n"
         "Solution: For SC852-02, HDD and memory may cause the problem. "
         "Replace the HDD or memory if the SC cannot be recovered by "
         "replacing the controller board."),
        ('SC85202', 'SC852-02', 'SC852', 'ricoh_mpc3004_service',
         "SC852-02: Firmware auto-update failure (ARFU) — HDD or memory issue.\n"
         "Condition: Firmware cannot be read or written normally; "
         "update cannot be completed even after 3 retries.\n"
         "Cause: Hardware abnormality of target board, HDD, or memory.\n"
         "Solution: For SC852-02, HDD and memory may cause the problem. "
         "Replace the HDD or memory if the SC cannot be recovered by "
         "replacing the controller board."),
    ]
    stub_count = 0
    for full_nh, full_h, group, svc_key, text_body in _RICOH_STUBS:
        entry = {'key': svc_key, 'text': text_body, 'src': 'stub'}
        for code in (full_nh, full_h):
            if not any(x['key'] == svc_key and x['text'] == text_body for x in index[code]):
                index[code].append(entry)
                stub_count += 1
        if not any(x['key'] == svc_key for x in index[group]):
            index[group].append(entry)
    print(f'  → {stub_count} entradas de stub adicionadas (Ricoh)')

    # Propagação reversa: copia entradas de grupo (SC370) para subcódigos (SC370-03, SC37003)
    xref_count = 0
    for src_detailed, svc_key in [(ricoh_detailed, 'ricoh_imc3000_service'),
                                   (mpc_detailed, 'ricoh_mpc3004_service')]:
        for code, entries in src_detailed.items():
            gm = re.match(r'^SC(\d{3})$', code)
            if not gm:
                continue
            gn = gm.group(1)
            for existing_key in list(index.keys()):
                if re.match(rf'^SC{gn}[-\d]', existing_key) and existing_key != code:
                    for e in entries:
                        if not any(x['key'] == svc_key and x['text'] == e['text'] for x in index[existing_key]):
                            index[existing_key].append(dict(e, src='xref'))
                            xref_count += 1
    if xref_count:
        print(f'  → {xref_count} entradas propagadas de grupos SC para subcódigos')

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

    # Propagar descrição entre irmãos curtos (HP XX.YY e Ricoh SCxxx)
    sib_count = propagate_sibling_descriptions(index)
    if sib_count:
        print(f'  → {sib_count} entradas propagadas de irmãos (HP XX.YY + Ricoh SCxxx)')

    return dict(index)

# ─── Dedup e limpeza final ────────────────────────────────────────────────────

def dedup_entries(entries: list) -> list:
    """Remove entradas duplicadas preservando ordem."""
    seen = set()
    result = []
    for e in entries:
        # Inclui len para distinguir sintéticos (desc+ação) do original (só desc)
        sig = (e['key'], len(e['text']), e['text'][:100])
        if sig not in seen:
            seen.add(sig)
            result.append(e)
    return result


# Regex para placeholders wildcard HP (ex: 13.WX.YZ, 40.WX) — não são códigos reais
WILDCARD_CODE_RE = re.compile(r'\.[WXYZ]([WXYZ.]|$)', re.IGNORECASE)


def propagate_sibling_descriptions(index: dict) -> int:
    """
    Propaga descrição do irmão mais rico para irmãos curtos no mesmo grupo.

    Resolve o truncamento quando Recommended action / descrição compartilhada vem
    APÓS o último irmão na tabela do manual (só o último captura o bloco).

    HP:    agrupa por XX.YY → sintetiza "desc própria + ação do rico"
    Ricoh: agrupa por SCxxx → sintetiza "linha própria + texto completo do rico"
    """
    count = 0

    # ── HP: grupos XX.YY ─────────────────────────────────────────────────────
    HP_FULL_RE = re.compile(r'^(\d{2}\.[0-9A-F]{1,2})\.([0-9A-F]{2})$', re.IGNORECASE)
    hp_groups: dict[str, list[str]] = defaultdict(list)
    for key in list(index.keys()):
        if HP_FULL_RE.match(key):
            hp_groups[key.rsplit('.', 1)[0]].append(key)

    HP_ACTION_RE = re.compile(
        r'(?:Recommended action|Clear the|Follow these troubleshoot|'
        r'Check the output|Clear paper|Turn the printer)',
        re.IGNORECASE
    )
    HP_COMPLETE_RE = re.compile(
        r'no action necessary|informational|event code only|log only',
        re.IGNORECASE
    )

    for prefix, keys in hp_groups.items():
        # Preferir irmão com trigger de ação explícito (pode não ser o mais longo)
        candidates = sorted(
            keys,
            key=lambda k: max((len(e['text']) for e in index.get(k, [])), default=0),
            reverse=True
        )
        rich_entry = None
        action_m = None
        for cand_key in candidates:
            for e in sorted(index.get(cand_key, []), key=lambda e: -len(e['text'])):
                if len(e['text']) < 400:
                    break
                m = HP_ACTION_RE.search(e['text'])
                if m:
                    rich_entry = e
                    action_m = m
                    break
            if rich_entry:
                break
        if not rich_entry:
            continue
        action_block = rich_entry['text'][action_m.start():][:4000]

        for key in keys:
            own_entries = index.get(key, [])
            if not own_entries:
                continue
            own_best = max(own_entries, key=lambda e: len(e['text']))
            # Entradas "no action necessary" são completas apesar de curtas
            if HP_COMPLETE_RE.search(own_best['text']) and len(own_best['text']) > 100:
                continue
            if len(own_best['text']) >= 300:
                continue  # já suficiente

            own_desc = own_best['text'].rstrip(' ●\n')
            synthetic = own_desc + '\n\n' + action_block
            new_entry = {'key': own_best['key'], 'text': synthetic, 'src': 'propagated'}

            if not any(e['text'] == synthetic for e in index[key]):
                index[key].append(new_entry)
                count += 1

            # Propagar também para prefixos XX.YY e XX
            parts = key.split('.')
            for pfx in ['.'.join(parts[:2]), parts[0]]:
                if pfx in index and not any(e['text'] == synthetic for e in index[pfx]):
                    index[pfx].append(new_entry)
                    count += 1

    # ── Ricoh: grupos SCxxx ───────────────────────────────────────────────────
    RICOH_FULL_RE = re.compile(r'^SC(\d{3})-(\d{2})$')
    ricoh_groups: dict[str, list[str]] = defaultdict(list)
    for key in list(index.keys()):
        m = RICOH_FULL_RE.match(key)
        if m:
            ricoh_groups['SC' + m.group(1)].append(key)

    for group, keys in ricoh_groups.items():
        rich_key = max(
            keys,
            key=lambda k: max((len(e['text']) for e in index.get(k, [])
                               if e.get('key') not in PROPAGATION_EXCLUDED_SERVICE_KEYS), default=0)
        )
        rich_entries = [
            e for e in index.get(rich_key, [])
            if e.get('key') not in PROPAGATION_EXCLUDED_SERVICE_KEYS
        ]
        if not rich_entries:
            continue
        rich_entry = max(rich_entries, key=lambda e: len(e['text']))
        if len(rich_entry['text']) < 300:
            continue

        for key in keys:
            own_entries = [
                e for e in index.get(key, [])
                if e.get('key') not in PROPAGATION_EXCLUDED_SERVICE_KEYS
            ]
            if not own_entries:
                continue
            own_best = max(own_entries, key=lambda e: len(e['text']))
            if len(own_best['text']) >= 120:
                continue  # já OK

            own_line = own_best['text'].rstrip('\n')
            synthetic = own_line + '\n\n' + rich_entry['text']
            new_entry = {'key': own_best['key'], 'text': synthetic, 'src': 'propagated'}

            if not any(e['text'] == synthetic for e in index[key]):
                index[key].append(new_entry)
                count += 1

            # Variante sem hífen (SC22001)
            no_h = key.replace('-', '')
            if no_h in index and no_h != key:
                if not any(e['text'] == synthetic for e in index[no_h]):
                    index[no_h].append(new_entry)
                    count += 1

    return count


def finalize_error_index(raw: dict) -> dict:
    """
    Pós-processa o índice de erros:
    - Descarta placeholders wildcard HP (ex: 13.WX.YZ, 40.WX)
    - Remove duplicatas e entradas contaminadas (índice remissivo / ToC)
    - Limita a 5 entradas por código
    - Ordena: entradas com texto mais longo (mais contexto) primeiro
    """
    final = {}
    filtered_out = 0
    wildcards = 0
    for code, entries in raw.items():
        if WILDCARD_CODE_RE.search(code):
            wildcards += 1
            continue
        entries = dedup_entries(entries)
        # Filtrar entradas de índice remissivo / ToC que escaparam
        clean = [e for e in entries
                 if not is_toc_chunk(e['text']) and not is_book_index_chunk(e['text'])]
        filtered_out += len(entries) - len(clean)
        if not clean:
            continue
        clean.sort(key=lambda x: -len(x['text']))
        # Per-key coverage: guarantee at least 1 entry per service_key that contributed
        # entries. This prevents a short-but-unique key entry (e.g. e62655_cpmd/111 chars)
        # from being cut off when longer entries from other keys fill the top-5 slots.
        per_key_best = {}
        for e in clean:
            if e['key'] not in per_key_best:
                per_key_best[e['key']] = e
        coverage = sorted(per_key_best.values(), key=lambda x: -len(x['text']))
        coverage_ids = {id(e) for e in coverage}
        extras = [e for e in clean if id(e) not in coverage_ids]
        final[code] = (coverage + extras)[:5]
    if wildcards:
        print(f'  [finalize] {wildcards} placeholders wildcard removidos')
    if filtered_out:
        print(f'  [finalize] {filtered_out} entradas contaminadas removidas')
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

def build_embeddings_index():
    """Gera embeddings_index.json com vetores para busca semântica.
    Requer: pip install sentence-transformers
    Executar uma vez localmente e commitar no repo do backend (manuais-hp).
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print('ERRO: sentence-transformers não instalado.')
        print('  pip install sentence-transformers')
        sys.exit(1)

    print('TechGuide IA — Embeddings Generator')
    print('=' * 50)
    print('Modelo: paraphrase-multilingual-MiniLM-L12-v2')

    if not OUT_SEARCH.exists():
        print(f'ERRO: {OUT_SEARCH} não encontrado. Rode sem --embeddings primeiro.')
        sys.exit(1)

    print(f'\nCarregando {OUT_SEARCH}…')
    with open(OUT_SEARCH, encoding='utf-8') as f:
        search_index = json.load(f)

    total_chunks = sum(len(v) for v in search_index.values())
    print(f'  {len(search_index)} chaves, {total_chunks} chunks no total')

    print('\nCarregando modelo (download automático na primeira execução)…')
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

    result = {}
    for i, (key, chunks) in enumerate(search_index.items(), 1):
        print(f'  [{i}/{len(search_index)}] {key}: {len(chunks)} chunks…', flush=True)
        texts = [c['t'] for c in chunks]
        vecs = model.encode(texts, batch_size=64, show_progress_bar=False, normalize_embeddings=True)
        result[key] = [{'t': t, 'e': v.tolist()} for t, v in zip(texts, vecs)]

    out_path = Path('embeddings_index.json')
    print(f'\nSalvando {out_path}…')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f'  → {size_mb:.1f} MB')
    print('\n✓ Embeddings gerados! Commitar embeddings_index.json no repo gptmaycondb/manuais-hp.')


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
    if '--embeddings' in sys.argv:
        build_embeddings_index()
    else:
        main()
