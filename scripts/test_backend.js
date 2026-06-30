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

function parseDailyLimit(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10;
}

const DAILY_LIMIT = parseDailyLimit(process.env.DAILY_LIMIT);

function createRequireAuth(firebaseAuth) {
  return async function requireAuth(req, res, next) {
    const match = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
    if (!firebaseAuth || !match) {
      return res.status(401).json(AUTH_ERROR);
    }
    try {
      const decoded = await firebaseAuth.verifyIdToken(match[1]);
      req.uid = decoded.uid;
      req.email = decoded.email || null;
      return next();
    } catch {
      return res.status(401).json(AUTH_ERROR);
    }
  };
}

function getSaoPauloDay(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isMasterEmail(email, masterEmail) {
  return Boolean(email && masterEmail)
    && email.trim().toLowerCase() === masterEmail.trim().toLowerCase();
}

function createUsageLimit({
  firestore,
  fieldValue,
  masterEmail = process.env.MASTER_EMAIL,
  dailyLimit = DAILY_LIMIT,
  now = () => new Date(),
}) {
  return async function requireUsage(req, res, next) {
    if (isMasterEmail(req.email, masterEmail)) {
      req.usage = { unlimited: true };
      return next();
    }
    if (!firestore) {
      return res.status(503).json({
        error: 'usage_unavailable',
        message: 'Controle de consultas temporariamente indisponível. Tente novamente.',
      });
    }

    const day = getSaoPauloDay(now());
    const ref = firestore.collection('usage').doc(`${req.uid}_${day}`);
    let used = 0;
    try {
      await firestore.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const current = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0;
        if (current >= dailyLimit) {
          const error = new Error('daily_limit_reached');
          error.code = 'daily_limit_reached';
          throw error;
        }
        used = current + 1;
        transaction.set(ref, {
          uid: req.uid,
          day,
          count: fieldValue.increment(1),
          updatedAt: fieldValue.serverTimestamp(),
        }, { merge: true });
      });
    } catch (error) {
      if (error.code === 'daily_limit_reached') {
        return res.status(429).json({
          error: 'rate_limit',
          message: 'Limite diário de consultas atingido. Libera à meia-noite.',
          used: dailyLimit,
          limit: dailyLimit,
        });
      }
      console.error(`Usage limit failed for uid=${req.uid}:`, error.message);
      return res.status(503).json({
        error: 'usage_unavailable',
        message: 'Controle de consultas temporariamente indisponível. Tente novamente.',
      });
    }

    req.usage = { used, limit: dailyLimit, remaining: dailyLimit - used };
    return next();
  };
}

function isProviderRateLimit(error) {
  return error?.status === 429
    || error?.statusCode === 429
    || /(?:429|rate.?limit|quota|resource_exhausted)/i.test(error?.message || '');
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

  for (const fnName of [
    'buildGeminiMessages',
    'parseDailyLimit',
    'createRequireAuth',
    'getSaoPauloDay',
    'isMasterEmail',
    'createUsageLimit',
    'isProviderRateLimit',
  ]) {
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
console.log('\n[Config] DAILY_LIMIT aceita somente inteiro positivo');
{
  check('DAILY_LIMIT=5 usa 5', parseDailyLimit('5'), 5);
  check('DAILY_LIMIT ausente usa 10', parseDailyLimit(undefined), 10);
  check('DAILY_LIMIT=abc usa 10', parseDailyLimit('abc'), 10);
  check('DAILY_LIMIT=0 usa 10', parseDailyLimit('0'), 10);
  check('DAILY_LIMIT=-3 usa 10', parseDailyLimit('-3'), 10);
  check('DAILY_LIMIT decimal usa 10', parseDailyLimit('5.5'), 10);
}

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
  await createRequireAuth({ verifyIdToken: async token => ({
    uid: `uid-for-${token}`,
    email: 'tecnico@example.com',
  }) })(
    validReq,
    validRes,
    () => { validNext++; }
  );
  check('token válido anexa uid', validReq.uid, 'uid-for-valid-token');
  check('token válido anexa email', validReq.email, 'tecnico@example.com');
  check('token válido segue para handler/SSE', validNext, 1);
  check('token válido não escreve resposta antecipada', validRes.statusCode, null);

  check('/chat usa auth e limite antes do handler',
    /app\.post\('\/chat',\s*requireAuth,\s*requireUsage,\s*async\s*\(req,\s*res\)/.test(srcServer), true);
  check('/providers continua público',
    /app\.get\('\/providers',\s*\(req,\s*res\)/.test(srcServer), true);
  check('SSE autenticado continua emitindo delta e done',
    srcServer.includes("type: 'delta'") && srcServer.includes("type: 'done'"), true);
}

console.log('\n[Usage] limite diário transacional, mestre e fuso de Brasília');
{
  const fieldValue = {
    increment: value => ({ increment: value }),
    serverTimestamp: () => ({ serverTimestamp: true }),
  };
  const makeFirestore = initialCount => {
    const state = { count: initialCount, writes: 0 };
    return {
      state,
      collection: name => ({
        doc: id => ({ name, id }),
      }),
      runTransaction: async callback => callback({
        get: async () => ({
          exists: state.count > 0,
          data: () => ({ count: state.count }),
        }),
        set: (ref, data) => {
          state.count += data.count.increment;
          state.writes++;
          state.ref = ref;
          state.data = data;
        },
      }),
    };
  };
  const makeRes = () => ({
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });

  const firestore = makeFirestore(9);
  const acceptedReq = { uid: 'uid-1', email: 'user@example.com' };
  const acceptedRes = makeRes();
  let acceptedNext = 0;
  await createUsageLimit({
    firestore,
    fieldValue,
    masterEmail: 'master@example.com',
    now: () => new Date('2026-06-29T12:00:00Z'),
  })(acceptedReq, acceptedRes, () => { acceptedNext++; });
  check('consulta 10 é aceita', acceptedNext, 1);
  check('consulta aceita incrementa exatamente uma vez', firestore.state.count, 10);
  check('uso 10/10 é anexado à requisição', JSON.stringify(acceptedReq.usage),
    JSON.stringify({ used: 10, limit: 10, remaining: 0 }));
  check('documento usa UID + dia de São Paulo', firestore.state.ref.id, 'uid-1_2026-06-29');

  const blockedFirestore = makeFirestore(10);
  const blockedRes = makeRes();
  let blockedNext = 0;
  await createUsageLimit({
    firestore: blockedFirestore,
    fieldValue,
    masterEmail: 'master@example.com',
  })(
    { uid: 'uid-2', email: 'user@example.com' },
    blockedRes,
    () => { blockedNext++; }
  );
  check('11ª consulta retorna 429', blockedRes.statusCode, 429);
  check('11ª consulta retorna rate_limit', blockedRes.body.error, 'rate_limit');
  check('consulta bloqueada não chama provider/handler', blockedNext, 0);
  check('consulta bloqueada não incrementa', blockedFirestore.state.writes, 0);

  const configuredFirestore = makeFirestore(5);
  const configuredRes = makeRes();
  let configuredNext = 0;
  await createUsageLimit({
    firestore: configuredFirestore,
    fieldValue,
    masterEmail: 'master@example.com',
    dailyLimit: parseDailyLimit('5'),
  })(
    { uid: 'uid-5', email: 'user@example.com' },
    configuredRes,
    () => { configuredNext++; }
  );
  check('DAILY_LIMIT=5 bloqueia após 5 consultas', configuredRes.statusCode, 429);
  check('limite configurado não chama provider/handler', configuredNext, 0);
  check('resposta informa limite configurado 5', configuredRes.body.limit, 5);

  const masterReq = { uid: 'uid-master', email: 'MASTER@example.com' };
  const masterRes = makeRes();
  let masterNext = 0;
  await createUsageLimit({
    firestore: null,
    fieldValue,
    masterEmail: 'master@example.com',
  })(masterReq, masterRes, () => { masterNext++; });
  check('mestre ignora limite e Firestore', masterNext, 1);
  check('mestre recebe unlimited', masterReq.usage.unlimited, true);

  check('23:59 em Brasília ainda é o dia anterior',
    getSaoPauloDay(new Date('2026-06-29T02:59:59Z')), '2026-06-28');
  check('00:00 em Brasília inicia novo dia',
    getSaoPauloDay(new Date('2026-06-29T03:00:00Z')), '2026-06-29');
  check('email mestre é case-insensitive',
    isMasterEmail('Maycon@Example.com', 'maycon@example.com'), true);
}

console.log('\n[Provider 429] cota global não é mascarada como erro genérico');
{
  check('status 429 é reconhecido', isProviderRateLimit({ status: 429 }), true);
  check('RESOURCE_EXHAUSTED é reconhecido',
    isProviderRateLimit({ message: 'RESOURCE_EXHAUSTED: quota exceeded' }), true);
  check('erro comum não é classificado como 429',
    isProviderRateLimit({ status: 500, message: 'internal error' }), false);
  check('SSE inclui uso e provider_rate_limit',
    srcServer.includes("type: 'usage'") && srcServer.includes("'provider_rate_limit'"), true);
}

console.log(`\n=== ${pass + fail} testes: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail > 0 ? 1 : 0);
