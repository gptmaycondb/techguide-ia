import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_CREDENTIALS_KEY = 'biometric_login_credentials';
const BIOMETRIC_MARKER_KEY = 'biometric_login_available';
const BIOMETRIC_CREDENTIAL_OPTIONS = {
  requireAuthentication: true,
  authenticationPrompt: 'Confirme sua biometria para entrar no TechGuide',
  keychainService: 'techguide_biometric_login',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

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

export function classifyBiometricVaultError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return /cancel|canceled|cancelled|user.?denied|err_sec_user_canceled/.test(message)
    ? 'cancelled'
    : 'invalidated';
}

export function isStaleBiometricCredentialError(error) {
  return error?.code === 'invalid_credentials';
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

export async function hasBiometricCredentials() {
  try {
    return await SecureStore.getItemAsync(BIOMETRIC_MARKER_KEY) === '1';
  } catch {
    return false;
  }
}

export async function saveBiometricCredentials(email, password) {
  if (!email || !password) return false;
  try {
    if (!SecureStore.canUseBiometricAuthentication()) {
      await clearBiometricCredentials();
      return false;
    }
    const credentials = JSON.stringify({
      email: String(email).trim().toLowerCase(),
      password,
    });
    await SecureStore.setItemAsync(
      BIOMETRIC_CREDENTIALS_KEY,
      credentials,
      BIOMETRIC_CREDENTIAL_OPTIONS
    );
    await SecureStore.setItemAsync(
      BIOMETRIC_MARKER_KEY,
      '1'
    );
    return true;
  } catch {
    await clearBiometricCredentials();
    return false;
  }
}

export async function clearBiometricCredentials() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY, BIOMETRIC_CREDENTIAL_OPTIONS),
    SecureStore.deleteItemAsync(BIOMETRIC_MARKER_KEY),
  ]);
}

export async function readBiometricCredentials() {
  if (!await hasBiometricCredentials()) return { status: 'empty' };
  try {
    const raw = await SecureStore.getItemAsync(
      BIOMETRIC_CREDENTIALS_KEY,
      BIOMETRIC_CREDENTIAL_OPTIONS
    );
    if (!raw) {
      await clearBiometricCredentials();
      return { status: 'invalidated' };
    }
    const credentials = JSON.parse(raw);
    if (!credentials?.email || !credentials?.password) {
      await clearBiometricCredentials();
      return { status: 'invalidated' };
    }
    return { status: 'success', credentials };
  } catch (error) {
    const status = classifyBiometricVaultError(error);
    if (status === 'invalidated') await clearBiometricCredentials();
    return { status };
  }
}
