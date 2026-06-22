export function getCodeFavoriteTarget(item) {
  if (item?.type !== 'code' || !item.modelId || !item.code) return null;
  return { modelId: item.modelId, code: item.code };
}
