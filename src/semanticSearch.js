import * as FileSystem from 'expo-file-system';

import {
  MODEL_PATH,
  ensureModelAsset,
  ensureTokenizerAssets,
  loadEmbeddingAsset,
  unloadEmbeddingAsset,
} from './onnxAssets';
import {
  EMBEDDING_DIMENSION,
  cosine,
  createTokenizer,
  encodeQuery,
  rankEmbeddingAssets,
} from './semanticSearchCore';

let session = null;
let tokenizer = null;
let loadPromise = null;
const embeddingCache = new Map();

function toModelPath(uri) {
  return uri.startsWith('file://') ? uri.slice(7) : uri;
}

async function readJson(path) {
  return JSON.parse(await FileSystem.readAsStringAsync(path));
}

async function loadTokenizerFromCache() {
  const paths = await ensureTokenizerAssets();
  const [tokenizerJson, tokenizerConfig] = await Promise.all([
    readJson(paths['tokenizer.json']),
    readJson(paths['tokenizer_config.json']),
  ]);
  return createTokenizer(tokenizerJson, tokenizerConfig);
}

export async function loadModel() {
  if (session && tokenizer) return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const [{ InferenceSession }, , loadedTokenizer] =
        await Promise.all([
          import('onnxruntime-react-native'),
          ensureModelAsset(),
          loadTokenizerFromCache(),
        ]);

      const loadedSession = await InferenceSession.create(
        toModelPath(MODEL_PATH),
        { executionProviders: ['cpu'] }
      );
      if (!loadedSession.outputNames.includes('sentence_embedding')) {
        throw new Error('Modelo ONNX sem a saida sentence_embedding');
      }

      session = loadedSession;
      tokenizer = loadedTokenizer;
      return true;
    } catch (error) {
      session = null;
      tokenizer = null;
      loadPromise = null;
      console.warn('[semanticSearch] loadModel falhou:', error?.message || error);
      return false;
    }
  })();

  return loadPromise;
}

export async function embedQuery(text) {
  if (!session || !tokenizer) {
    const loaded = await loadModel();
    if (!loaded) throw new Error('Modelo semantico indisponivel');
  }

  const { Tensor } = await import('onnxruntime-react-native');
  const encoded = encodeQuery(tokenizer, text);
  const sequenceLength = encoded.inputIds.length;
  const dimensions = [1, sequenceLength];
  const toInt64 = values => BigInt64Array.from(values, value => BigInt(value));

  const outputs = await session.run({
    input_ids: new Tensor('int64', toInt64(encoded.inputIds), dimensions),
    attention_mask: new Tensor(
      'int64',
      toInt64(encoded.attentionMask),
      dimensions
    ),
    token_type_ids: new Tensor(
      'int64',
      toInt64(encoded.tokenTypeIds),
      dimensions
    ),
  });
  const output = outputs.sentence_embedding;
  if (
    !output ||
    output.dims.length !== 2 ||
    output.dims[1] !== EMBEDDING_DIMENSION ||
    output.data.length !== EMBEDDING_DIMENSION
  ) {
    throw new Error(
      `Saida sentence_embedding invalida: ${output?.dims?.join('x') || 'ausente'}`
    );
  }

  return Float32Array.from(output.data);
}

export async function loadEmbeddings(searchKey) {
  const asset = await loadEmbeddingAsset(searchKey);
  embeddingCache.set(searchKey, asset);
  return asset;
}

export function unloadEmbeddings(searchKey) {
  embeddingCache.delete(searchKey);
  unloadEmbeddingAsset(searchKey);
}

export function isModelReady() {
  return !!(session && tokenizer);
}

export { cosine };

export async function semanticSearchManual(query, searchKeys, topN = 5) {
  if (!session || !tokenizer) return [];

  const missingKeys = searchKeys.filter(key => !embeddingCache.has(key));
  if (missingKeys.length) {
    await Promise.all(
      missingKeys.map(key => loadEmbeddings(key).catch(() => null))
    );
  }

  const queryVector = await embedQuery(query);
  const assets = searchKeys
    .map(key => embeddingCache.get(key))
    .filter(Boolean);
  return rankEmbeddingAssets(queryVector, assets, topN);
}
