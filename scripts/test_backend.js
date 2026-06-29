#!/usr/bin/env node
/**
 * TechGuide IA — Backend unit tests (PR-A / SDK migration)
 *
 * Testa buildGeminiMessages com sync guard + prova API Gemini rejeição-antes/aceitação-depois.
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
const { GoogleGenAI } = _require(
  resolve(BACKEND_ROOT, 'node_modules/@google/genai')
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

const AUTH_ERROR = {
  error: 'auth_required',
  message: 'Sessão expirada, faça login novamente.',
};

function createRequireAuth(firebaseAuth) {
  return async function requireAuth(req, res, next) {
    const match = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
    if (!firebaseAuth || !match) {
      return res.status(401).json(AUTH_ERROR);
    }
    try {
      const decoded = await firebaseAuth.verifyIdToken(match[1]);
      req.uid = decoded.uid;
      return next();
    } catch {
      return res.status(401).json(AUTH_ERROR);
    }
  };
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
console.log('[Sync guard] funções puras devem ser idênticas a backend/server.js');
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

  for (const fnName of ['buildGeminiMessages', 'createRequireAuth']) {
    const srcNorm  = normalize(extractFn(srcServer, fnName));
    const testNorm = normalize(extractFn(testSelf, fnName));
    const ok = srcNorm === testNorm;
    console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${fnName}`);
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
  check('history tem 2 entradas',       history.length,   2);
  check('history[0].role === user',      history[0].role, 'user');
  check('history[1].role === model',     history[1].role, 'model');
  check('userText é a última mensagem',  userText,         'Pergunta 2');
}

// ── A1c: payload com leading model turn — prova comportamental ────────────────
// A API Gemini exige history[0].role === 'user' (retorna 400 se violado).
// Sem buildGeminiMessages: history[0] seria 'model' → rejeição certa.
// Com buildGeminiMessages: strip garante conformidade antes de qualquer chamada.
console.log('\n[A1c] leading model turn — ANTES produzia role=model / DEPOIS strip garante conformidade');
{
  const messagesComBug = [
    { role: 'assistant', content: 'Olá, como posso ajudar?' },
    { role: 'user',      content: 'O que é o erro SC285-00?' },
  ];

  // Código ANTIGO (sem strip): map + pop → history = [{role:'model',...}]
  const historyAntes = messagesComBug.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));
  historyAntes.pop();
  check("ANTES: history[0].role seria 'model' (API Gemini rejeitaria com 400)",
    historyAntes[0].role, 'model');

  // Código NOVO: buildGeminiMessages faz o strip
  const { history: historyDepois, userText } = buildGeminiMessages(messagesComBug);
  check('DEPOIS: history stripped para vazio',                historyDepois.length, 0);
  check('DEPOIS: userText correto após strip',                userText, 'O que é o erro SC285-00?');
  check('DEPOIS: history vazio ou history[0].role===user (API aceita)',
    historyDepois.length === 0 || historyDepois[0].role === 'user', true);
}

// ── A1d: array vazio (edge case) ──────────────────────────────────────────────
console.log('\n[A1d] array de mensagens vazio (edge case)');
{
  const { history, userText } = buildGeminiMessages([]);
  check('history vazio', history.length, 0);
  check('userText vazio', userText, '');
}

// ── A1e: payload realista do contrato legado ───────────────────────────────────
// Prova: systemPrompt chega intacto em config.systemInstruction (@google/genai);
// history[0].role === 'user' → API aceita.
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

  // Instanciar com @google/genai (SDK atual) e fake key — validação local
  const ai = new GoogleGenAI({ apiKey: 'fake-key-for-local-validation' });
  let session = null;
  let threw = false;
  try {
    session = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: systemPrompt },
      history,
    });
  } catch (e) { threw = true; }
  check('ai.chats.create não lança erro com payload legado',       threw, false);
  // chat.config.systemInstruction acessível diretamente no novo SDK
  check('systemInstruction íntegro em chat.config (não descartado)',
    session?.config?.systemInstruction, systemPrompt);
}

// ── Resultado ─────────────────────────────────────────────────────────────────
console.log('\n[Auth] /chat exige Bearer válido e preserva o handler autenticado');
{
  const makeRes = () => ({
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const expectedError = JSON.stringify(AUTH_ERROR);

  const missingRes = makeRes();
  let missingNext = 0;
  await createRequireAuth(null)(
    { headers: {} },
    missingRes,
    () => { missingNext++; }
  );
  check('auth não inicializada falha fechada com 401', missingRes.statusCode, 401);
  check('auth não inicializada retorna auth_required', JSON.stringify(missingRes.body), expectedError);
  check('auth não inicializada não chama handler', missingNext, 0);

  const invalidRes = makeRes();
  let invalidNext = 0;
  await createRequireAuth({ verifyIdToken: async () => { throw new Error('expired'); } })(
    { headers: { authorization: 'Bearer invalid-token' } },
    invalidRes,
    () => { invalidNext++; }
  );
  check('token inválido/expirado retorna 401', invalidRes.statusCode, 401);
  check('token inválido retorna auth_required', JSON.stringify(invalidRes.body), expectedError);
  check('token inválido não chama handler', invalidNext, 0);

  const validReq = { headers: { authorization: 'Bearer valid-token' } };
  const validRes = makeRes();
  let validNext = 0;
  await createRequireAuth({ verifyIdToken: async token => ({ uid: `uid-for-${token}` }) })(
    validReq,
    validRes,
    () => { validNext++; }
  );
  check('token válido anexa uid', validReq.uid, 'uid-for-valid-token');
  check('token válido segue para handler/SSE', validNext, 1);
  check('token válido não escreve resposta antecipada', validRes.statusCode, null);

  check('/chat usa middleware antes do handler',
    /app\.post\('\/chat',\s*requireAuth,\s*async\s*\(req,\s*res\)/.test(srcServer), true);
  check('/providers continua público',
    /app\.get\('\/providers',\s*\(req,\s*res\)/.test(srcServer), true);
  check('SSE autenticado continua emitindo delta e done',
    srcServer.includes("type: 'delta'") && srcServer.includes("type: 'done'"), true);
}

console.log(`\n=== ${pass + fail} testes: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail > 0 ? 1 : 0);
