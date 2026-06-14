import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { toByteArray } from 'base64-js';

// Multiplo de 3 para que cada bloco Base64 termine alinhado; a cauda pode ter
// 1 ou 2 bytes e e decodificada como um bloco Base64 independente.
export const HASH_CHUNK_BYTES = 3 * 1024 * 1024;

export async function hashFileSha256(
  fileSystem,
  fileUri,
  fileSize,
  chunkBytes = HASH_CHUNK_BYTES
) {
  const hasher = sha256.create();
  let position = 0;

  while (position < fileSize) {
    const length = Math.min(chunkBytes, fileSize - position);
    const base64 = await fileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64',
      position,
      length,
    });
    const bytes = toByteArray(base64);
    if (bytes.length === 0) {
      throw new Error(`Leitura incompleta ao validar ${fileUri}`);
    }
    hasher.update(bytes);
    position += bytes.length;
  }

  return bytesToHex(hasher.digest());
}

export async function validateFileSha256(fileSystem, fileUri, expectedSha256) {
  const info = await fileSystem.getInfoAsync(fileUri, { size: true });
  if (!info.exists || !info.size) {
    return { valid: false, actualSha256: null, size: 0 };
  }

  const actualSha256 = await hashFileSha256(fileSystem, fileUri, info.size);
  return {
    valid: actualSha256.toLowerCase() === expectedSha256.toLowerCase(),
    actualSha256,
    size: info.size,
  };
}

export async function ensureVerifiedDownload({
  fileSystem,
  url,
  localPath,
  expectedSha256,
  maxAttempts = 2,
  onAttempt = () => {},
}) {
  const cached = await validateFileSha256(fileSystem, localPath, expectedSha256);
  if (cached.valid) {
    return { ...cached, downloaded: false, attempts: 0 };
  }
  if (cached.size > 0) {
    await fileSystem.deleteAsync(localPath, { idempotent: true });
  }

  const tempPath = `${localPath}.download`;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onAttempt(attempt, maxAttempts);
    await fileSystem.deleteAsync(tempPath, { idempotent: true });

    try {
      const result = await fileSystem.downloadAsync(url, tempPath);
      if (result.status !== 200) {
        throw new Error(`HTTP ${result.status}`);
      }

      const validation = await validateFileSha256(
        fileSystem,
        tempPath,
        expectedSha256
      );
      if (!validation.valid) {
        throw new Error(
          `SHA-256 divergente: esperado ${expectedSha256}, obtido ${validation.actualSha256}`
        );
      }

      await fileSystem.moveAsync({ from: tempPath, to: localPath });
      return { ...validation, downloaded: true, attempts: attempt };
    } catch (error) {
      lastError = error;
      await fileSystem.deleteAsync(tempPath, { idempotent: true });
    }
  }

  throw new Error(
    `Falha ao baixar o modelo de busca; tente em melhor conexao. ${lastError?.message || ''}`.trim()
  );
}

export function parseEmbeddingData(data, searchKey) {
  const chunks = data[searchKey];
  if (!Array.isArray(chunks)) {
    throw new Error(`Embeddings invalidos para ${searchKey}`);
  }

  const dimension = chunks[0]?.e?.length || 384;
  const vectors = new Float32Array(chunks.length * dimension);
  const texts = new Array(chunks.length);
  chunks.forEach((chunk, index) => {
    if (typeof chunk.t !== 'string') {
      throw new Error(`Texto invalido em ${searchKey}, item ${index}`);
    }
    if (!Array.isArray(chunk.e) || chunk.e.length !== dimension) {
      throw new Error(`Vetor invalido em ${searchKey}, item ${index}`);
    }
    texts[index] = chunk.t;
    vectors.set(chunk.e, index * dimension);
  });

  return {
    searchKey,
    texts,
    vectors,
    dimension,
    count: chunks.length,
  };
}
