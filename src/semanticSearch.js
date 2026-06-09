import * as FileSystem from 'expo-file-system';

// ── Constantes ────────────────────────────────────────────────────────────────

const RELEASE_TAG  = 'onnx-model-20260609-093209';
const RELEASE_BASE = `https://github.com/gptmaycondb/techguide-ia/releases/download/${RELEASE_TAG}/`;
const EMB_BASE     = 'https://raw.githubusercontent.com/gptmaycondb/techguide-ia/main/assets/embeddings/';

const CACHE_DIR    = (FileSystem.documentDirectory || '') + 'onnx-semantic/';
const MODEL_PATH   = CACHE_DIR + 'model_int8.onnx';
const TOK_PATH     = CACHE_DIR + 'tokenizer.json';

const HIDDEN_SIZE  = 384;
const MAX_SEQ_LEN  = 128;
const MAX_TOK_LEN  = 20; // max chars per SentencePiece token (conservative)

// ── Estado do módulo ──────────────────────────────────────────────────────────

let session     = null;  // ort.InferenceSession
let tokState    = null;  // { vocabMap, clsId, sepId, padId, unkId }
let initPromise = null;  // Promise singleton
const embCache  = {};    // searchKey → { texts: string[], vecs: Float32Array[] }

// ── Download ──────────────────────────────────────────────────────────────────

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

async function downloadIfMissing(url, localPath) {
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists && info.size > 0) return;
  const res = await FileSystem.downloadAsync(url, localPath);
  if (res.status !== 200) {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    throw new Error(`Download falhou: ${url} (status ${res.status})`);
  }
}

// ── Tokenizador SentencePiece Unigram ─────────────────────────────────────────
// Replica o comportamento do sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2:
// pré-processamento Metaspace (▁) + Viterbi Unigram + tokens especiais CLS/SEP/PAD.

function parseTokJson(json) {
  const added = Object.create(null);
  for (const t of (json.added_tokens || [])) added[t.content] = t.id;

  // Mapeia token string → [id, log-prob] para lookup O(1) no Viterbi
  const vocab    = json.model.vocab;   // Array de [token, score]
  const vocabMap = Object.create(null);
  for (let i = 0; i < vocab.length; i++) vocabMap[vocab[i][0]] = [i, vocab[i][1]];

  return {
    vocabMap,
    clsId: added['<s>']   ?? json.model.unk_id ?? 0,
    sepId: added['</s>']  ?? 2,
    padId: added['<pad>'] ?? 1,
    unkId: json.model.unk_id ?? added['<unk>'] ?? 3,
  };
}

function spEncode(text, vocabMap, unkId) {
  // Metaspace: prepend ▁ e substituir espaços por ▁ (U+2581)
  const norm = '▁' + text.replace(/\s+/g, '▁');
  const n    = norm.length;

  const dp      = new Float64Array(n + 1).fill(-Infinity);
  const backId  = new Int32Array(n + 1).fill(-1);
  const backLen = new Uint8Array(n + 1).fill(1);
  dp[0] = 0;

  for (let i = 0; i < n; i++) {
    if (dp[i] === -Infinity) continue;
    const limit = Math.min(MAX_TOK_LEN, n - i);
    for (let len = 1; len <= limit; len++) {
      const entry = vocabMap[norm.slice(i, i + len)];
      if (entry !== undefined) {
        const s = dp[i] + entry[1];
        if (s > dp[i + len]) {
          dp[i + len] = s;
          backId[i + len] = entry[0];
          backLen[i + len] = len;
        }
      }
    }
    // Fallback: posição não coberta → UNK + avança 1 char
    if (dp[i + 1] === -Infinity) {
      dp[i + 1]      = dp[i] - 10.0;
      backId[i + 1]  = unkId;
      backLen[i + 1] = 1;
    }
  }

  // Retrocesso (backtrack)
  const ids = [];
  let pos = n;
  while (pos > 0) {
    ids.unshift(backId[pos]);
    const len = backLen[pos];
    pos -= (len > 0 ? len : 1);
  }
  return ids;
}

function encodeText(text, tokState) {
  const { vocabMap, clsId, sepId, padId, unkId } = tokState;
  const toks = spEncode(text.trim(), vocabMap, unkId).slice(0, MAX_SEQ_LEN - 2);
  const ids  = [clsId, ...toks, sepId];
  const mask = new Array(ids.length).fill(1);
  while (ids.length < MAX_SEQ_LEN) { ids.push(padId); mask.push(0); }
  return { ids, mask };
}

// ── Inferência ONNX ───────────────────────────────────────────────────────────

async function runOnnx(queries) {
  const ort = require('onnxruntime-react-native');
  const B   = queries.length;
  const S   = MAX_SEQ_LEN;
  const enc = queries.map(q => encodeText(q, tokState));

  const inputIds   = new BigInt64Array(B * S);
  const attMask    = new BigInt64Array(B * S);
  const tokTypeIds = new BigInt64Array(B * S); // zeros

  for (let b = 0; b < B; b++) {
    for (let s = 0; s < S; s++) {
      inputIds[b * S + s]  = BigInt(enc[b].ids[s]  ?? 1);
      attMask[b * S + s]   = BigInt(enc[b].mask[s] ?? 0);
    }
  }

  const out    = await session.run({
    input_ids:      new ort.Tensor('int64', inputIds,   [B, S]),
    attention_mask: new ort.Tensor('int64', attMask,    [B, S]),
    token_type_ids: new ort.Tensor('int64', tokTypeIds, [B, S]),
  });
  const hidden = out.last_hidden_state.data; // Float32Array [B, S, H]

  return queries.map((_, b) => {
    const pooled = new Float32Array(HIDDEN_SIZE);
    let count = 0;
    for (let s = 0; s < S; s++) {
      if (enc[b].mask[s]) {
        count++;
        const off = (b * S + s) * HIDDEN_SIZE;
        for (let h = 0; h < HIDDEN_SIZE; h++) pooled[h] += hidden[off + h];
      }
    }
    const denom = Math.max(count, 1);
    let norm = 0;
    for (let h = 0; h < HIDDEN_SIZE; h++) { pooled[h] /= denom; norm += pooled[h] ** 2; }
    norm = Math.sqrt(norm);
    if (norm > 1e-9) for (let h = 0; h < HIDDEN_SIZE; h++) pooled[h] /= norm;
    return pooled;
  });
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function loadModel() {
  if (session && tokState) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await ensureDir();
      await downloadIfMissing(RELEASE_BASE + 'tokenizer.json', TOK_PATH);
      await downloadIfMissing(RELEASE_BASE + 'model_int8.onnx', MODEL_PATH);

      tokState = parseTokJson(
        JSON.parse(await FileSystem.readAsStringAsync(TOK_PATH))
      );

      const { InferenceSession } = require('onnxruntime-react-native');
      // onnxruntime-react-native espera caminho absoluto sem prefixo file://
      const absPath = MODEL_PATH.startsWith('file://') ? MODEL_PATH.slice(7) : MODEL_PATH;
      session = await InferenceSession.create(absPath, { executionProviders: ['cpu'] });

      console.log('[semanticSearch] modelo pronto');
      return true;
    } catch (e) {
      initPromise = null;
      console.warn('[semanticSearch] loadModel falhou:', e?.message ?? e);
      return false;
    }
  })();

  return initPromise;
}

export async function loadEmbeddings(searchKey) {
  if (embCache[searchKey]) return;
  const path = CACHE_DIR + searchKey + '.json';
  await downloadIfMissing(EMB_BASE + searchKey + '.json', path);
  const data   = JSON.parse(await FileSystem.readAsStringAsync(path));
  const chunks = data[searchKey] || [];
  embCache[searchKey] = {
    texts: chunks.map(c => c.t),
    vecs:  chunks.map(c => Float32Array.from(c.e)),
  };
}

export function unloadEmbeddings(searchKey) {
  delete embCache[searchKey];
}

export function isModelReady() {
  return !!(session && tokState);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d > 1e-9 ? dot / d : 0;
}

// Retorna string[] no mesmo formato que searchManual — drop-in replacement.
export async function semanticSearchManual(query, searchKeys, topN = 5) {
  if (!session || !tokState) return [];

  // Garante embeddings carregados (silencia erros por chave ausente)
  await Promise.all(searchKeys.map(k =>
    embCache[k] ? Promise.resolve() : loadEmbeddings(k).catch(() => {})
  ));

  const [qVec] = await runOnnx([query]);

  const scored = [];
  for (const key of searchKeys) {
    const cache = embCache[key];
    if (!cache) continue;
    for (let i = 0; i < cache.texts.length; i++) {
      scored.push({ sim: cosine(qVec, cache.vecs[i]), text: cache.texts[i] });
    }
  }

  scored.sort((a, b) => b.sim - a.sim);
  return scored.slice(0, topN).map(s => s.text);
}
