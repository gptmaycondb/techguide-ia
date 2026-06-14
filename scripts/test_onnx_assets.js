import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  ensureVerifiedDownload,
  hashFileSha256,
  parseEmbeddingData,
} from '../src/onnxAssetsCore.js';

const encoder = new TextEncoder();

function toBytes(value) {
  return typeof value === 'string' ? encoder.encode(value) : Uint8Array.from(value);
}

function createMemoryFileSystem(initialFiles = {}) {
  const files = new Map(
    Object.entries(initialFiles).map(([path, value]) => [path, toBytes(value)])
  );
  const downloads = [];

  return {
    files,
    downloads,
    async getInfoAsync(path) {
      const data = files.get(path);
      return data
        ? { exists: true, size: data.length }
        : { exists: false, size: 0 };
    },
    async readAsStringAsync(path, options) {
      const data = files.get(path);
      if (!data) throw new Error(`Arquivo ausente: ${path}`);
      const chunk = data.slice(options.position, options.position + options.length);
      return Buffer.from(chunk).toString('base64');
    },
    async deleteAsync(path) {
      files.delete(path);
    },
    async moveAsync({ from, to }) {
      files.set(to, files.get(from));
      files.delete(from);
    },
    async downloadAsync(url, path) {
      downloads.push(url);
      const next = url.includes('corrupt') ? 'conteudo-corrompido' : 'modelo-valido';
      files.set(path, encoder.encode(next));
      return { status: 200, uri: path };
    },
  };
}

function nodeSha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  console.log('=== ONNX Assets Tests ===');

  const chunkBytes = 3 * 1024 * 1024;
  const knownBytes = new Uint8Array(chunkBytes + 5);
  for (let index = 0; index < knownBytes.length; index++) {
    knownBytes[index] = index % 251;
  }
  const fsHash = createMemoryFileSystem({ '/large': knownBytes });
  const actual = await hashFileSha256(
    fsHash,
    '/large',
    knownBytes.length,
    chunkBytes
  );
  assert.equal(actual, createHash('sha256').update(knownBytes).digest('hex'));
  console.log('  [OK] SHA-256 incremental: chunk de 3 MiB + cauda de 5 bytes');

  const expected = nodeSha256('modelo-valido');
  const fsCached = createMemoryFileSystem({ '/model.onnx': 'modelo-valido' });
  const cached = await ensureVerifiedDownload({
    fileSystem: fsCached,
    url: 'https://example/model.onnx',
    localPath: '/model.onnx',
    expectedSha256: expected,
  });
  assert.equal(cached.downloaded, false);
  assert.equal(fsCached.downloads.length, 0);
  console.log('  [OK] cache valido nao rebaixa');

  const fsDownload = createMemoryFileSystem();
  const downloaded = await ensureVerifiedDownload({
    fileSystem: fsDownload,
    url: 'https://example/model.onnx',
    localPath: '/model.onnx',
    expectedSha256: expected,
  });
  assert.equal(downloaded.downloaded, true);
  assert.equal(downloaded.attempts, 1);
  assert.equal(fsDownload.files.has('/model.onnx.download'), false);
  console.log('  [OK] download validado e promovido atomicamente');

  const fsCorrupt = createMemoryFileSystem();
  await assert.rejects(
    ensureVerifiedDownload({
      fileSystem: fsCorrupt,
      url: 'https://example/corrupt.onnx',
      localPath: '/model.onnx',
      expectedSha256: expected,
      maxAttempts: 2,
    }),
    /Falha ao baixar o modelo de busca/
  );
  assert.equal(fsCorrupt.downloads.length, 2);
  assert.equal(fsCorrupt.files.has('/model.onnx'), false);
  assert.equal(fsCorrupt.files.has('/model.onnx.download'), false);
  console.log('  [OK] hash divergente apaga arquivo e tenta 2 vezes');

  const parsed = parseEmbeddingData({
    manual: [
      { t: 'primeiro', e: [1, 0, 0] },
      { t: 'segundo', e: [0, 1, 0] },
    ],
  }, 'manual');
  assert.equal(parsed.count, 2);
  assert.equal(parsed.dimension, 3);
  assert.deepEqual(parsed.texts, ['primeiro', 'segundo']);
  assert.deepEqual(Array.from(parsed.vectors), [1, 0, 0, 0, 1, 0]);
  console.log('  [OK] embeddings convertidos para Float32Array contiguo');

  console.log('=== 5 testes: 5 passaram, 0 falharam ===');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
