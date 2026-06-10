#!/usr/bin/env node
/**
 * TechGuide IA — Findability test suite
 *
 * Verifica que searchErrorCode() encontra códigos de erro em todos os índices
 * do modelo (cross-key) e NÃO vaza entre modelos (cross-model isolation).
 *
 * Uso:  node scripts/test_findability.js
 * Exit: 0 = todos passaram | 1 = falha
 *
 * Integrado em /auditoria e futuro gate de CI (PR-4).
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const errorCodesData = JSON.parse(
  readFileSync(resolve(ROOT, 'assets/error_codes_index.json'), 'utf8')
);

// ── searchErrorCode copiado VERBATIM de src/search.js ────────────────────────
function wildcardMatchHP(pattern, code) {
  if (!/[XYZ]/.test(pattern)) return false;
  const regex = new RegExp(
    '^' + pattern.replace(/\./g, '\\.').replace(/[XYZ]/g, '[0-9A-Fa-f]') + '$',
    'i'
  );
  return regex.test(code);
}

function searchErrorCode(query, indexKey) {
  const keySet = indexKey
    ? new Set(Array.isArray(indexKey) ? indexKey : [indexKey])
    : null;
  const matchKey = keySet ? e => keySet.has(e.key) : () => true;

  const q = query.trim().replace(/\b(SC)\s+(\d)/gi, '$1$2');
  const codes = [
    ...(q.toUpperCase().match(/SC\d{3,6}(?:-\d{2})?/g) || []),
    ...(q.match(/\b\d{2}\.\d{2}(?:\.\d{2}(?:\.\d{2})?)?\b/g) || []),
    ...(q.toUpperCase().match(/\b\d{2}\.[0-9A-F]{2,3}(?:\.[0-9A-F]{2})?\b/g) || []),
    ...(q.toUpperCase().match(/\bJ\d{3,6}\b/g) || []),
  ];
  const direct = q.toUpperCase().replace(/^(ERRO|ERROR|CODIGO|CODE|FALHA)\s+/i, '').trim();
  const toTry = codes.length > 0 ? codes : [direct];

  const raw = [];
  for (const code of toTry) {
    if (errorCodesData[code]) {
      const filtered = errorCodesData[code].filter(matchKey);
      if (filtered.length) raw.push(...filtered.map(e => e.text));
    } else {
      for (const [k, entries] of Object.entries(errorCodesData)) {
        if (k.startsWith(code) || (code.length >= 4 && k.includes(code)) || wildcardMatchHP(k, code)) {
          const filtered = entries.filter(matchKey);
          if (filtered.length) raw.push(...filtered.map(e => e.text));
          if (raw.length >= 5) break;
        }
      }
    }
    if (raw.length >= 5) break;
  }
  const seen = new Set();
  const results = [];
  for (const t of raw) {
    const sig = t.slice(0, 80);
    if (!seen.has(sig)) { seen.add(sig); results.push(t); }
    if (results.length >= 5) break;
  }
  return results;
}
// ─────────────────────────────────────────────────────────────────────────────

// searchKeys espelham src/data.js
const KEYS = {
  E52645:      ['e52645_guia', 'cpmd', 'service'],
  E62655:      ['e62655_guia', 'e62655_service', 'e62655_cpmd'],
  imc3000:     ['ricoh_imc3000_service', 'ricoh_imc3000_guia', 'ricoh_imc3000_parts'],
  mpc3004:     ['ricoh_mpc3004_service', 'ricoh_mpc3004_guia'],
};

let pass = 0, fail = 0;

function expect(label, query, keys, shouldFind) {
  const results = searchErrorCode(query, keys);
  const found   = results.length > 0;
  const ok      = found === shouldFind;
  const marker  = ok ? '✓' : '✗ FAIL';
  const preview = found ? results[0].substring(0, 60).replace(/\n/g, '↵') : '—';
  console.log(`  [${marker}] ${label}`);
  if (!ok) {
    console.log(`         query="${query}" keys=${JSON.stringify(keys)}`);
    console.log(`         expected=${shouldFind} got=${found} preview=${preview}`);
    fail++;
  } else {
    pass++;
  }
}

console.log('=== Findability Test Suite ===\n');

// ── Sync guard: verbatim copies must match src/search.js ─────────────────────
console.log('[Sync guard] Verificando sincronização com src/search.js');
{
  const srcSearch = readFileSync(resolve(ROOT, 'src/search.js'), 'utf8');
  const testSelf  = readFileSync(fileURLToPath(import.meta.url), 'utf8');

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
      .replace(/^export\s+/m, '')   // strip 'export' keyword
      .replace(/\/\/[^\n]*/g, '')   // strip // comments
      .replace(/\s+/g, ' ')         // collapse all whitespace
      .trim();
  }

  for (const fn of ['wildcardMatchHP', 'searchErrorCode']) {
    const srcNorm  = normalize(extractFn(srcSearch, fn));
    const testNorm = normalize(extractFn(testSelf,  fn));
    const ok = srcNorm === testNorm;
    console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${fn}`);
    if (ok) {
      pass++;
    } else {
      fail++;
      const diffAt = [...srcNorm].findIndex((c, i) => c !== testNorm[i]);
      console.log(`         diverge em posição ${diffAt}`);
      console.log(`         src: ...${srcNorm.slice(Math.max(0, diffAt - 20), diffAt + 40)}...`);
      console.log(`         test:...${testNorm.slice(Math.max(0, diffAt - 20), diffAt + 40)}...`);
    }
  }
}

// ── Positivos por modelo ──────────────────────────────────────────────────────
console.log('[E52645] cpmd-only code (10.00.00) → deve achar via cpmd');
expect('10.00.00 via E52645 searchKeys', '10.00.00', KEYS.E52645, true);

console.log('[E52645] service code (99.09.67) → deve achar via service');
expect('99.09.67 via E52645 searchKeys', '99.09.67', KEYS.E52645, true);

console.log('[E62655] e62655_cpmd-only code (10.00.30) → deve achar via e62655_cpmd');
expect('10.00.30 via E62655 searchKeys', '10.00.30', KEYS.E62655, true);

console.log('[E62655] 66.80.01 (e62655_cpmd) → deve achar');
expect('66.80.01 via E62655 searchKeys', '66.80.01', KEYS.E62655, true);

console.log('[E62655] bug-leve 5 codes → devem achar (fix)');
for (const code of ['66.80.03', '66.80.19', '66.80.20', '99.09.67', '31.13.01']) {
  expect(`${code} via E62655 searchKeys`, code, KEYS.E62655, true);
}

console.log('[Ricoh imc3000] SC285-00 → deve achar via ricoh_imc3000_service');
expect('SC285-00 via imc3000 searchKeys', 'SC285-00', KEYS.imc3000, true);

console.log('[Ricoh mpc3004] SC285-00 → deve achar via ricoh_mpc3004_service');
expect('SC285-00 via mpc3004 searchKeys', 'SC285-00', KEYS.mpc3004, true);

// ── Lote 1 — subcódigos inline ● (5 famílias) ────────────────────────────────
console.log('\n[Lote 1 — 66.80] 66.80.01 (Y-align) → deve achar via E52645 cpmd');
expect('66.80.01 via E52645 searchKeys', '66.80.01', KEYS.E52645, true);

console.log('[Lote 1 — 13.B9] 13.B9.A1 (Fuser jam Tray 1) → deve achar via E52645 cpmd');
expect('13.B9.A1 via E52645 searchKeys', '13.B9.A1', KEYS.E52645, true);

console.log('[Lote 1 — 33.05] 33.05.01 (Boot code corrupt) → deve achar via E52645 cpmd');
expect('33.05.01 via E52645 searchKeys', '33.05.01', KEYS.E52645, true);

console.log('[Lote 1 — 80.03] 80.03.01 (No PGP buffers) → deve achar via E52645 cpmd');
expect('80.03.01 via E52645 searchKeys', '80.03.01', KEYS.E52645, true);

console.log('[Lote 1 — 13.B2] 13.B2.A4 (Registration sensor Tray 4) → deve achar via E52645 cpmd');
expect('13.B2.A4 via E52645 searchKeys', '13.B2.A4', KEYS.E52645, true);

// ── Negativos cross-model ─────────────────────────────────────────────────────
console.log('\n[Cross-model isolation] Código E62655-only não vaza para E52645');
expect('10.00.30 (e62655-only) via E52645 keys → NOT FOUND', '10.00.30', KEYS.E52645, false);

console.log('[Cross-model isolation] SC Ricoh não vaza para HP');
expect('SC285-00 via E52645 keys → NOT FOUND', 'SC285-00', KEYS.E52645, false);
expect('SC285-00 via E62655 keys → NOT FOUND', 'SC285-00', KEYS.E62655, false);

console.log('[Cross-model isolation] SC imc3000-only não vaza para mpc3004');
expect('SC860-03 (imc3000-only) via mpc3004 keys → NOT FOUND', 'SC860-03', KEYS.mpc3004, false);

console.log('[Cross-model isolation] SC mpc3004-only não vaza para imc3000');
expect('SC665-01 (mpc3004-only) via imc3000 keys → NOT FOUND', 'SC665-01', KEYS.imc3000, false);

// ── Dedup interno ─────────────────────────────────────────────────────────────
// 99.09.67 existe sob 'service' e pode aparecer em múltiplas chaves do E52645;
// searchErrorCode deve deduplicar e retornar cada texto no máximo uma vez.
console.log('[Dedup] 99.09.67 via E52645 searchKeys não retorna duplicatas');
{
  const results = searchErrorCode('99.09.67', KEYS.E52645);
  const sigs = results.map(t => t.slice(0, 80));
  const unique = new Set(sigs);
  const ok = unique.size === sigs.length;
  const marker = ok ? '✓' : '✗ FAIL';
  console.log(`  [${marker}] dedup: ${results.length} resultados, ${unique.size} únicos`);
  if (ok) pass++; else { fail++; console.log('  DUPLICATAS DETECTADAS'); }
}

// ── Resumo ────────────────────────────────────────────────────────────────────
console.log(`\n=== ${pass + fail} testes: ${pass} passaram, ${fail} falharam ===`);
if (fail > 0) process.exit(1);
