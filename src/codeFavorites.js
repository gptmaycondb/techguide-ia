import { favoriteId, textHash } from './favorites.js';

export function canSaveCodeFavorite(entries, answer) {
  return Array.isArray(entries)
    && entries.length === 1
    && answer?.role === 'ai'
    && answer.streaming === false
    && !answer.isError
    && Boolean(answer.text);
}

export function createCodeFavorite({ entry, answer, manual, family, source }) {
  const id = favoriteId('code', `${entry.code}:${entry.serviceKey}:${textHash(entry.text)}`);
  return {
    type: 'code', id, label: entry.code, meta: source, color: '#F59E0B',
    code: entry.code, serviceKey: entry.serviceKey, text: entry.text, modelId: manual.id,
    savedCard: {
      entries: [{ ...entry }], family, modelId: manual.id,
      modelLabel: manual.label, modelColor: manual.color, source,
    },
    savedAnswer: {
      text: answer.text, source: answer.source, fromManual: answer.fromManual,
    },
  };
}

export function getCodeFavoriteRestoreMessages(item, idBase = Date.now()) {
  if (item?.type !== 'code' || !item.modelId || !item.savedCard?.entries?.length || !item.savedAnswer?.text) return null;
  return [
    { id: `favorite-card-${idBase}`, role: 'errorCode', entries: item.savedCard.entries.map(entry => ({ ...entry })), savedCard: { ...item.savedCard } },
    { id: `favorite-answer-${idBase + 1}`, role: 'ai', text: item.savedAnswer.text, source: item.savedAnswer.source, fromManual: item.savedAnswer.fromManual, streaming: false },
  ];
}
