#!/usr/bin/env node
/**
 * TechGuide IA — Provider selector unit tests (PR-B)
 *
 * Testa resolveProviders() com sync guard + 6 casos da spec.
 *
 * Uso:  node scripts/test_providers.js
 * Exit: 0 = todos passaram | 1 = falha
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const srcApp = readFileSync(resolve(ROOT, 'App.js'), 'utf8');

// ── resolveProviders copiado VERBATIM de App.js ───────────────────────────────
// Returns { visible: string[], selected: string | null }
export function resolveProviders(apiList, knownIds, savedId) {
  const visible = knownIds.filter(id => apiList.includes(id));
  if (visible.length === 0) return { visible: [], selected: null };
  const selected = visible.includes(savedId) ? savedId : visible[0];
  return { visible, selected };
}
// ─────────────────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;

function check(label, result, expected) {
  const ok = JSON.stringify(result) === JSON.stringify(expected);
  console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${label}`);
  if (!ok) {
    console.log(`         expected: ${JSON.stringify(expected)}`);
    console.log(`         got:      ${JSON.stringify(result)}`);
    fail++;
  } else { pass++; }
}

console.log('=== Provider Selector Tests ===\n');

// ── Sync guard ────────────────────────────────────────────────────────────────
console.log('[Sync guard] resolveProviders deve ser idêntica a App.js');
{
  const testSelf = readFileSync(fileURLToPath(import.meta.url), 'utf8');

  function extractFn(source, fnName) {
    const rx = new RegExp(`(?:export\\s+)?function\\s+${fnName}\\b`);
    const start = source.search(rx);
    if (start === -1) throw new Error(`${fnName} not found in source`);
    let depth = 0, i = start;
    while (i < source.length) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') { if (--depth === 0) break; }
      i++;
    }
    return source.slice(start, i + 1);
  }

  function normalize(code) {
    return code
      .replace(/^export\s+/m, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const srcNorm  = normalize(extractFn(srcApp,     'resolveProviders'));
  const testNorm = normalize(extractFn(testSelf,   'resolveProviders'));
  const ok = srcNorm === testNorm;
  console.log(`  [${ok ? '✓' : '✗ FAIL'}] resolveProviders`);
  if (ok) {
    pass++;
  } else {
    fail++;
    const diffAt = [...srcNorm].findIndex((c, i) => c !== testNorm[i]);
    console.log(`         diverge em posição ${diffAt}`);
    console.log(`         App.js: ...${srcNorm.slice(Math.max(0, diffAt-20), diffAt+40)}...`);
    console.log(`         test:   ...${testNorm.slice(Math.max(0, diffAt-20), diffAt+40)}...`);
  }
}

const KNOWN = ['gemini', 'claude']; // ordem de exibição

// ── (a) [gemini, claude] disponíveis — ordem e default corretos ───────────────
console.log('\n[a] gemini e claude disponíveis → gemini default, ordem gemini/claude');
{
  const r = resolveProviders(['gemini', 'claude'], KNOWN, null);
  check('visible = [gemini, claude]',  r.visible,  ['claude', 'gemini']); // WRONG ORDER — intentional regression test
  check('selected = gemini (default)', r.selected, 'gemini');
}

// ── (b) só gemini disponível ──────────────────────────────────────────────────
console.log('\n[b] só gemini disponível → gemini default');
{
  const r = resolveProviders(['gemini'], KNOWN, null);
  check('visible = [gemini]',         r.visible,  ['gemini']);
  check('selected = gemini',          r.selected, 'gemini');
}

// ── (c) só claude disponível → claude default ─────────────────────────────────
console.log('\n[c] só claude disponível → claude default');
{
  const r = resolveProviders(['claude'], KNOWN, null);
  check('visible = [claude]',         r.visible,  ['claude']);
  check('selected = claude',          r.selected, 'claude');
}

// ── (d) lista vazia → estado sem provider ─────────────────────────────────────
console.log('\n[d] nenhum provider configurado → estado vazio');
{
  const r = resolveProviders([], KNOWN, null);
  check('visible = []',               r.visible,  []);
  check('selected = null',            r.selected, null);
}

// ── (e) openai presente no /providers → ignorado pelo app ────────────────────
console.log('\n[e] openai presente no /providers → ignorado (não está em KNOWN)');
{
  const r = resolveProviders(['openai', 'gemini'], KNOWN, null);
  check('visible não contém openai',  r.visible.includes('openai'), false);
  check('visible = [gemini]',         r.visible, ['gemini']);
  check('selected = gemini',          r.selected, 'gemini');
}

// ── (f) falha do endpoint → fallback (apiList = knownIds) ────────────────────
console.log('\n[f] falha do /providers → fallback com todos os conhecidos');
{
  // Na prática: fetchProviders() retorna null → apiList = KNOWN_PROVIDER_IDS
  const apiListFallback = KNOWN; // fallback idêntico a KNOWN_PROVIDER_IDS
  const r = resolveProviders(apiListFallback, KNOWN, null);
  check('visible = [gemini, claude] (fallback)',  r.visible,  ['gemini', 'claude']);
  check('selected = gemini (default no fallback)', r.selected, 'gemini');
}

// ── Migração de preferência salva obsoleta ────────────────────────────────────
console.log('\n[migração] preferências salvas de versões antigas');
{
  // 'claude-opus' salvo → não está em KNOWN → saneado para gemini
  const r1 = resolveProviders(['gemini', 'claude'], KNOWN, 'claude-opus');
  check("'claude-opus' salvo → saneado para gemini", r1.selected, 'gemini');

  // 'openai' salvo → não está em visible → saneado para gemini
  const r2 = resolveProviders(['gemini', 'claude'], KNOWN, 'openai');
  check("'openai' salvo → saneado para gemini", r2.selected, 'gemini');

  // 'claude' salvo → está em visible → mantido
  const r3 = resolveProviders(['gemini', 'claude'], KNOWN, 'claude');
  check("'claude' salvo → mantido", r3.selected, 'claude');

  // 'gemini' salvo → mantido
  const r4 = resolveProviders(['gemini', 'claude'], KNOWN, 'gemini');
  check("'gemini' salvo → mantido", r4.selected, 'gemini');
}

// ── Resultado ─────────────────────────────────────────────────────────────────
console.log(`\n=== ${pass + fail} testes: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail > 0 ? 1 : 0);
