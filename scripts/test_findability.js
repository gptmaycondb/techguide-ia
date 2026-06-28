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
import { getErrorFamily } from '../src/errorFamilies.js';
import { canSaveCodeFavorite, createCodeFavorite, getCodeFavoriteRestoreMessages } from '../src/codeFavorites.js';
import { clearAllConversations, clearConversation, deleteConversationMessage } from '../src/conversationState.js';
import { ONBOARDING_STEPS, getOnboardingStep, onboardingStorageKey } from '../src/onboarding.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const srcChatJs = readFileSync(resolve(ROOT, 'src/ChatScreen.js'), 'utf8');
const srcAppJs = readFileSync(resolve(ROOT, 'App.js'), 'utf8');
const srcDataJs = readFileSync(resolve(ROOT, 'src/data.js'), 'utf8');

const errorCodesData = JSON.parse(
  readFileSync(resolve(ROOT, 'assets/error_codes_index.json'), 'utf8')
);
const searchData = JSON.parse(
  readFileSync(resolve(ROOT, 'assets/search_index.json'), 'utf8')
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

function computeFoundInManual(errorChunks, chunks, hasRC) {
  if (errorChunks.length > 0) return true;
  return chunks.length > 0 && hasRC.some(Boolean);
}
// ─────────────────────────────────────────────────────────────────────────────

// ── parseSseText copiado VERBATIM de src/ChatScreen.js ───────────────────────
function parseSseText(text) {
  const events = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (!data) continue;
    try { events.push(JSON.parse(data)); } catch {}
  }
  return events;
}

function buildChatHistory(messages) {
  return messages
    .filter(m => m.role !== 'errorCode' && m.text)
    .slice(-6)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
}

function getMessageCopyText(message) {
  if (message.role === 'errorCode') {
    return (message.entries || [])
      .map(entry => `${entry.code}\n${entry.text}`)
      .join('\n\n');
  }
  return message.text || '';
}
// ─────────────────────────────────────────────────────────────────────────────

// searchKeys espelham src/data.js
const KEYS = {
  E52645:      ['e52645_guia', 'cpmd', 'service'],
  E62655:      ['e62655_guia', 'e62655_service', 'e62655_cpmd'],
  E826:        ['hp_e826_guia', 'hp_e826_service', 'hp_e826_cpmd'],
  imc3000:     ['ricoh_imc3000_service', 'ricoh_imc3000_guia', 'ricoh_imc3000_parts'],
  mpc3004:     ['ricoh_mpc3004_service', 'ricoh_mpc3004_guia'],
  sp3710:      ['ricoh_sp3710_service', 'ricoh_sp3710_guia', 'ricoh_sp3710_psg'],
  mp2555Series: ['ricoh_mp2555_service', 'ricoh_mp2555_guia'],
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

function expectContains(label, query, keys, includes, excludes = []) {
  const results = searchErrorCode(query, keys);
  const joined = results.join('\n');
  const ok = results.length > 0
    && includes.every(s => joined.includes(s))
    && excludes.every(s => !joined.includes(s));
  const marker = ok ? '✓' : '✗ FAIL';
  const preview = results[0]?.substring(0, 120).replace(/\n/g, '↵') || '—';
  console.log(`  [${marker}] ${label}`);
  if (!ok) {
    console.log(`         query="${query}" keys=${JSON.stringify(keys)}`);
    console.log(`         includes=${JSON.stringify(includes)} excludes=${JSON.stringify(excludes)}`);
    console.log(`         preview=${preview}`);
    fail++;
  } else {
    pass++;
  }
}

console.log('=== Findability Test Suite ===\n');

console.log('[Conversation cleanup] escopos de limpeza local');
{
  const initial = {
    hp_e826: [{ id: 'user-1' }, { id: 'error-code-2' }],
    ricoh_imc3000: [{ id: 'ai-3' }],
  };
  const clearedCurrent = clearConversation(initial, 'hp_e826');
  const deletedOne = deleteConversationMessage(initial, 'hp_e826', 'error-code-2');
  const clearedAll = clearAllConversations();
  const checks = [
    ['limpar atual remove apenas hp_e826', !clearedCurrent.hp_e826 && clearedCurrent.ricoh_imc3000.length === 1],
    ['apagar individual preserva as demais mensagens', deletedOne.hp_e826.length === 1 && deletedOne.hp_e826[0].id === 'user-1'],
    ['limpar todas retorna objeto vazio', Object.keys(clearedAll).length === 0],
  ];
  for (const [label, ok] of checks) {
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`);
    if (ok) pass++; else fail++;
  }
}

function expectIndexContains(label, key, includes, excludes = []) {
  const entries = searchData[key] || [];
  const joined = entries.map(e => e.t || '').join('\n');
  const ok = entries.length > 0
    && includes.every(s => joined.includes(s))
    && excludes.every(s => !joined.includes(s));
  const marker = ok ? 'âœ“' : 'âœ— FAIL';
  console.log(`  [${marker}] ${label}`);
  if (!ok) {
    console.log(`         key=${key} chunks=${entries.length}`);
    console.log(`         includes=${JSON.stringify(includes)} excludes=${JSON.stringify(excludes)}`);
    fail++;
  } else {
    pass++;
  }
}

function expectIndexMissing(label, key) {
  const ok = !Object.prototype.hasOwnProperty.call(searchData, key);
  console.log(`  [${ok ? 'âœ“' : 'âœ— FAIL'}] ${label}`);
  if (ok) pass++; else fail++;
}

// ── Sync guard: verbatim copies must match source files ──────────────────────
console.log('[Sync guard] Verificando sincronização com src/search.js e src/ChatScreen.js');
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

  for (const [fn, src] of [
    ['wildcardMatchHP',      srcSearch],
    ['searchErrorCode',      srcSearch],
    ['computeFoundInManual', srcSearch],
    ['parseSseText',         srcChatJs],
    ['buildChatHistory',     srcChatJs],
    ['getMessageCopyText',   srcChatJs],
  ]) {
    const srcNorm  = normalize(extractFn(src,     fn));
    const testNorm = normalize(extractFn(testSelf, fn));
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

console.log('\n[Message actions] selecao nativa e copia integral');
{
  const errorCardText = getMessageCopyText({
    role: 'errorCode',
    entries: [{ code: '13.B2.D2', text: 'Atolamento na bandeja 2.' }],
  });
  const checks = [
    ['mensagem comum copia o texto completo', getMessageCopyText({ role: 'ai', text: 'Resposta completa.' }) === 'Resposta completa.'],
    ['card de codigo copia codigo e descricao', errorCardText === '13.B2.D2\nAtolamento na bandeja 2.'],
    ['texto selecionavel permanece no ChatScreen', srcChatJs.includes('selectable')],
    ['wrapper de long-press foi removido', !srcChatJs.includes('onLongPress={() => confirmDeleteMessage')],
  ];
  for (const [label, ok] of checks) {
    console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${label}`);
    if (ok) pass++; else fail++;
  }
}

console.log('\n[Conversation cleanup] gatilho no cabecalho');
{
  const checks = [
    ['faixa acima do input foi removida', !srcChatJs.includes('clearConversationBar') && !srcChatJs.includes('clearConversationBtn')],
    ['lixeira so aparece na Consulta com mensagens', srcAppJs.includes("activeTab === 'chat' && (") && srcAppJs.includes('messages.length > 0 && <TouchableOpacity')],
    ['lixeira reutiliza a limpeza do modelo atual', srcAppJs.includes('onPress: handleClearConversation') && srcAppJs.includes('clearConversation(previous, chatKey)')],
  ];
  for (const [label, ok] of checks) {
    console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${label}`);
    if (ok) pass++; else fail++;
  }
}

console.log('\n[Onboarding] roteiro deterministico e flag por usuario');
{
  const srcBubbleJs = readFileSync(resolve(ROOT, 'src/AssistantBubble.js'), 'utf8');
  const srcOnboardingJs = readFileSync(resolve(ROOT, 'src/onboarding.js'), 'utf8');
  const checks = [
    ['cinco passos com abas esperadas', ONBOARDING_STEPS.length === 5 && ONBOARDING_STEPS[0].target === 'equipment' && ONBOARDING_STEPS[4].target === 'bubble'],
    ['flag e isolado por usuario', onboardingStorageKey('tecnico@empresa.com') === 'tg_onboarding_done_tecnico@empresa.com'],
    ['indice invalido nao cria passo', getOnboardingStep(-1) === null && getOnboardingStep(5) === null],
    ['roteiro nao usa IA ou busca', !/fetch\(|API_URL|searchErrorCode|semanticSearchManual|from\s+['"].*search/.test(srcOnboardingJs)],
    ['tutorial antigo foi removido', !srcAppJs.includes('TutorialScreen') && !srcAppJs.includes('tg_tutorial_seen')],
    ['bolha desabilita PanResponder durante tour', srcBubbleJs.includes('...(tour ? {} : panResponder.panHandlers)')],
    ['spotlight fica acima dos overlays existentes', srcBubbleJs.includes('tourRoot: { zIndex: 70 }')],
    ['spotlight e balão respeitam as bordas da tela', srcBubbleJs.includes('function clampSpotlight') && srcBubbleJs.includes('function getTourBubblePosition') && srcBubbleJs.includes('function getTourBalloonPosition')],
  ];
  for (const [label, ok] of checks) {
    console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${label}`);
    if (ok) pass++; else fail++;
  }
}

console.log('\n[Error families] mapa aprovado por modelo');
for (const [code, modelId, expected] of [
  ['13.B2.D2', 'hp_e826', 'Atolamento'],
  ['50.FF.02', 'hp_e826', 'Fusor'],
  ['59.05.50', 'hp_e826', 'Motor'],
  ['53.B0.02', 'hp_e826', 'Bandeja'],
  ['64.04.02', 'hp_e826', 'Acessorio/Hardware'],
  ['39.8', 'hp_e62655', null],
  ['SC543', 'ricoh_sp3710', 'Motor/Fusao'],
  ['SC541', 'ricoh_imc3000', 'Transporte de papel/Fusao'],
]) {
  const actual = getErrorFamily(code, modelId);
  const ok = actual === expected;
  console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${code} (${modelId}) → ${actual}`);
  if (ok) pass++; else fail++;
}

console.log('\n[Chat history] card local nao segue para provider');
{
  const history = buildChatHistory([
    { role: 'user', text: '13.b2.d2' },
    { role: 'errorCode', entries: [{ code: '13.B2.D2' }] },
    { role: 'ai', text: 'Resposta anterior' },
    { role: 'user', text: '13.B2.D2' },
    { role: 'ai', text: '' },
  ]);
  const ok = history.length === 3 && history.every(message => typeof message.content === 'string' && message.content.length > 0);
  console.log(`  [${ok ? '✓' : '✗ FAIL'}] errorCode/vazio excluidos; ${history.length} turnos com texto`);
  if (ok) pass++; else fail++;
}

console.log('\n[Code favorite] snapshot autossuficiente e restauracao local');
{
  const entry = { code: '13.B2.D2', serviceKey: 'hp_e826_cpmd', text: 'Atolamento na bandeja 2.' };
  const answer = { role: 'ai', text: 'Remova o papel preso.', streaming: false, source: 'Manual: E826', fromManual: true };
  const favorite = createCodeFavorite({ entry, answer, manual: { id: 'hp_e826', label: 'HP E826', color: '#149BFF' }, family: 'Atolamento', source: 'Manual (CPMD)' });
  const restored = getCodeFavoriteRestoreMessages(favorite, 100);
  const checks = [
    ['estrela exige uma entrada e IA completa', canSaveCodeFavorite([entry], answer)],
    ['estrela some durante streaming', !canSaveCodeFavorite([entry], { ...answer, streaming: true })],
    ['estrela some para erro ou varios codigos', !canSaveCodeFavorite([entry], { ...answer, isError: true }) && !canSaveCodeFavorite([entry, entry], answer)],
    ['favorito salva card e resposta', favorite.savedCard.entries[0].code === entry.code && favorite.savedAnswer.text === answer.text],
    ['restauracao insere card e resposta com IDs novos', restored?.[0].role === 'errorCode' && restored?.[1].role === 'ai' && restored[0].id !== restored[1].id],
    ['favorito antigo nao gera reconsulta', getCodeFavoriteRestoreMessages({ type: 'code', modelId: 'hp_e826' }) === null],
    ['limpar conversa nao altera snapshot do favorito', clearConversation({ hp_e826: [{ id: 'old' }] }, 'hp_e826').hp_e826 === undefined && favorite.savedAnswer.text === answer.text],
  ];
  for (const [label, ok] of checks) {
    console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${label}`);
    if (ok) pass++; else fail++;
  }
}

console.log('\n[Code favorite] reabertura local sem IA');
{
  const start = srcAppJs.indexOf('function openCodeFavorite');
  const end = srcAppJs.indexOf('\n  function modelFavorite', start);
  const restoreHandler = srcAppJs.slice(start, end);
  const checks = [
    ['reabertura escreve no historico do modelId', restoreHandler.includes('[item.modelId]: [...(previous[item.modelId] || []), ...restored]')],
    ['reabertura nao agenda pergunta nem chama busca', !restoreHandler.includes('setPendingQuestion') && !restoreHandler.includes('searchErrorCode') && !restoreHandler.includes('fetch(')],
    ['limpeza nao toca favoritos', !srcAppJs.slice(srcAppJs.indexOf('function handleClearAllConversations'), srcAppJs.indexOf('function openCodeFavorite')).includes('setFavorites')],
  ];
  for (const [label, ok] of checks) {
    console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${label}`);
    if (ok) pass++; else fail++;
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

console.log('[Ricoh SP 3710] códigos SC### e SC542-## → devem achar via ricoh_sp3710_service');
for (const code of ['SC202', 'SC541', 'SC543', 'SC688', 'SC542-01']) {
  expect(`${code} via sp3710 searchKeys`, code, KEYS.sp3710, true);
}

console.log('[HP E826] CPMD codes -> devem achar via hp_e826_cpmd');
for (const code of ['13.B2.D2', '13.B9.A1', '10.00.35', '99.09.67', '59.05.50']) {
  expect(`${code} via E826 searchKeys`, code, KEYS.E826, true);
}

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

// ── Lote 2 — faixas expandidas ───────────────────────────────────────────────
console.log('\n[Lote 2 — range] SC816-11 (intermediário imc3000 SC81610 to 12) → deve achar');
expect('SC816-11 via imc3000 searchKeys', 'SC816-11', KEYS.imc3000, true);

console.log('[Lote 2 — range] SC816-17 (intermediário SC81615 to 18) → deve achar');
expect('SC816-17 via imc3000 searchKeys', 'SC816-17', KEYS.imc3000, true);

console.log('[Lote 2 — range] SC874-63 (intermediário SC87461 to -65) → deve achar');
expect('SC874-63 via imc3000 searchKeys', 'SC874-63', KEYS.imc3000, true);

console.log('[Lote 2 — range] SC865-60 (intermediário SC865-50 to 73, mpc3004) → deve achar');
expect('SC865-60 via mpc3004 searchKeys', 'SC865-60', KEYS.mpc3004, true);

console.log('[Lote 2 — range] SC864-15 (intermediário SC864-02 to 23, mpc3004) → deve achar');
expect('SC864-15 via mpc3004 searchKeys', 'SC864-15', KEYS.mpc3004, true);

console.log('[Lote 2 — threshold] SC361-01 (condition table row, mpc3004) → deve achar');
expect('SC361-01 via mpc3004 searchKeys', 'SC361-01', KEYS.mpc3004, true);

console.log('[Lote 2 — threshold] SC910-01 (condition table row, mpc3004) → deve achar');
expect('SC910-01 via mpc3004 searchKeys', 'SC910-01', KEYS.mpc3004, true);

console.log('[Lote 2 — threshold] SC672-20 (condition table row, imc3000) → deve achar');
expect('SC672-20 via imc3000 searchKeys', 'SC672-20', KEYS.imc3000, true);

console.log('[Lote 2 — threshold] SC911-20 (condition table row, imc3000) → deve achar');
expect('SC911-20 via imc3000 searchKeys', 'SC911-20', KEYS.imc3000, true);

// ── Lote 3 — espaço SC816-99, OCCURS, faixa de partição, stubs ───────────────
console.log('\n[Lote 3 — espaço] SC816-99 (SC 81699 imc3000) → deve achar');
expect('SC816-99 via imc3000 searchKeys', 'SC816-99', KEYS.imc3000, true);

console.log('[Lote 3 — espaço] SC816-99 (SC 816-99 mpc3004) → deve achar');
expect('SC816-99 via mpc3004 searchKeys', 'SC816-99', KEYS.mpc3004, true);

console.log('[Lote 3 — OCCURS] SC843-02 (SC843-02 OCCURS section, mpc3004) → deve achar');
expect('SC843-02 via mpc3004 searchKeys', 'SC843-02', KEYS.mpc3004, true);

console.log('[Lote 3 — partition range] SC863-23 (end of SC863-02…23 range, mpc3004) → deve achar');
expect('SC863-23 via mpc3004 searchKeys', 'SC863-23', KEYS.mpc3004, true);

console.log('[Lote 3 — partition range] SC865-23 (end of SC865-02…23 range, mpc3004) → deve achar');
expect('SC865-23 via mpc3004 searchKeys', 'SC865-23', KEYS.mpc3004, true);

console.log('[Lote 3 — stub] SC544-00 (fusing unit stub, imc3000) → deve achar');
expect('SC544-00 via imc3000 searchKeys', 'SC544-00', KEYS.imc3000, true);

console.log('[Lote 3 — stub] SC544-00 (fusing unit stub, mpc3004) → deve achar');
expect('SC544-00 via mpc3004 searchKeys', 'SC544-00', KEYS.mpc3004, true);

console.log('[Lote 3 — stub] SC852-02 (ARFU stub, mpc3004) → deve achar');
expect('SC852-02 via mpc3004 searchKeys', 'SC852-02', KEYS.mpc3004, true);

console.log('\n[Ricoh MP 2555/3055/3555 - Camada 1] conteudo indexado e parts fora da busca');
expectIndexContains(
  'MP 2555 User Guide via Poppler -> Web Image Monitor / pasta compartilhada',
  'ricoh_mp2555_guia',
  ['Web Image Monitor', 'Criar uma pasta compartilhada']
);
expectIndexContains(
  'MP 2555 Service Manual via Poppler -> D284 MP 2555 e fusing unit',
  'ricoh_mp2555_service',
  ['D284', 'MP 2555', 'fusing unit']
);
expectIndexMissing(
  'MP 2555 Parts Catalog listado mas ausente do search_index',
  'ricoh_mp2555_parts_catalog'
);
{
  const keys = KEYS.mp2555Series;
  const canonicalIds = [
    'ricoh_mp2555_guia',
    'ricoh_mp2555_service',
    'ricoh_mp2555_parts_catalog',
  ];
  const presentationOk = (srcDataJs.match(/id: 'ricoh_mp2555_series'/g) || []).length === 1
    && (srcDataJs.match(/id: 'ricoh_mp2555_series_group'/g) || []).length === 1
    && !srcDataJs.includes("id: 'ricoh_mp3055'")
    && !srcDataJs.includes("id: 'ricoh_mp3555'")
    && canonicalIds.every(id => (srcDataJs.match(new RegExp(`id: '${id}'`, 'g')) || []).length === 1);
  const searchOk = JSON.stringify(keys) === JSON.stringify([
    'ricoh_mp2555_service',
    'ricoh_mp2555_guia',
  ]) && keys.every(key => Array.isArray(searchData[key]) && searchData[key].length > 0);
  console.log(`  [${presentationOk ? 'PASS' : 'FAIL'}] uma entrada da serie e tres manuais canonicos sem duplicacao`);
  if (presentationOk) pass++; else fail++;
  console.log(`  [${searchOk ? 'PASS' : 'FAIL'}] serie MP 2555/3055/3555 usa as duas chaves Poppler compartilhadas`);
  if (searchOk) pass++; else fail++;
}
expectIndexContains(
  'MP 2555 nao reutiliza chunks da SP 3710',
  'ricoh_mp2555_service',
  ['D284', 'MP 2555'],
  ['SP 3710DN']
);

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

console.log('[Cross-model isolation] SP 3710 colidindo com IM C3000/MP C3004 não cruza descrições');
expectContains(
  'SC541 via SP 3710 → fusing thermistor do 3710, não thermopile dos coloridos',
  'SC541',
  KEYS.sp3710,
  ['Fusing thermistor (TH1) error'],
  ['Thermopile']
);
expectContains(
  'SC541 via IM C3000 → thermopile da IM, não fusing thermistor TH1 do 3710',
  'SC541',
  KEYS.imc3000,
  ['Thermopile'],
  ['Fusing thermistor (TH1) error']
);
expectContains(
  'SC543 via SP 3710 → high temperature do 3710, não thermopile dos coloridos',
  'SC543',
  KEYS.sp3710,
  ['High temperature error (soft)', '235'],
  ['Thermopile']
);
expectContains(
  'SC543 via IM C3000 → thermopile da IM, não texto do 3710',
  'SC543',
  KEYS.imc3000,
  ['Thermopile'],
  ['235']
);
expectContains(
  'SC202 via SP 3710 → polygon mirror motor M4 do 3710',
  'SC202',
  KEYS.sp3710,
  ['Polygon mirror motor (M4) on timeout error'],
  ['Polygon Motor: ON Timeout Error']
);
expectContains(
  'SC202 via IM C3000 → polygon motor da IM, não M4 do 3710',
  'SC202',
  KEYS.imc3000,
  ['Polygon Motor: ON Timeout Error'],
  ['Polygon mirror motor (M4) on timeout error']
);
expect('SC688 (3710-only) via imc3000 keys → NOT FOUND', 'SC688', KEYS.imc3000, false);
expect('SC688 (3710-only) via mpc3004 keys → NOT FOUND', 'SC688', KEYS.mpc3004, false);

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

// ── computeFoundInManual — gate booleano (bug confirmado em device Hermes) ────
// Valores reais observados no APK diagnóstico (run #109, branch diag):
//   q=66.80.03 | errorChunks=1 | manualChunks=1 | hasRC=[false,false,false]
// Lógica antiga: chunks.length>0 && hasRC.some(Boolean) = true && false = false ← BUG
// Fix:  computeFoundInManual(errorChunks, chunks, hasRC) → true quando errorChunks>0
console.log('\n[computeFoundInManual] gate booleano do selo/offline');
{
  const FAKE = 'stapler malfunction 66.80.03 — Recommended action: turn off printer';

  // Caso real do bug (E52645, 66.80.03): errorChunks=1, hasRC todos false → deve ser true
  const r1 = computeFoundInManual([FAKE], [FAKE], [false, false, false]);
  const ok1 = r1 === true;
  console.log(`  [${ok1 ? '✓' : '✗ FAIL'}] errorChunks=1, hasRC=all-false → true  (fix bug 66.80.03 E52645)`);
  if (ok1) pass++; else fail++;

  // Prova que a lógica antiga retornava false (regressão documentada):
  const oldLogic = [FAKE].length > 0 && [false, false, false].some(Boolean);
  const ok2 = oldLogic === false;
  console.log(`  [${ok2 ? '✓' : '✗ FAIL'}] lógica antiga: errorChunks=1, hasRC=all-false → false  (documenta bug pré-fix)`);
  if (ok2) pass++; else fail++;

  // Caso negativo: código inexistente, sem chunks, sem hasRC → false
  const r3 = computeFoundInManual([], [], [false, false, false]);
  const ok3 = r3 === false;
  console.log(`  [${ok3 ? '✓' : '✗ FAIL'}] errorChunks=0, chunks=0, hasRC=all-false → false  (código inexistente)`);
  if (ok3) pass++; else fail++;

  // Caminho clássico preservado: manualChunks com hasRC=true → true
  const r4 = computeFoundInManual([], [FAKE], [false, true, false]);
  const ok4 = r4 === true;
  console.log(`  [${ok4 ? '✓' : '✗ FAIL'}] errorChunks=0, chunks=1, hasRC=[f,t,f] → true  (searchManual clássico)`);
  if (ok4) pass++; else fail++;
}

// ── parseSseText — parser SSE puro e testável ─────────────────────────────────
// Cobre os 4 cenários do onload/onprogress no ChatScreen (fix Gemini "Unexpected character: d").
console.log('\n[parseSseText] parser SSE — fix Gemini onload');
{
  // (a) stream completo chegando só no onload (onprogress não disparou: lastIndex=0)
  const full = [
    'data: {"type":"delta","text":"Olá"}',
    'data: {"type":"delta","text":" mundo"}',
    'data: {"type":"done","foundInManual":true}',
    '',
  ].join('\n');
  const evs_a = parseSseText(full);
  const ok_a  = evs_a.length === 3
    && evs_a[0].type === 'delta' && evs_a[0].text === 'Olá'
    && evs_a[1].type === 'delta' && evs_a[1].text === ' mundo'
    && evs_a[2].type === 'done';
  console.log(`  [${ok_a ? '✓' : '✗ FAIL'}] (a) stream completo no onload → 3 eventos, sem erro`);
  if (ok_a) pass++; else fail++;

  // (b) parte via onprogress + resto no onload → sem duplicação (usa offset lastIndex)
  // onprogress leu 2 eventos; onload recebe responseText.slice(lastIndex) = só o done
  const part1 = 'data: {"type":"delta","text":"Olá"}\ndata: {"type":"delta","text":" mundo"}\n';
  const part2 = 'data: {"type":"done","foundInManual":true}\n';
  const evs_p  = parseSseText(part1);  // simula onprogress
  const evs_ol = parseSseText(part2);  // simula onload com slice(lastIndex)
  const ok_b = evs_p.length === 2 && evs_ol.length === 1 && evs_ol[0].type === 'done';
  console.log(`  [${ok_b ? '✓' : '✗ FAIL'}] (b) onprogress=${evs_p.length} + onload=${evs_ol.length} → total 3 sem duplicação`);
  if (ok_b) pass++; else fail++;

  // (c) erro SSE (Gemini key inválida) → parseia sem expor "Unexpected character: d"
  const errSse = 'data: {"type":"error","message":"API_KEY_INVALID"}\n';
  const evs_c  = parseSseText(errSse);
  const ok_c   = evs_c.length === 1 && evs_c[0].type === 'error' && evs_c[0].message === 'API_KEY_INVALID';
  console.log(`  [${ok_c ? '✓' : '✗ FAIL'}] (c) erro SSE → parseia corretamente (sem JSON.parse cru em "data: ...")`);
  if (ok_c) pass++; else fail++;

  // (d) JSON puro (backend antigo sem SSE): parseSseText retorna [] → fallback JSON fica intacto
  const jsonOnly = '{"content":[{"text":"resposta"}],"foundInManual":true}';
  const evs_d   = parseSseText(jsonOnly);
  const ok_d    = evs_d.length === 0;
  console.log(`  [${ok_d ? '✓' : '✗ FAIL'}] (d) JSON puro → parseSseText retorna [] (fallback JSON preservado)`);
  if (ok_d) pass++; else fail++;

  // (e) stream totalmente consumido via onprogress (múltiplos chunks, lastIndex=responseText.length)
  // → onload processa slice(lastIndex) = '' → zero eventos, nenhuma duplicação
  const fullResponse = [
    'data: {"type":"delta","text":"chunk1"}',
    'data: {"type":"delta","text":"chunk2"}',
    'data: {"type":"done","foundInManual":true}',
    '',
  ].join('\n');
  // Simula onprogress lendo o body inteiro incrementalmente
  let lastIdx = 0;
  let totalEvents = 0;
  let doneSeenInProgress = false;
  // chunk 1: primeiros 2 eventos
  const chunk1 = fullResponse.slice(0, fullResponse.indexOf('data: {"type":"done"'));
  const p1 = parseSseText(fullResponse.slice(lastIdx, chunk1.length));
  lastIdx = chunk1.length;
  totalEvents += p1.length;
  // chunk 2: evento done
  const p2 = parseSseText(fullResponse.slice(lastIdx));
  lastIdx = fullResponse.length;
  totalEvents += p2.length;
  doneSeenInProgress = p2.some(ev => ev.type === 'done');
  // onload: slice(lastIndex) = '' → zero eventos
  const onloadEvs = parseSseText(fullResponse.slice(lastIdx));
  const ok_e = totalEvents === 3 && doneSeenInProgress && onloadEvs.length === 0;
  console.log(`  [${ok_e ? '✓' : '✗ FAIL'}] (e) stream incremental via onprogress (${totalEvents} eventos) → onload produz ${onloadEvs.length} eventos (sem duplicação)`);
  if (ok_e) pass++; else fail++;
}

// ── Resumo ────────────────────────────────────────────────────────────────────
console.log('[Cross-model isolation] HP E826 colidindo com E52645/E62655 nao cruza descricoes');
expectContains(
  '13.B2.D2 via E826 -> tray 2/registration sensor do E826, nao right door/PS4550 da E62655',
  '13.B2.D2',
  KEYS.E826,
  ['13.B2.D2 Jam in tray 2', 'registration sensor'],
  ['Jam in right door', 'PS4550']
);
expectContains(
  '13.B2.D2 via E62655 -> right door/PS4550 da E62655, nao texto E826',
  '13.B2.D2',
  KEYS.E62655,
  ['Jam in right door', 'PS4550'],
  ['13.B2.D2 Jam in tray 2']
);
expectContains(
  '13.B9.A1 via E826 -> Auto-Sense mode Normal, nao Tray 1 dos CPMDs antigos',
  '13.B9.A1',
  KEYS.E826,
  ['Printing in Auto-Sense mode Normal'],
  ['Tray 1']
);
expectContains(
  '13.B9.A1 via E52645 -> Tray 1 antigo, nao Auto-Sense E826',
  '13.B9.A1',
  KEYS.E52645,
  ['Tray 1'],
  ['Auto-Sense mode Normal']
);
expectContains(
  '10.00.35 via E826 -> black toner cartridge E826, nao descricao generica E52645',
  '10.00.35',
  KEYS.E826,
  ['Incompatible toner cartridge', 'black toner cartridge'],
  ['Incompatible supply in use']
);
expectContains(
  '10.00.35 via E62655 -> supply E62655, nao toner cartridge E826',
  '10.00.35',
  KEYS.E62655,
  ['Replace the supply with one that is designed for this printer'],
  ['The black toner cartridge installed is not a genuine HP supply']
);
expectContains(
  '99.09.67 via E826 -> hard disk drive or eMMC, nao texto E62655 service',
  '99.09.67',
  KEYS.E826,
  ['hard disk drive or eMMC'],
  ['after Format Disk or disk replacement']
);
expectContains(
  '99.09.67 via E62655 -> texto E62655, nao eMMC E826',
  '99.09.67',
  KEYS.E62655,
  ['after Format Disk or disk replacement'],
  ['hard disk drive or eMMC']
);
expectContains(
  '59.05.50 via E826 -> black drum motor E826',
  '59.05.50',
  KEYS.E826,
  ['59.05.50 Black drum motor error'],
  ['Drum motor startup abnormality']
);
expectContains(
  '59.05.50 via E62655 -> drum motor startup antigo, nao stub E826',
  '59.05.50',
  KEYS.E62655,
  ['Drum motor startup abnormality'],
  ['59.05.50 Black drum motor error']
);

console.log(`\n=== ${pass + fail} testes: ${pass} passaram, ${fail} falharam ===`);
if (fail > 0) process.exit(1);
