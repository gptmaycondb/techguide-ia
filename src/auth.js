import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FIREBASE_API_KEY = 'AIzaSyAMZXXVH3b4KIMLOOe7UNAzBFgRTAfdDMk';

const SIGN_IN_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + FIREBASE_API_KEY;
const REFRESH_URL =
  'https://securetoken.googleapis.com/v1/token?key=' + FIREBASE_API_KEY;

const KEYS = {
  idToken:       'auth_idToken',
  refreshToken:  'auth_refreshToken',
  email:         'auth_email',
  expiry:        'auth_expiry',
  remember:      'auth_remember',
  savedPassword: 'auth_saved_password',
};

const RECENT_EMAILS_KEY = 'recent_emails';
const MAX_RECENT = 5;

function mapFirebaseError(code) {
  const map = {
    'EMAIL_NOT_FOUND':             'E-mail não encontrado.',
    'INVALID_PASSWORD':            'Senha incorreta.',
    'INVALID_EMAIL':               'E-mail inválido.',
    'USER_DISABLED':               'Conta desativada. Contate o administrador.',
    'TOO_MANY_ATTEMPTS_TRY_LATER': 'Muitas tentativas. Tente mais tarde.',
    'INVALID_LOGIN_CREDENTIALS':   'E-mail ou senha incorretos.',
  };
  return map[code] || 'Erro de autenticação. Tente novamente.';
}

async function _refreshToken(refreshToken, email) {
  try {
    const res = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error('refresh_failed');
    const expiry = String(Date.now() + Number(data.expires_in) * 1000);
    await SecureStore.setItemAsync(KEYS.idToken,      data.id_token);
    await SecureStore.setItemAsync(KEYS.refreshToken, data.refresh_token);
    await SecureStore.setItemAsync(KEYS.expiry,       expiry);
    return { email };
  } catch {
    await Promise.all([KEYS.idToken, KEYS.refreshToken, KEYS.expiry]
      .map(k => SecureStore.deleteItemAsync(k)));
    return null;
  }
}

export async function login(email, password, rememberPassword = false) {
  const res = await fetch(SIGN_IN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(mapFirebaseError(data?.error?.message || 'LOGIN_FAILED'));
  }
  const expiry = String(Date.now() + Number(data.expiresIn) * 1000);
  await SecureStore.setItemAsync(KEYS.idToken,      data.idToken);
  await SecureStore.setItemAsync(KEYS.refreshToken, data.refreshToken);
  await SecureStore.setItemAsync(KEYS.email,        data.email);
  await SecureStore.setItemAsync(KEYS.expiry,       expiry);

  if (rememberPassword) {
    await SecureStore.setItemAsync(KEYS.savedPassword, password);
    await SecureStore.setItemAsync(KEYS.remember,      'true');
  } else {
    await SecureStore.deleteItemAsync(KEYS.savedPassword);
    await SecureStore.setItemAsync(KEYS.remember, 'false');
  }

  return { email: data.email };
}

export async function logout() {
  await Promise.all(Object.values(KEYS).map(k => SecureStore.deleteItemAsync(k)));
}

export async function restoreSession() {
  const [idToken, refreshToken, email, expiry, remember, savedPassword] = await Promise.all([
    SecureStore.getItemAsync(KEYS.idToken),
    SecureStore.getItemAsync(KEYS.refreshToken),
    SecureStore.getItemAsync(KEYS.email),
    SecureStore.getItemAsync(KEYS.expiry),
    SecureStore.getItemAsync(KEYS.remember),
    SecureStore.getItemAsync(KEYS.savedPassword),
  ]);

  if (!refreshToken || !email) return null;

  // Se o usuário desmarcou "lembrar senha", não restaurar sessão
  if (remember === 'false') return null;

  const expiryMs = Number(expiry) || 0;
  if (idToken && expiryMs > Date.now() + 60000) return { email };

  // Try silent token refresh
  const session = await _refreshToken(refreshToken, email);
  if (session) return session;

  // Fallback: re-authenticate with saved password (only if remember=true)
  if (remember === 'true' && savedPassword) {
    try {
      return await login(email, savedPassword, true);
    } catch {
      return null;
    }
  }

  return null;
}

export async function getValidToken() {
  const [idToken, refreshToken, email, expiry] = await Promise.all([
    SecureStore.getItemAsync(KEYS.idToken),
    SecureStore.getItemAsync(KEYS.refreshToken),
    SecureStore.getItemAsync(KEYS.email),
    SecureStore.getItemAsync(KEYS.expiry),
  ]);
  if (!refreshToken) return null;
  if (idToken && Number(expiry) > Date.now() + 60000) return idToken;
  const session = await _refreshToken(refreshToken, email);
  if (!session) return null;
  return SecureStore.getItemAsync(KEYS.idToken);
}

export async function getRememberPreference() {
  const [remember, email] = await Promise.all([
    SecureStore.getItemAsync(KEYS.remember),
    SecureStore.getItemAsync(KEYS.email),
  ]);
  return { remember: remember !== 'false', email: email || null };
}

export async function saveRecentEmail(email) {
  try {
    const stored = await AsyncStorage.getItem(RECENT_EMAILS_KEY);
    const list = stored ? JSON.parse(stored) : [];
    const updated = [email, ...list.filter(e => e !== email)].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(updated));
  } catch {}
}

export async function getRecentEmails() {
  try {
    const stored = await AsyncStorage.getItem(RECENT_EMAILS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}
