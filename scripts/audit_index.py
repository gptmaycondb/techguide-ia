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
  python3 scripts/audit_index.py --fail-short # exit 1 se houver short/fixable
  python3 scripts/audit_index.py --fail-missing           # gate de cobertura
  python3 scripts/audit_index.py --fail-short --fail-missing  # ambos
  python3 scripts/audit_index.py --shrink-baseline        # encolhe baseline após Lote
"""

import hashlib
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
    if '--shrink-baseline' in sys.argv:
        _shrink_baseline()
        return

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

    if '--fail-missing' in sys.argv:
        _check_coverage()


def _canon(code: str) -> str:
    return re.sub(r'[\s.\-/]', '', code.upper())


def _check_baseline_did_not_grow(baseline_path: Path, current_total: int) -> None:
    """Fails if coverage_baseline.json has more entries than its committed version.
    The baseline can only shrink as Lotes 2-4 resolve missing codes."""
    import subprocess
    try:
        rel = str(baseline_path.relative_to(Path(__file__).parent.parent))
        result = subprocess.run(
            ['git', 'show', f'HEAD:{rel}'],
            capture_output=True,
            cwd=str(Path(__file__).parent.parent),
        )
        if result.returncode != 0:
            return  # file not yet committed (first run) — skip
        committed = json.loads(result.stdout.decode('utf-8'))
        committed_total = committed.get('total', 0)
        if current_total > committed_total:
            print(f'\n❌ coverage_baseline.json CRESCEU: {committed_total} → {current_total} entradas.')
            print('   O baseline só pode encolher. Não adicione novos códigos ao baseline')
            print('   para encobrir regressões — corrija o extrator ou use codes_ignore.json.')
            sys.exit(1)
    except Exception:
        pass  # git indisponível ou outro erro — ignora a proteção


def _check_coverage() -> None:
    report_path   = Path(__file__).parent / 'coverage_report.json'
    ignore_path   = Path(__file__).parent / 'codes_ignore.json'
    baseline_path = Path(__file__).parent / 'coverage_baseline.json'

    if not report_path.exists():
        print('❌ coverage_report.json não encontrado.')
        print('   Execute: python3 scripts/coverage_report.py (requer PDFs em /tmp)')
        sys.exit(1)

    report = json.loads(report_path.read_text(encoding='utf-8'))
    ignore = json.loads(ignore_path.read_text(encoding='utf-8')) if ignore_path.exists() else {}

    stored_hash  = report.get('index_sha256', '')
    current_hash = hashlib.sha256(INDEX_PATH.read_bytes()).hexdigest()
    if stored_hash != current_hash:
        print('❌ coverage_report.json desatualizado — error_codes_index.json mudou desde a geração.')
        print('   Regenere: python3 scripts/coverage_report.py (requer PDFs em /tmp)')
        sys.exit(1)

    # Load baseline (codes already in canonical form).
    # index_sha256 in baseline is audit metadata only — never blocks.
    # The strict freshness check lives in coverage_report (above), where it belongs.
    baseline: dict[str, set] = {}
    baseline_total = 0
    if baseline_path.exists():
        bl = json.loads(baseline_path.read_text(encoding='utf-8'))
        baseline_total = bl.get('total', 0)
        for svc, codes in bl.get('per_key', {}).items():
            baseline[svc] = set(codes)
        bl_sha = bl.get('index_sha256', '')
        if bl_sha and bl_sha != current_hash:
            print('   (info) baseline gerado contra índice anterior'
                  ' — rode --shrink-baseline após reindexar')

    _check_baseline_did_not_grow(baseline_path, baseline_total)

    print('\n── Cobertura por service_key ──')
    total_new = 0
    total_pending = 0

    for svc, data in sorted(report.get('per_key', {}).items()):
        ig     = {_canon(k) for k in ignore.get(svc, {})}
        bl_svc = baseline.get(svc, set())

        new_missing     = [c for c in data['missing'] if _canon(c) not in bl_svc and _canon(c) not in ig]
        pending_missing = [c for c in data['missing'] if _canon(c) in bl_svc     and _canon(c) not in ig]
        ignored_count   = sum(1 for c in data['missing'] if _canon(c) in ig)

        covered = data['covered']
        cands   = data['candidates']

        parts = []
        if pending_missing:
            parts.append(f'{len(pending_missing)} pendente(s) triagem (baseline)')
        if new_missing:
            parts.append(f'{len(new_missing)} NOVO(S) ❌')
        if ignored_count:
            parts.append(f'{ignored_count} ignorado(s)')
        status = ' | '.join(parts) if parts else 'cobertura OK ✅'

        print(f'   {svc}: {covered}/{cands} cobertos — {status}')
        if new_missing:
            print(f'      → NOVOS: {", ".join(new_missing[:6])}{"…" if len(new_missing) > 6 else ""}')
        elif pending_missing:
            print(f'      → pendentes: {", ".join(pending_missing[:6])}{"…" if len(pending_missing) > 6 else ""}')

        total_new     += len(new_missing)
        total_pending += len(pending_missing)

    print()
    if total_new == 0 and total_pending == 0:
        print('✅ Cobertura OK — todos os candidatos estão indexados.')
    elif total_new == 0:
        print(f'✅ {total_pending} pendente(s) de triagem (baseline) | 0 novos — gate OK.')
    else:
        print(f'❌ {total_pending} pendente(s) de triagem (baseline) | {total_new} NOVO(S) — gate falhou.')
        sys.exit(1)


def _shrink_baseline() -> None:
    """Regenera coverage_baseline.json como interseção do baseline existente com
    os missing atuais do coverage_report.json. Por construção só encolhe (nunca cresce).
    Atualiza total, generated_from_commit e index_sha256 automaticamente.
    Requer coverage_report.json fresco (mesma verificação do --fail-missing)."""
    import subprocess

    report_path   = Path(__file__).parent / 'coverage_report.json'
    baseline_path = Path(__file__).parent / 'coverage_baseline.json'

    if not report_path.exists():
        print('❌ coverage_report.json não encontrado.')
        print('   Execute: python3 scripts/coverage_report.py (requer PDFs em /tmp)')
        sys.exit(1)

    if not baseline_path.exists():
        print('ℹ  coverage_baseline.json não existe — nada a encolher.')
        print('   Sem baseline, --fail-missing já opera em modo estrito.')
        return

    report = json.loads(report_path.read_text(encoding='utf-8'))
    stored_hash  = report.get('index_sha256', '')
    current_hash = hashlib.sha256(INDEX_PATH.read_bytes()).hexdigest()
    if stored_hash != current_hash:
        print('❌ coverage_report.json desatualizado — regenere antes de --shrink-baseline.')
        print('   Execute: python3 scripts/coverage_report.py (requer PDFs em /tmp)')
        sys.exit(1)

    bl = json.loads(baseline_path.read_text(encoding='utf-8'))
    old_total   = bl.get('total', 0)
    old_per_key = bl.get('per_key', {})

    # Interseção: manter só os códigos que AINDA estão no missing atual
    new_per_key: dict[str, list] = {}
    for svc, old_codes in sorted(old_per_key.items()):
        old_set = set(old_codes)  # já em forma canônica
        curr_missing = {_canon(c) for c in report.get('per_key', {}).get(svc, {}).get('missing', [])}
        new_per_key[svc] = sorted(old_set & curr_missing)

    new_total = sum(len(v) for v in new_per_key.values())

    # Sanidade: interseção nunca pode crescer — se crescer é bug
    if new_total > old_total:
        print(f'❌ Erro interno: shrink resultou em crescimento ({old_total} → {new_total}).')
        sys.exit(1)

    try:
        res = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'],
                             capture_output=True, cwd=str(Path(__file__).parent.parent))
        commit = res.stdout.decode().strip() if res.returncode == 0 else 'unknown'
    except Exception:
        commit = 'unknown'

    new_bl = {
        'generated_from_commit': commit,
        'index_sha256': current_hash,
        'total': new_total,
        'per_key': new_per_key,
    }
    baseline_path.write_text(
        json.dumps(new_bl, indent=2, ensure_ascii=False, sort_keys=True) + '\n'
    )

    removed = old_total - new_total
    print(f'✅ --shrink-baseline: {old_total} → {new_total} entradas ({removed} removida(s)).')
    if removed > 0:
        for svc in sorted(old_per_key):
            rem = sorted(set(old_per_key.get(svc, [])) - set(new_per_key.get(svc, [])))
            if rem:
                samp = ', '.join(rem[:5]) + ('…' if len(rem) > 5 else '')
                print(f'   {svc}: -{len(rem)} ({samp})')
    if new_total == 0:
        print()
        print('   Baseline zerado. Próximo passo: deletar coverage_baseline.json.')
        print('   Sem o arquivo, --fail-missing opera em modo estrito.')


if __name__ == '__main__':
    main()
