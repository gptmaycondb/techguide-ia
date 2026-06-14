import * as FileSystem from 'expo-file-system';

import {
  ensureVerifiedDownload,
  parseEmbeddingData,
} from './onnxAssetsCore';

const RELEASE_TAG = 'onnx-model-20260614-191240';
const RELEASE_BASE =
  `https://github.com/gptmaycondb/techguide-ia/releases/download/${RELEASE_TAG}/`;
const EMBEDDINGS_BASE =
  'https://raw.githubusercontent.com/gptmaycondb/techguide-ia/main/assets/embeddings/';

export const MODEL_SHA256 =
  '98a9bcef0aff158b554dd6d51cc7c26b99336a9f6c37a67c1ca6d1881038a3c4';
export const MODEL_URL = `${RELEASE_BASE}model.onnx`;

const CACHE_DIR = `${FileSystem.documentDirectory || ''}onnx-semantic-v2/`;
export const MODEL_PATH = `${CACHE_DIR}model.onnx`;
const TOKENIZER_FILES = [
  'tokenizer.json',
  'tokenizer_config.json',
  'config.json',
];

const listeners = new Set();
const embeddingsCache = new Map();
let modelPromise = null;
let readiness = {
  status: 'idle',
  message: '',
  error: null,
};

function updateReadiness(next) {
  readiness = { ...readiness, ...next };
  for (const listener of listeners) listener(readiness);
}

export function getOnnxAssetsState() {
  return readiness;
}

export function subscribeOnnxAssets(listener) {
  listeners.add(listener);
  listener(readiness);
  return () => listeners.delete(listener);
}

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

async function ensureNonEmptyDownload(url, localPath) {
  const cached = await FileSystem.getInfoAsync(localPath, { size: true });
  if (cached.exists && cached.size > 0) return localPath;

  const tempPath = `${localPath}.download`;
  await FileSystem.deleteAsync(tempPath, { idempotent: true });
  const result = await FileSystem.downloadAsync(url, tempPath);
  if (result.status !== 200) {
    await FileSystem.deleteAsync(tempPath, { idempotent: true });
    throw new Error(`Download falhou: ${url} (HTTP ${result.status})`);
  }
  const downloaded = await FileSystem.getInfoAsync(tempPath, { size: true });
  if (!downloaded.exists || !downloaded.size) {
    await FileSystem.deleteAsync(tempPath, { idempotent: true });
    throw new Error(`Download vazio: ${url}`);
  }
  await FileSystem.moveAsync({ from: tempPath, to: localPath });
  return localPath;
}

export async function ensureModelAsset() {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    await ensureCacheDir();
    updateReadiness({
      status: 'downloading',
      message: 'Baixando modelo de busca...',
      error: null,
    });

    try {
      const result = await ensureVerifiedDownload({
        fileSystem: FileSystem,
        url: MODEL_URL,
        localPath: MODEL_PATH,
        expectedSha256: MODEL_SHA256,
        maxAttempts: 2,
        onAttempt: (attempt, total) => updateReadiness({
          status: 'downloading',
          message: `Baixando modelo de busca... (${attempt}/${total})`,
        }),
      });
      updateReadiness({
        status: 'ready',
        message: 'Modelo de busca pronto.',
        error: null,
      });
      return result;
    } catch (error) {
      modelPromise = null;
      updateReadiness({
        status: 'error',
        message: error.message,
        error,
      });
      throw error;
    }
  })();

  return modelPromise;
}

export async function ensureTokenizerAssets() {
  await ensureCacheDir();
  const paths = {};
  for (const fileName of TOKENIZER_FILES) {
    const localPath = `${CACHE_DIR}${fileName}`;
    paths[fileName] = await ensureNonEmptyDownload(
      `${RELEASE_BASE}${fileName}`,
      localPath
    );
  }
  return paths;
}

export async function loadEmbeddingAsset(searchKey) {
  if (embeddingsCache.has(searchKey)) {
    return embeddingsCache.get(searchKey);
  }

  await ensureCacheDir();
  const localPath = `${CACHE_DIR}embeddings-${searchKey}.json`;
  await ensureNonEmptyDownload(
    `${EMBEDDINGS_BASE}${encodeURIComponent(searchKey)}.json`,
    localPath
  );

  const data = JSON.parse(await FileSystem.readAsStringAsync(localPath));
  const loaded = {
    ...parseEmbeddingData(data, searchKey),
    localPath,
  };
  embeddingsCache.set(searchKey, loaded);
  return loaded;
}

export async function loadEmbeddingAssets(searchKeys) {
  const loaded = [];
  for (const searchKey of searchKeys) {
    loaded.push(await loadEmbeddingAsset(searchKey));
  }
  return loaded;
}

export function unloadEmbeddingAsset(searchKey) {
  embeddingsCache.delete(searchKey);
}

export function unloadEmbeddingAssets(searchKeys) {
  for (const searchKey of searchKeys) unloadEmbeddingAsset(searchKey);
}
