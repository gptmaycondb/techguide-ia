import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { BRAND_GROUPS } from './data';

export function findManual(modelId, manualId) {
  return BRAND_GROUPS.flatMap(brand => brand.models)
    .find(model => model.id === modelId)?.manuals.find(manual => manual.id === manualId);
}

export async function openManualPdf(manual) {
  const dest = FileSystem.documentDirectory + manual.localName;
  try {
    const contentUri = await FileSystem.getContentUriAsync(dest);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: contentUri, flags: 1, type: 'application/pdf' });
  } catch {
    await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: 'Abrir manual com...', UTI: 'com.adobe.pdf' });
  }
}
