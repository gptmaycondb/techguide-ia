import { Tokenizer } from '@huggingface/tokenizers';

export const EMBEDDING_DIMENSION = 384;
export const MAX_SEQUENCE_LENGTH = 512;

export function createTokenizer(tokenizerJson, tokenizerConfig) {
  return new Tokenizer(tokenizerJson, tokenizerConfig);
}

export function encodeQuery(
  tokenizer,
  text,
  maxSequenceLength = MAX_SEQUENCE_LENGTH
) {
  const encoded = tokenizer.encode(text, { return_token_type_ids: true });
  const inputIds = encoded.ids.slice(0, maxSequenceLength);
  const attentionMask = encoded.attention_mask.slice(0, maxSequenceLength);
  const encodedTokenTypeIds =
    encoded.token_type_ids || new Array(encoded.ids.length).fill(0);
  const tokenTypeIds = encodedTokenTypeIds.slice(0, maxSequenceLength);

  if (encoded.ids.length > maxSequenceLength) {
    inputIds[maxSequenceLength - 1] = encoded.ids[encoded.ids.length - 1];
    attentionMask[maxSequenceLength - 1] =
      encoded.attention_mask[encoded.attention_mask.length - 1];
    tokenTypeIds[maxSequenceLength - 1] =
      encodedTokenTypeIds[encodedTokenTypeIds.length - 1];
  }

  return {
    inputIds,
    attentionMask,
    tokenTypeIds,
  };
}

export function cosine(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Vetores com dimensoes diferentes: ${a.length} e ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index++) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 1e-12 ? dot / denominator : 0;
}

export function rankEmbeddingAssets(queryVector, assets, topN = 5) {
  const scored = [];
  let ordinal = 0;

  for (const asset of assets) {
    if (asset.dimension !== queryVector.length) {
      throw new Error(
        `Embedding ${asset.searchKey} tem dimensao ${asset.dimension}; esperado ${queryVector.length}`
      );
    }

    for (let index = 0; index < asset.count; index++) {
      const offset = index * asset.dimension;
      const vector = asset.vectors.subarray(offset, offset + asset.dimension);
      scored.push({
        score: cosine(queryVector, vector),
        text: asset.texts[index],
        ordinal: ordinal++,
      });
    }
  }

  scored.sort((left, right) =>
    right.score - left.score || left.ordinal - right.ordinal
  );
  return scored.slice(0, topN).map(result => result.text);
}

export async function searchWithFallback({
  query,
  searchKeys,
  semanticSearch,
  keywordSearch,
  topN = 5,
}) {
  try {
    const results = await semanticSearch(query, searchKeys, topN);
    if (results.length) return { results, mode: 'semantic' };
  } catch {}

  return {
    results: searchKeys.flatMap(key => keywordSearch(query, key, 3)),
    mode: 'keyword',
  };
}
