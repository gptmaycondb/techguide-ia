import searchData from '../assets/search_index.json';

const STOPWORDS = new Set([
  'the','and','for','this','that','with','from','are','has','was','not','but',
  'have','been','will','can','its','they','their','more','also','when','into',
  'use','each','which','page','see','note','printer','following','using','used',
  'then','after','before','press','click','select','touch','open','close',
  'remove','install','para','com','que','uma','dos','nas','por','ser','como'
]);

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z][a-z0-9]*/g) || [])
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

export function searchManual(query, indexKey, topK = 5) {
  const chunks = searchData[indexKey];
  if (!chunks || !chunks.length) return [];

  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return [];

  const scored = chunks.map(chunk => {
    const kTokens = new Set(chunk.k.split(' '));
    const tTokens = new Set(tokenize(chunk.t));
    const score = [...qTokens].reduce((s, t) => {
      return s + (kTokens.has(t) ? 2 : 0) + (tTokens.has(t) ? 1 : 0);
    }, 0);
    return { score, text: chunk.t };
  }).filter(c => c.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(c => c.text);
}

export function hasRelevantContent(query, indexKey, minScore = 3) {
  const chunks = searchData[indexKey];
  if (!chunks) return false;
  const qTokens = new Set(tokenize(query));
  for (const chunk of chunks) {
    const kTokens = new Set(chunk.k.split(' '));
    const score = [...qTokens].filter(t => kTokens.has(t)).length * 2;
    if (score >= minScore) return true;
  }
  return false;
}
