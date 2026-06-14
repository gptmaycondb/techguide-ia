import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cosine,
  createTokenizer,
  encodeQuery,
  rankEmbeddingAssets,
} from '../src/semanticSearchCore.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultCacheDir = path.resolve(
  here,
  '..',
  '..',
  'work',
  'onnx-fase0-model'
);
const tokenizerCacheDir =
  process.env.ONNX_TOKENIZER_CACHE_DIR || defaultCacheDir;

function readJson(fileName) {
  return JSON.parse(
    fs.readFileSync(path.join(tokenizerCacheDir, fileName), 'utf8')
  );
}

function main() {
  console.log('=== Semantic Search Tests ===');

  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([1, 0], [-1, 0]), -1);
  assert.equal(cosine([0, 0], [1, 0]), 0);
  console.log('  [OK] cosine: identico, ortogonal, oposto e vetor zero');

  const ranked = rankEmbeddingAssets(
    Float32Array.from([1, 0]),
    [{
      searchKey: 'manual',
      texts: ['ortogonal', 'melhor', 'oposto'],
      vectors: Float32Array.from([0, 1, 1, 0, -1, 0]),
      dimension: 2,
      count: 3,
    }],
    2
  );
  assert.deepEqual(ranked, ['melhor', 'ortogonal']);
  console.log('  [OK] ranking: similaridade decrescente e topN');

  assert.ok(
    fs.existsSync(path.join(tokenizerCacheDir, 'tokenizer.json')),
    `Cache tokenizer ausente: ${tokenizerCacheDir}`
  );
  const tokenizer = createTokenizer(
    readJson('tokenizer.json'),
    readJson('tokenizer_config.json')
  );
  const encoded = encodeQuery(tokenizer, 'erro de fusor');
  assert.deepEqual(encoded.inputIds, [0, 70426, 8, 5639, 4970, 2]);
  assert.deepEqual(encoded.attentionMask, [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(encoded.tokenTypeIds, [0, 0, 0, 0, 0, 0]);
  console.log('  [OK] tokenizer cache: MATCH_PYTHON=true');
  console.log(`       input_ids=${JSON.stringify(encoded.inputIds)}`);

  const longEncoding = encodeQuery({
    encode() {
      return {
        ids: [0, 10, 11, 12, 2],
        attention_mask: [1, 1, 1, 1, 1],
        token_type_ids: [0, 0, 0, 0, 0],
      };
    },
  }, 'consulta longa', 4);
  assert.deepEqual(longEncoding.inputIds, [0, 10, 11, 2]);
  assert.deepEqual(longEncoding.attentionMask, [1, 1, 1, 1]);
  console.log('  [OK] truncamento preserva o token final especial');

  console.log('=== 4 testes: 4 passaram, 0 falharam ===');
  console.log(
    'Nota: inferencia ONNX completa exige onnxruntime-react-native no device (checkpoint 1C).'
  );
}

main();
