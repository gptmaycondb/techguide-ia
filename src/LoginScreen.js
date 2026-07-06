import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Image,
  KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import {
  login,
  loginWithBiometricCredentials,
  getRememberPreference,
  saveRecentEmail,
  getRecentEmails,
} from './auth';
import {
  clearBiometricCredentials,
  hasBiometricCredentials,
  isStaleBiometricCredentialError,
  readBiometricCredentials,
} from './biometrics';
import { colors as C, radius, spacing } from './theme';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [focused, setFocused]       = useState(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [recentEmails, setRecentEmails] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [biometricLoginAvailable, setBiometricLoginAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const passwordRef = useRef(null);

  useEffect(() => {
    async function init() {
      const [pref, recents, hasCredentials] = await Promise.all([
        getRememberPreference(),
        getRecentEmails(),
        hasBiometricCredentials(),
      ]);
      if (pref.email) setEmail(pref.email);
      setRememberMe(pref.remember);
      setRecentEmails(recents);
      setBiometricLoginAvailable(hasCredentials);
    }
    init();
  }, []);

  const filteredEmails = recentEmails.filter(e =>
    email.length === 0 || e.toLowerCase().startsWith(email.toLowerCase())
  );

  function handleSelectEmail(selected) {
    setEmail(selected);
    setShowDropdown(false);
    passwordRef.current?.focus();
  }

  async function handleLogin() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { email: confirmed } = await login(trimmed, password, rememberMe);
      await saveRecentEmail(confirmed);
      onLoginSuccess(confirmed, password, { method: 'password' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    setError('');
    setBiometricLoading(true);
    try {
      const vault = await readBiometricCredentials();
      if (vault.status === 'cancelled') return;
      if (vault.status === 'empty') {
        setBiometricLoginAvailable(false);
        return;
      }
      if (vault.status === 'invalidated') {
        setBiometricLoginAvailable(false);
        setError('Biometria alterada no aparelho — entre com a senha e ative novamente.');
        return;
      }

      try {
        const { email: confirmed } = await loginWithBiometricCredentials(
          vault.credentials.email,
          vault.credentials.password
        );
        await saveRecentEmail(confirmed);
        onLoginSuccess(confirmed, null, { method: 'biometric' });
      } catch (loginError) {
        if (isStaleBiometricCredentialError(loginError)) {
          await clearBiometricCredentials();
          setBiometricLoginAvailable(false);
          setError('Senha alterada — entre com a nova senha.');
        } else {
          setError(loginError.message);
        }
      }
    } finally {
      setBiometricLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          style={{ backgroundColor: C.bg }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image source={require('../assets/icon.png')} style={styles.logo} />
          <Text style={styles.title}>TechGuide IA</Text>
          <Text style={styles.subtitle}>Acesso restrito · Técnico autorizado</Text>
          <View style={styles.divider} />

          <View style={styles.form}>
            {/* E-mail com dropdown */}
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.emailWrap}>
              <TextInput
                style={[styles.input, focused === 'email' && styles.inputFocused]}
                value={email}
                onChangeText={v => { setEmail(v); setShowDropdown(true); }}
                onFocus={() => { setFocused('email'); setShowDropdown(true); }}
                onBlur={() => { setFocused(null); setTimeout(() => setShowDropdown(false), 150); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="seu@email.com"
                placeholderTextColor={C.muted}
                editable={!loading}
              />
              {showDropdown && filteredEmails.length > 0 && (
                <View style={styles.dropdown}>
                  {filteredEmails.map((e, i) => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.dropItem, i < filteredEmails.length - 1 && styles.dropItemBorder]}
                      onPress={() => handleSelectEmail(e)}
                    >
                      <Text style={styles.dropItemText}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Senha */}
            <Text style={[styles.label, { marginTop: 14 }]}>Senha</Text>
            <View style={styles.pwWrap}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.inputPw, focused === 'password' && styles.inputFocused]}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                placeholder="••••••••"
                placeholderTextColor={C.muted}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPw(v => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeText}>{showPw ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            {/* Lembrar senha */}
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(v => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Lembrar senha</Text>
            </TouchableOpacity>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading || biometricLoading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={C.white} size="small" />
                : <Text style={styles.btnText}>Entrar →</Text>
              }
            </TouchableOpacity>

            {biometricLoginAvailable && (
              <TouchableOpacity
                style={[styles.biometricBtn, biometricLoading && styles.btnDisabled]}
                onPress={handleBiometricLogin}
                disabled={loading || biometricLoading}
                activeOpacity={0.85}
              >
                {biometricLoading
                  ? <ActivityIndicator color={C.accent} size="small" />
                  : <Text style={styles.biometricBtnText}>Entrar com biometria</Text>
                }
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.footer}>
            Acesso exclusivo para técnicos habilitados
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: C.bg },
  scroll:   { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, paddingVertical: 48 },
  logo:     { width: 80, height: 80, borderRadius: radius.card, marginBottom: 18 },
  title:    { color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { color: C.dim, fontSize: 12, marginTop: 6, letterSpacing: 0.3 },
  divider:  { width: 40, height: 3, backgroundColor: C.accent, borderRadius: 2, marginVertical: 24 },

  form:     { width: '100%', maxWidth: 360 },
  label:    { color: C.dim, fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.4 },

  input: {
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14,
    color: C.text, fontSize: 15,
  },
  inputFocused: { borderColor: C.accent },

  // Email dropdown
  emailWrap: { position: 'relative' },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    borderRadius: radius.md, marginTop: 4, zIndex: 100,
    overflow: 'hidden',
  },
  dropItem:       { paddingHorizontal: 16, paddingVertical: 13 },
  dropItemBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  dropItemText:   { color: C.text, fontSize: 14 },

  // Password
  inputPw:  { paddingRight: 50 },
  pwWrap:   { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 50, alignItems: 'center', justifyContent: 'center',
  },
  eyeText:  { fontSize: 16 },

  // Remember me
  rememberRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: C.accent, borderColor: C.accent },
  checkmark:       { color: C.white, fontSize: 12, fontWeight: '800' },
  rememberText:    { color: C.dim, fontSize: 13 },

  errorText: { color: C.error, fontSize: 13, marginTop: 10, textAlign: 'center' },

  btn: {
    marginTop: 20, backgroundColor: C.accent, borderRadius: radius.card,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  btnDisabled: { backgroundColor: C.surface2, shadowOpacity: 0 },
  btnText:     { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  biometricBtn: {
    marginTop: 10, backgroundColor: C.infoSurface, borderRadius: radius.card,
    borderWidth: 1, borderColor: C.accent + '60',
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  biometricBtnText: { color: C.accent, fontSize: 14, fontWeight: '800' },

  footer: { color: C.muted, fontSize: 11, marginTop: 36, textAlign: 'center' },
});
