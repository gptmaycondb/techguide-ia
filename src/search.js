import searchData from '../assets/search_index.json';
import errorCodesData from '../assets/error_codes_index.json';

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
  'mfpe52645':      'e52645_guia',
  'e52645_guia':    'e52645_guia',
  'cpmd':           'cpmd',
  'service':        'service',
  // HP E62655
  'mfpe62655':      'e62655_guia',
  'e62655_guia':    'e62655_guia',
  'e62655_cpmd':    'e62655_cpmd',
  'e62655_service': 'e62655_service',
  // Ricoh IM C3000/3500
  'ricoh_imc3000':         'ricoh_imc3000_guia',
  'ricoh_imc3000_guia':    'ricoh_imc3000_guia',
  'ricoh_imc3000_service': 'ricoh_imc3000_service',
  'ricoh_imc3000_parts':   'ricoh_imc3000_parts',
  // Ricoh MP C3004/3504
  'ricoh_mpc3004':         'ricoh_mpc3004_guia',
  'ricoh_mpc3004_guia':    'ricoh_mpc3004_guia',
  'ricoh_mpc3004_service': 'ricoh_mpc3004_service',
  // Ricoh SP 3710DN/SF
  'ricoh_sp3710':         'ricoh_sp3710_guia',
  'ricoh_sp3710_guia':    'ricoh_sp3710_guia',
  'ricoh_sp3710_service': 'ricoh_sp3710_service',
  'ricoh_sp3710_psg':     'ricoh_sp3710_psg',
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
      // Partial match — limita comprimento para evitar "ricoh" inflar contra "ricohlearninginstitute"
      if (term.length > 4) {
        for (const kt of kTerms) {
          if (kt !== term && (kt.includes(term) || term.includes(kt))
              && kt.length <= term.length * 2.5 && term.length <= kt.length * 2.5) {
            score += 0.5;
          }
        }
      }
    }
    return { score, text: chunk.t };
  }).filter(c => c.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(c => c.text);
}

// Verifica se uma chave do índice (ex: "50.2X.YZ") é um padrão wildcard HP
// que corresponde a um código real (ex: "50.2F.00") com dígitos hex.
function wildcardMatchHP(pattern, code) {
  if (!/[XYZ]/.test(pattern)) return false;
  const regex = new RegExp(
    '^' + pattern.replace(/\./g, '\\.').replace(/[XYZ]/g, '[0-9A-Fa-f]') + '$',
    'i'
  );
  return regex.test(code);
}

// indexKey aceita string (key única) ou array de strings (todas as keys do modelo).
// Array = isolamento cross-model preservado; as keys do modelo delimitam o filtro.
// NÃO "simplificar" de volta para uma key única — ver CLAUDE.md § searchErrorCode.
export function searchErrorCode(query, indexKey) {
  const keySet = indexKey
    ? new Set(Array.isArray(indexKey) ? indexKey : [indexKey])
    : null;
  const matchKey = keySet ? e => keySet.has(e.key) : () => true;

  // Normaliza "SC 400" → "SC400", "SC 543-00" → "SC543-00"
  const q = query.trim().replace(/\b(SC)\s+(\d)/gi, '$1$2');
  const codes = [
    // Captura o sufixo "-NN" quando presente (ex: "SC681-12") para acertar o
    // subcódigo exato; sem hífen continua casando a base/forma canônica (SC68112).
    ...(q.toUpperCase().match(/SC\d{3,6}(?:-\d{2})?/g) || []),
    ...(q.match(/\b\d{2}\.\d{2}(?:\.\d{2}(?:\.\d{2})?)?\b/g) || []),
    // HP codes com dígitos hex (ex: 50.2F.00, 49.38.07 com letra)
    ...(q.toUpperCase().match(/\b\d{2}\.[0-9A-F]{2,3}(?:\.[0-9A-F]{2})?\b/g) || []),
    ...(q.toUpperCase().match(/\bJ\d{3,6}\b/g) || []),
  ];

  const direct = q.toUpperCase().replace(/^(ERRO|ERROR|CODIGO|CODE|FALHA)\s+/i, '').trim();
  const toTry = codes.length > 0 ? codes : [direct];

  const raw = [];
  for (const code of toTry) {
    if (errorCodesData[code]) {
      const filtered = errorCodesData[code].filter(matchKey);
      if (filtered.length) raw.push(...filtered.map(e => e.text));
    } else {
      for (const [k, entries] of Object.entries(errorCodesData)) {
        if (k.startsWith(code) || (code.length >= 4 && k.includes(code)) || wildcardMatchHP(k, code)) {
          const filtered = entries.filter(matchKey);
          if (filtered.length) raw.push(...filtered.map(e => e.text));
          if (raw.length >= 5) break;
        }
      }
    }
    if (raw.length >= 5) break;
  }
  // Dedup by leading 80 chars (same text may appear under multiple matching keys)
  const seen = new Set();
  const results = [];
  for (const t of raw) {
    const sig = t.slice(0, 80);
    if (!seen.has(sig)) { seen.add(sig); results.push(t); }
    if (results.length >= 5) break;
  }
  return results;
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

// Gate booleano para o selo "● Manual" e o modo offline.
// errorChunks>0 é condição suficiente: a entrada vem do error_codes_index.json,
// que é construído a partir dos PDFs — logo o conteúdo é "do manual" por definição.
// hasRelevantContent verifica keywords EC_* no search_index, que não cobre subcódigos
// bullet nem stubs adicionados fora da extração textual (ex: Lote 1, PR-2).
// Confirmado via APK diagnóstico (device Hermes): q=66.80.03, errorChunks=1,
// hasRC=[false,false,false] → resultado correto é true.
export function computeFoundInManual(errorChunks, chunks, hasRC) {
  if (errorChunks.length > 0) return true;
  return chunks.length > 0 && hasRC.some(Boolean);
}
