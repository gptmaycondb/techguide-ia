import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

export function biometricStorageKey(email) {
  return `tg_biometric_${String(email || '').trim().toLowerCase()}`;
}

export function normalizeBiometricPreference(value) {
  return value === 'on' || value === 'off' ? value : undefined;
}

export function getBiometricBootState(email, preference, available) {
  return email && preference === 'on' && available ? 'locked' : 'unlocked';
}

export function shouldOfferBiometric(email, preference, available) {
  return Boolean(email && available && preference === undefined);
}

export async function isBiometricAvailable() {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function getBiometricPreference(email) {
  if (!email) return undefined;
  try {
    return normalizeBiometricPreference(
      await AsyncStorage.getItem(biometricStorageKey(email))
    );
  } catch {
    return undefined;
  }
}

export async function setBiometricPreference(email, value) {
  if (!email || (value !== 'on' && value !== 'off')) return false;
  try {
    await AsyncStorage.setItem(biometricStorageKey(email), value);
    return true;
  } catch {
    return false;
  }
}

export async function authenticateBiometric() {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloqueie o TechGuide',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar PIN ou padrão',
      disableDeviceFallback: false,
      biometricsSecurityLevel: 'weak',
    });
    return result.success;
  } catch {
    return false;
  }
}
