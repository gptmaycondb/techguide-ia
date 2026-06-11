#!/usr/bin/env node
/**
 * TechGuide IA — Backend unit tests (PR-A)
 *
 * Testa buildGeminiMessages com sync guard + prova SDK rejeição-antes/aceitação-depois.
 *
 * Uso:  node scripts/test_backend.js
 * Exit: 0 = todos passaram | 1 = falha
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT        = resolve(__dirname, '..');
const BACKEND_ROOT = resolve(ROOT, 'backend');

const srcServer = readFileSync(resolve(BACKEND_ROOT, 'server.js'), 'utf8');

const _require = createRequire(import.meta.url);
const { GoogleGenerativeAI } = _require(
  resolve(BACKEND_ROOT, 'node_modules/@google/generative-ai')
);

// ── buildGeminiMessages copiado VERBATIM de backend/server.js ─────────────────
function buildGeminiMessages(messages) {
  const mapped = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));
  const lastMsg = mapped.pop() || null;
  // Gemini requires history[0].role === 'user'; strip any leading model turns
  while (mapped.length > 0 && mapped[0].role !== 'user') mapped.shift();
  return { history: mapped, userText: lastMsg?.parts[0]?.text || '' };
}
// ─────────────────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;

function check(label, result, expected) {
  const ok = result === expected;
  console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${label}`);
  if (!ok) {
    console.log(`         expected: ${JSON.stringify(expected)}`);
    console.log(`         got:      ${JSON.stringify(result)}`);
    fail++;
  } else {
    pass++;
  }
}

console.log('=== Backend Unit Tests ===\n');

// ── Sync guard: cópia verbatim deve ser idêntica ao server.js ─────────────────
console.log('[Sync guard] buildGeminiMessages deve ser idêntica a backend/server.js');
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

  const srcNorm  = normalize(extractFn(srcServer, 'buildGeminiMessages'));
  const testNorm = normalize(extractFn(testSelf,  'buildGeminiMessages'));
  const ok = srcNorm === testNorm;
  console.log(`  [${ok ? '✓' : '✗ FAIL'}] buildGeminiMessages`);
  if (ok) {
    pass++;
  } else {
    fail++;
    const diffAt = [...srcNorm].findIndex((c, i) => c !== testNorm[i]);
    console.log(`         diverge em posição ${diffAt}`);
    console.log(`         server: ...${srcNorm.slice(Math.max(0, diffAt - 20), diffAt + 40)}...`);
    console.log(`         test:   ...${testNorm.slice(Math.max(0, diffAt - 20), diffAt + 40)}...`);
  }
}

// ── A1a: systemPrompt + 1 mensagem user ───────────────────────────────────────
console.log('\n[A1a] systemPrompt + 1 mensagem user');
{
  const { history, userText } = buildGeminiMessages([
    { role: 'user', content: 'Qual é o erro 49.XX.YZ?' },
  ]);
  check('history deve estar vazio (contents[0] será o userText)', history.length, 0);
  check('userText é a query do usuário', userText, 'Qual é o erro 49.XX.YZ?');
}

// ── A1b: histórico multi-turn correto ─────────────────────────────────────────
console.log('\n[A1b] histórico multi-turn (user → assistant → user)');
{
  const msgs = [
    { role: 'user',      content: 'Pergunta 1' },
    { role: 'assistant', content: 'Resposta 1' },
    { role: 'user',      content: 'Pergunta 2' },
  ];
  const { history, userText } = buildGeminiMessages(msgs);
  check('history tem 2 entradas',          history.length,    2);
  check('history[0].role === user',         history[0].role,  'user');
  check('history[1].role === model',        history[1].role,  'model');
  check('userText é a última mensagem',     userText,          'Pergunta 2');
}

// ── A1c: payload que causa o erro — rejeição ANTES / aceitação DEPOIS ─────────
console.log('\n[A1c] rejeição ANTES do fix / aceitação DEPOIS');
{
  const genai = new GoogleGenerativeAI('fake-key-for-local-validation');
  const mdl = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Simular o código ANTIGO: map + pop sem strip de leading model turns
  const messagesComBug = [
    { role: 'assistant', content: 'Olá, como posso ajudar?' },
    { role: 'user',      content: 'O que é o erro SC285-00?' },
  ];
  const historyAntes = messagesComBug.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));
  historyAntes.pop(); // remove last user → history = [{role:'model',...}]

  let threwBefore = false;
  try {
    mdl.startChat({ history: historyAntes, systemInstruction: 'sys' });
  } catch (e) {
    threwBefore = e.message.includes("First content should be with role 'user'");
  }
  check("ANTES do fix: SDK rejeita history[0].role='model'", threwBefore, true);

  // Código NOVO: buildGeminiMessages faz o strip
  const { history: historyDepois, userText } = buildGeminiMessages(messagesComBug);
  let threwAfter = false;
  try {
    mdl.startChat({ history: historyDepois, systemInstruction: 'sys' });
  } catch (e) {
    threwAfter = true;
  }
  check('DEPOIS do fix: SDK aceita history sem leading model', threwAfter,      false);
  check('userText preservado após strip',                       userText,        'O que é o erro SC285-00?');
  check('history stripped para vazio',                          historyDepois.length, 0);
}

// ── A1d: array vazio (edge case) ──────────────────────────────────────────────
console.log('\n[A1d] array de mensagens vazio (edge case)');
{
  const { history, userText } = buildGeminiMessages([]);
  check('history vazio', history.length, 0);
  check('userText vazio', userText, '');
}

// ── A1e: payload realista do contrato legado ───────────────────────────────────
// Prova: systemPrompt chega intacto em systemInstruction; contents[0].role === 'user'
console.log('\n[A1e] payload realista do contrato legado (systemPrompt + histórico multi-turn)');
{
  const systemPrompt = [
    'Você é um assistente técnico especializado em impressoras HP E52645.',
    '\nTRECHOS DO MANUAL:\n\n[1]\n49.38.07 PRINTER ERROR\n',
    'Turn the product off then on. If the error persists, reseat the formatter.',
    '\n\nResponda baseando-se nos trechos acima.',
  ].join('');

  const messages = [
    { role: 'user',      content: 'O que significa o erro 49.38.07?' },
    { role: 'assistant', content: 'O erro 49.38.07 indica falha no formatter.' },
    { role: 'user',      content: 'Como resolver definitivamente?' },
  ];

  const { history, userText } = buildGeminiMessages(messages);

  check('history[0].role === user (contents[0] será user)',  history[0]?.role, 'user');
  check('history tem 2 entradas (multi-turn preservado)',    history.length,    2);
  check('userText é a última query (contents final = user)', userText, 'Como resolver definitivamente?');

  const genai = new GoogleGenerativeAI('fake-key-for-local-validation');
  const mdl = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  let session = null;
  let threw = false;
  try {
    session = mdl.startChat({ history, systemInstruction: systemPrompt });
  } catch (e) { threw = true; }

  check('startChat não lança erro com payload legado',            threw, false);
  // chat.params.systemInstruction é acessível e idêntico ao systemPrompt original
  check('systemInstruction íntegro (não descartado pelo strip)', session?.params?.systemInstruction, systemPrompt);
}

// ── Resultado ─────────────────────────────────────────────────────────────────
console.log(`\n=== ${pass + fail} testes: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail > 0 ? 1 : 0);
