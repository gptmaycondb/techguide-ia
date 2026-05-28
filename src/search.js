import searchData from '../assets/search_index.json';

// Synonyms - maps variants to canonical form
const SYNONYMS = {
  jam: 'atolamento', jams: 'atolamento', atolado: 'atolamento', preso: 'atolamento',
  travado: 'atolamento', stuck: 'atolamento', feed: 'atolamento',
  toner: 'cartucho', cartridge: 'cartucho', suprimento: 'cartucho', supply: 'cartucho',
  fuser: 'fusor', fusing: 'fusor', fixador: 'fusor', heat: 'fusor',
  tray: 'bandeja', cassette: 'bandeja', gaveta: 'bandeja',
  scan: 'digitalizacao', scanner: 'digitalizacao', scanning: 'digitalizacao',
  flatbed: 'digitalizacao', adf: 'digitalizacao',
  print: 'impressao', printing: 'impressao', imprimir: 'impressao',
  network: 'rede', ip: 'rede', ethernet: 'rede', wifi: 'rede', wireless: 'rede',
  error: 'erro', fault: 'erro', falha: 'erro', mensagem: 'erro', message: 'erro',
  replace: 'substituir', trocar: 'substituir', install: 'substituir',
  roller: 'rolo', rolete: 'rolo', pickup: 'rolo',
  board: 'placa', formatter: 'placa', formatadora: 'placa',
  configure: 'configurar', setup: 'configurar', ajustar: 'configurar',
  quality: 'qualidade', borrada: 'qualidade', manchada: 'qualidade',
  feeder: 'alimentador', document: 'alimentador', documento: 'alimentador',
};

const STOPWORDS = new Set([
  'de','da','do','das','dos','em','no','na','nos','nas','para','por','com',
  'que','um','uma','ao','aos','se','ou','mas','e','a','o','as','os','este',
  'esta','esse','essa','ele','ela','eles','elas','seu','sua','seus','suas',
  'nao','sim','ja','mais','bem','muito','pode','ser','ter','tem','foi','era',
  'como','quando','onde','qual','todo','toda','todos','cada','pelo','pela',
  'the','and','for','this','that','with','from','are','has','was','not','but',
  'have','been','will','can','its','they','their','more','also','when','into',
  'use','each','which','see','note','following','using','used','then','after',
  'before','during','press','click','select','open','close','remove','install',
  'place','make','sure','you','your','all','any','new','one','two','three',
  'page','figure','table','step','steps','section','chapter','product',
]);

function normalize(word) {
  const w = word.toLowerCase();
  return SYNONYMS[w] || w;
}

function tokenize(text) {
  // Extract error codes
  const errorCodes = (text.match(/\d{2}\.\d{2}(?:\.\d{2})?/g) || [])
    .map(c => 'err_' + c.replace(/\./g, '_'));

  // Extract part numbers
  const partNums = (text.match(/[A-Z]{1,3}\d{3,}[A-Z]?\b|\b[A-Z]{1,2}\d-\d{4,}/g) || [])
    .map(p => p.toLowerCase());

  // Regular words
  const words = (text.toLowerCase().match(/[a-záéíóúâêîôûãõçàèìòùä-ÿa-z][a-záéíóúâêîôûãõçàèìòùä-ÿa-z0-9]{2,}/g) || [])
    .filter(w => !STOPWORDS.has(w))
    .map(normalize);

  return [...words, ...errorCodes, ...partNums];
}

function bigrams(tokens) {
  const result = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].length > 3 && tokens[i+1].length > 3) {
      result.push(`${tokens[i]}+${tokens[i+1]}`);
    }
  }
  return result;
}

export const MANUAL_INDEX_MAP = {
  'e52645_guia':    'e52645_guia',
  'cpmd':           'cpmd',
  'm501_catalog':   'service',
  'm527_catalog':   'service',
  'e50045_catalog': 'service',
  'e52545_catalog': 'service',
};

export function searchManual(query, indexKey, topK = 6) {
  const chunks = searchData[indexKey];
  if (!chunks || !chunks.length) return [];

  const qTokens = tokenize(query);
  const qBigrams = bigrams(qTokens);
  const qAll = new Set([...qTokens, ...qBigrams]);

  if (qAll.size === 0) return [];

  const scored = chunks.map(chunk => {
    const kTerms = new Set(chunk.k.split(' '));
    const tTokens = new Set(tokenize(chunk.t));
    const tBigrams = new Set(bigrams(Array.from(tTokens)));

    let score = 0;
    for (const term of qAll) {
      if (kTerms.has(term)) score += 3;       // high TF-IDF keyword match
      else if (tTokens.has(term)) score += 1; // text match
      // Partial match for longer terms
      if (term.length > 4) {
        for (const kt of kTerms) {
          if (kt.includes(term) || term.includes(kt)) score += 0.5;
        }
      }
    }

    return { score, text: chunk.t };
  }).filter(c => c.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(c => c.text);
}

export function hasRelevantContent(query, indexKey, minScore = 2) {
  const chunks = searchData[indexKey];
  if (!chunks) return false;

  const qTokens = new Set(tokenize(query));
  for (const chunk of chunks) {
    const kTerms = new Set(chunk.k.split(' '));
    let score = 0;
    for (const t of qTokens) {
      if (kTerms.has(t)) score += 3;
      if (score >= minScore) return true;
    }
  }
  return false;
}
