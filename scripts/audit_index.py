#!/usr/bin/env python3
"""
TechGuide IA — Auditor de qualidade do error_codes_index.json

Testa TODOS os códigos HP e Ricoh sem exceção e classifica cada um:
  OK          — texto suficiente com ação/descrição útil
  short       — texto < limiar mínimo
  noAction    — sem palavras-chave de ação (informativo-only pode ser aceitável)
  fixable     — curto MAS existe irmão rico (indica regressão no build)

Uso:
  python3 scripts/audit_index.py              # relatório completo
  python3 scripts/audit_index.py --fail-short # retorna exit code 1 se houver short/fixable
"""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

INDEX_PATH = Path(__file__).parent.parent / 'assets' / 'error_codes_index.json'

# ─── Critérios ────────────────────────────────────────────────────────────────

HP_MIN_LEN   = 200   # chars mínimos para um código HP real ser "OK"
RICOH_MIN_LEN = 120  # chars mínimos para um código Ricoh ser "OK"
RICH_SIBLING  = 400  # tamanho que define "irmão rico" (fixable se curto tiver um)

HAS_ACTION_RE = re.compile(
    r'(solution|cause|recommended action|troubleshoot|replace|check |execute|'
    r'clear the|turn the|open the|refer the|refer to|remove any|no action|'
    r'informational|disconnection|not output|reload|does not reload|'
    r'failed to reach|leading edge|synchronization)',
    re.IGNORECASE,
)

# Regex para famílias
SC_RE       = re.compile(r'^SC\d{3}')
HP_FULL_RE  = re.compile(r'^(\d{2}\.[0-9A-F]{1,2})\.([0-9A-F]{2})$', re.IGNORECASE)
HP_PREFIX_RE = re.compile(r'^\d{2}(\.[0-9A-F]{1,2})?$', re.IGNORECASE)
PSEUDO_RE   = re.compile(r'^(PCU-YIELD|PM-PARTS|VIDA-UTIL)')
WILDCARD_RE = re.compile(r'\.[WXYZ]([WXYZ.]|$)', re.IGNORECASE)

# ─── Helpers ─────────────────────────────────────────────────────────────────

def best(entries):
    return max(entries, key=lambda e: len(e['text']))


NO_ACTION_RE = re.compile(
    r'no action necessary|informational|event code only|log only|no action needed',
    re.IGNORECASE
)


def classify(code: str, entries: list, min_len: int, peer_max: int) -> str:
    x = best(entries)
    ln = len(x['text'])
    if ln < min_len:
        # Entradas que explicitamente dizem "no action" são completas apesar de curtas
        if NO_ACTION_RE.search(x['text']) and ln > 80:
            return 'OK'
        # Entradas com ação/solução explícita e texto suficiente são OK mesmo abaixo do limiar
        if HAS_ACTION_RE.search(x['text']) and ln > 150:
            return 'OK'
        return 'fixable' if peer_max >= RICH_SIBLING else 'short'
    if not HAS_ACTION_RE.search(x['text']):
        return 'noAction'
    return 'OK'


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    fail_mode = '--fail-short' in sys.argv

    idx: dict = json.loads(INDEX_PATH.read_text(encoding='utf-8'))

    hp_full: dict[str, list] = {}
    hp_prefix: dict[str, list] = {}
    ricoh: dict[str, list] = {}
    pseudo: dict[str, list] = {}
    other: dict[str, list] = {}

    for code, entries in idx.items():
        if WILDCARD_RE.search(code):
            continue  # placeholders — não auditados
        if PSEUDO_RE.match(code):
            pseudo[code] = entries
        elif SC_RE.match(code):
            ricoh[code] = entries
        elif HP_FULL_RE.match(code):
            hp_full[code] = entries
        elif HP_PREFIX_RE.match(code):
            hp_prefix[code] = entries
        else:
            other[code] = entries

    # ── HP real (XX.YY.ZZ) ──
    hp_groups: dict[str, list[str]] = defaultdict(list)
    for code in hp_full:
        hp_groups[code.rsplit('.', 1)[0]].append(code)

    hp_stats = defaultdict(list)
    for prefix, siblings in hp_groups.items():
        peer_max = max(max(len(e['text']) for e in hp_full[k]) for k in siblings)
        for code in siblings:
            cls = classify(code, hp_full[code], HP_MIN_LEN, peer_max)
            hp_stats[cls].append(code)

    # ── Ricoh SCxxx-yy ──
    ricoh_hyphen = {k: v for k, v in ricoh.items() if re.match(r'^SC\d{3}-\d{2}$', k)}
    ricoh_groups: dict[str, list[str]] = defaultdict(list)
    for code in ricoh_hyphen:
        ricoh_groups['SC' + code[2:5]].append(code)

    ricoh_stats = defaultdict(list)
    for group, siblings in ricoh_groups.items():
        peer_max = max(max(len(e['text']) for e in ricoh_hyphen[k]) for k in siblings)
        for code in siblings:
            cls = classify(code, ricoh_hyphen[code], RICOH_MIN_LEN, peer_max)
            ricoh_stats[cls].append(code)

    # ── Relatório ──
    print('=' * 60)
    print('AUDITORIA  error_codes_index.json')
    print('=' * 60)
    print(f'Total chaves: {len(idx)}')
    print(f'HP (XX.YY.ZZ): {len(hp_full)}  |  prefixos HP: {len(hp_prefix)}')
    print(f'Ricoh (SC-com-hífen): {len(ricoh_hyphen)} de {len(ricoh)} SC totais')
    print()

    def report(label, stats, show_limit=20):
        ok = len(stats['OK'])
        sh = len(stats['short'])
        fx = len(stats['fixable'])
        na = len(stats['noAction'])
        total = ok + sh + fx + na
        pct = 100 * ok / max(total, 1)
        print(f'── {label} ({total} códigos) ──')
        print(f'   OK: {ok} ({pct:.0f}%)  |  fixable: {fx}  |  short: {sh}  |  noAction: {na}')
        if fx:
            samp = stats['fixable'][:show_limit]
            print(f'   FIXABLE (irmão existe, build pode ter regredido): {", ".join(samp)}')
        if sh:
            samp = stats['short'][:show_limit]
            print(f'   SHORT (manual genuinamente terso): {", ".join(samp)}')
        if na:
            samp = stats['noAction'][:show_limit]
            print(f'   noAction (pode ser aceitável): {", ".join(samp[:10])}{"..." if len(samp)>10 else ""}')
        print()

    report('HP (XX.YY.ZZ)', hp_stats)
    report('Ricoh SC (com hífen)', ricoh_stats)

    # ── Resultado ──
    fixable = len(hp_stats['fixable']) + len(ricoh_stats['fixable'])
    shorts  = len(hp_stats['short'])   + len(ricoh_stats['short'])

    if fixable == 0 and shorts <= 2:
        print('✅ Qualidade OK — sem regressões detectadas.')
    else:
        print(f'⚠  {fixable} fixable + {shorts} short detectados.')

    if fail_mode and (fixable > 0):
        sys.exit(1)


if __name__ == '__main__':
    main()
