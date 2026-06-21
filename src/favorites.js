import AsyncStorage from '@react-native-async-storage/async-storage';

export const favoriteId = (type, id) => `${type}:${id}`;

export function isFavorite(items, id) {
  return items.some(item => item.id === id);
}

export function addFavorite(items, item) {
  return isFavorite(items, item.id) ? items : [item, ...items];
}

export function removeFavorite(items, id) {
  return items.filter(item => item.id !== id);
}

export async function listFavorites(email) {
  if (!email) return [];
  try {
    const raw = await AsyncStorage.getItem(`tg_favorites_${email}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveFavorites(email, items) {
  if (!email) return;
  try { await AsyncStorage.setItem(`tg_favorites_${email}`, JSON.stringify(items)); } catch {}
}
