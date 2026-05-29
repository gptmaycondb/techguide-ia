import searchData from '../assets/search_index.json';

const SYNONYMS = {
  jam:'atolamento', jams:'atolamento', atolado:'atolamento', preso:'atolamento',
  paper:'papel', feed:'alimentar', feeding:'alimentar', feeder:'alimentador',
  toner:'cartucho', cartridge:'cartucho', cartridges:'cartucho',
  supply:'suprimento', supplies:'suprimento',
  fuser:'fusor', fusing:'fusor',
  tray:'bandeja', trays:'bandeja', cassette:'bandeja',
  scan:'digitalizar', scanner:'digitalizacao', scanning:'digitalizacao',
  print:'imprimir', printing:'impressao', printed:'impressao',
  network:'rede', wifi:'rede', wireless:'rede', ethernet:'rede', ip:'rede',
  error:'erro', fault:'falha', failure:'falha', errors:'erro',
  replace:'substituir', replacement:'substituicao', install:'instalar',
  roller:'rolo', rollers:'rolo', pickup:'puxada',
  board:'placa', formatter:'formatadora', pcb:'placa',
  configure:'configurar', configuration:'configuracao', setup:'configurar',
  quality:'qualidade', streaks:'riscos', spots:'manchas', blurry:'borrado',
  document:'documento', adf:'alimentador',
  calibrate:'calibrar', calibration:'calibracao',
  reset:'reiniciar', restart:'reiniciar', reboot:'reiniciar',
  memory:'memoria', firmware:'firmware', driver:'driver',
};

export const MANUAL_INDEX_MAP = {
  // HP
  'e52645_guia':    'e52645_guia',
  'cpmd':           'cpmd',
  'm501_catalog':   'service',
  'm527_catalog':   'service',
  'e50045_catalog': 'service',
  'e52545_catalog': 'service',
  // Ricoh
  'ricoh_imc3000':         'ricoh_imc3000_guia',
  'ricoh_imc3000_guia':    'ricoh_imc3000_guia',
  'ricoh_imc3000_service': 'ricoh_imc3000_service',
  'ricoh_imc3000_parts':   'ricoh_imc3000_parts',
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
  'before','during','press','select','open','close','make','sure','you','your',
  'all','any','new','page','figure','table','step','section','chapter',
  'product','information','available','provides','refer',
]);

function normalize(w) { return SYNONYMS[w] || w; }

function tokenize(text) {
  const errCodes = (text.match(/\d{2}\.\d{2}(?:\.\d{2})?(?:\.\*+)?/g) || [])
    .map(c => 'EC_' + c.replace(/\./g,'_'));
  const partNums = (text.match(/\b[A-Z]{1,3}\d{3,}[A-Z]?\b|\b[A-Z]{1,2}\d-\d{4,}\b/g) || [])
    .map(p => p.toLowerCase());
  const words = (text.toLowerCase().match(/[a-záéíóúâêîôûãõçàèìòùä-ÿa-z][a-záéíóúâêîôûãõçàèìòùä-ÿa-z0-9]{2,}/g) || [])
    .filter(w => !STOPWORDS.has(w))
    .map(normalize);
  return [...words, ...errCodes, ...partNums];
}

function bigrams(tokens) {
  const result = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].length > 3 && tokens[i+1].length > 3) {
      result.push(tokens[i] + '+' + tokens[i+1]);
    }
  }
  return result;
}

export function searchManual(query, indexKey, topK = 6) {
  const chunks = searchData[indexKey];
  if (!chunks?.length) return [];

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
      if (kTerms.has(term)) score += 3;
      else if (tTokens.has(term) || tBigrams.has(term)) score += 1;
      // Partial match
      if (term.length > 4) {
        for (const kt of kTerms) {
          if (kt !== term && (kt.includes(term) || term.includes(kt))) score += 0.5;
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
