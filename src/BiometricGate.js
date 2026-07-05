import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authenticateBiometric } from './biometrics';
import { colors as C, radius, spacing } from './theme';

export default function BiometricGate({ onUnlock, onPasswordLogin }) {
  const [authenticating, setAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);

  const tryUnlock = useCallback(async () => {
    if (authenticating) return;
    setAuthenticating(true);
    setFailed(false);
    const success = await authenticateBiometric();
    setAuthenticating(false);
    if (success) onUnlock();
    else setFailed(true);
  }, [authenticating, onUnlock]);

  useEffect(() => {
    tryUnlock();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.content}>
        <Image source={require('../assets/icon.png')} style={styles.logo} />
        <View style={styles.lockCircle}>
          <Ionicons name="finger-print-outline" size={42} color={C.accent} />
        </View>
        <Text style={styles.title}>TechGuide bloqueado</Text>
        <Text style={styles.subtitle}>
          Confirme sua identidade para acessar o conteúdo técnico.
        </Text>

        {authenticating ? (
          <View style={styles.status}>
            <ActivityIndicator color={C.accent} />
            <Text style={styles.statusText}>Aguardando autenticação...</Text>
          </View>
        ) : (
          <>
            {failed && (
              <Text style={styles.error}>
                Não foi possível confirmar sua identidade.
              </Text>
            )}
            <TouchableOpacity style={styles.primaryButton} onPress={tryUnlock}>
              <Text style={styles.primaryText}>Tentar novamente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onPasswordLogin}>
              <Text style={styles.secondaryText}>Entrar com senha</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: { width: 72, height: 72, borderRadius: radius.card, marginBottom: spacing.xl },
  lockCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.infoSurface,
    borderWidth: 1,
    borderColor: C.accent + '60',
    marginBottom: spacing.lg,
  },
  title: { color: C.text, fontSize: 22, fontWeight: '800' },
  subtitle: {
    color: C.dim,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusText: { color: C.dim, fontSize: 13 },
  error: { color: C.error, fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
  primaryButton: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: C.accent,
    borderRadius: radius.card,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { color: C.white, fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radius.card,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
  },
  secondaryText: { color: C.dim, fontSize: 14, fontWeight: '700' },
});
