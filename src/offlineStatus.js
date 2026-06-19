import * as FileSystem from 'expo-file-system';
import { BRAND_GROUPS } from './data';

export async function getManualDownloadStatus(manual) {
  const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory + manual.localName);
  return info.exists && (info.size || 0) > 10000;
}

export async function getModelOfflineStatus(modelId) {
  const model = BRAND_GROUPS.flatMap(brand => brand.models).find(item => item.id === modelId);
  if (!model) return { downloaded: 0, total: 0, availableOffline: false };
  const states = await Promise.all(model.manuals.map(getManualDownloadStatus));
  const downloaded = states.filter(Boolean).length;
  return { downloaded, total: states.length, availableOffline: downloaded > 0 };
}
