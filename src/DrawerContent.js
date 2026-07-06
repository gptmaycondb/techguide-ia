import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors as C, radius } from './theme';
import Tag from './components/Tag';
import ActionButton from './components/ActionButton';

export default function DrawerContent({ manual, mode, onQuestion, onLogout, onClearAllConversations, showAssistant, onOpenAssistant, provider, visibleProviders = [], onChangeProvider, biometricAvailable = false, biometricEnabled = false, onEnableBiometric, onDisableBiometric }) {
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [biometricModalOpen, setBiometricModalOpen] = useState(false);
  const [biometricPassword, setBiometricPassword] = useState('');
  const [biometricError, setBiometricError] = useState('');
  const [biometricLoading, setBiometricLoading] = useState(false);

  if (!manual) return null;
  const topics = manual.topics[mode] || manual.topics.user;
  const activeProvider = visibleProviders.find(p => p.id === provider) || visibleProviders[0];
  const confirmClearAll = () => Alert.alert(
    'Limpar todas as conversas',
    'Todas as conversas e resultados de busca salvos neste dispositivo serão apagados. Esta ação não pode ser desfeita.',
    [{ text: 'Cancelar', style: 'cancel' }, { text: 'Limpar', style: 'destructive', onPress: onClearAllConversations }]
  );
  const closeBiometricModal = () => {
    if (biometricLoading) return;
    setBiometricModalOpen(false);
    setBiometricPassword('');
    setBiometricError('');
  };
  const submitBiometricPassword = async () => {
    if (!biometricPassword) {
      setBiometricError('Digite sua senha.');
      return;
    }
    setBiometricLoading(true);
    setBiometricError('');
    const result = await onEnableBiometric?.(biometricPassword);
    setBiometricLoading(false);
    if (result?.ok) closeBiometricModal();
    else setBiometricError(result?.message || 'Não foi possível ativar.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.modelInfo}>
        <View style={[styles.dot, { backgroundColor: manual.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.modelName}>{manual.label}</Text>
          <Text style={styles.modelType}>{manual.subtitle}</Text>
        </View>
      </View>
      <View style={styles.tags}>
        {manual.tags.map(t => (
          <Tag key={t} label={t} color={manual.color} />
        ))}
      </View>
      <ScrollView style={styles.topics} showsVerticalScrollIndicator={false}>
        {Object.entries(topics).map(([section, questions]) => (
          <View key={section} style={styles.section}>
            <Text style={styles.sectionLabel}>{section}</Text>
            {questions.map((q, i) => (
              <TouchableOpacity key={i} style={styles.chip} onPress={() => onQuestion(q)}>
                <Text style={styles.chipText}>→ {q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.logoutSection}>
        <ActionButton
          style={[styles.assistantBtn, showAssistant && styles.assistantBtnActive]}
          onPress={showAssistant ? undefined : onOpenAssistant}
          activeOpacity={showAssistant ? 1 : 0.75}
        >
          <Text style={styles.assistantIcon}>🤖</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.assistantText, showAssistant && styles.assistantTextActive]}>
              Assistente
            </Text>
            <Text style={styles.assistantSub}>
              {showAssistant ? 'Ativo · arraste para fechar' : 'Toque para reabrir'}
            </Text>
          </View>
          {showAssistant && <View style={styles.activeDot} />}
        </ActionButton>

        {onChangeProvider && (
          visibleProviders.length === 0 ? (
            <View style={[styles.iaBtn, { opacity: 0.5 }]}>
              <Text style={styles.iaIcon}>🧠</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.iaText}>Modelo de IA</Text>
                <Text style={styles.iaSub}>Nenhum provedor de IA configurado</Text>
              </View>
            </View>
          ) : (
            <ActionButton variant="secondary" style={styles.iaBtn} onPress={() => setProviderModalOpen(true)} activeOpacity={0.75}>
              <Text style={styles.iaIcon}>🧠</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.iaText}>Modelo de IA</Text>
                <Text style={styles.iaSub} numberOfLines={1}>{activeProvider?.label ?? '—'}</Text>
              </View>
              <Text style={styles.iaChevron}>▾</Text>
            </ActionButton>
          )
        )}

        {biometricAvailable && (
          <ActionButton
            variant="secondary"
            style={styles.biometricBtn}
            onPress={biometricEnabled
              ? onDisableBiometric
              : () => setBiometricModalOpen(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.biometricIcon}>◉</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.biometricText}>Desbloqueio por biometria</Text>
              <Text style={styles.biometricSub}>
                {biometricEnabled ? 'Ativado' : 'Desativado'}
              </Text>
            </View>
            <View style={[styles.toggle, biometricEnabled && styles.toggleActive]}>
              <View style={[styles.toggleKnob, biometricEnabled && styles.toggleKnobActive]} />
            </View>
          </ActionButton>
        )}

        <ActionButton variant="danger" style={styles.clearBtn} onPress={confirmClearAll} activeOpacity={0.75}>
          <Text style={styles.clearIcon}>Limpar</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.clearText}>Limpar todas as conversas</Text>
            <Text style={styles.clearSub}>Apaga o histórico salvo neste dispositivo</Text>
          </View>
        </ActionButton>

        <ActionButton variant="danger" style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.75}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Sair</Text>
        </ActionButton>
      </View>

      <Modal visible={providerModalOpen} transparent animationType="fade" onRequestClose={() => setProviderModalOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setProviderModalOpen(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Modelo de IA</Text>
          {visibleProviders.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.iaOption, p.id === provider && styles.iaOptionActive]}
              onPress={() => { onChangeProvider?.(p.id); setProviderModalOpen(false); }}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.iaOptionLabel, p.id === provider && styles.iaOptionLabelActive]}>
                  {p.label}
                </Text>
                <Text style={styles.iaOptionSub}>{p.sub}</Text>
              </View>
              {p.id === provider && <Text style={styles.iaCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      <Modal visible={biometricModalOpen} transparent animationType="fade" onRequestClose={closeBiometricModal}>
        <KeyboardAvoidingView
          style={styles.biometricOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeBiometricModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ativar login por biometria</Text>
            <Text style={styles.biometricPromptText}>
              Confirme sua senha para proteger o login no cofre do aparelho.
            </Text>
            <TextInput
              style={styles.biometricPasswordInput}
              value={biometricPassword}
              onChangeText={setBiometricPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Sua senha"
              placeholderTextColor={C.muted}
              editable={!biometricLoading}
              onSubmitEditing={submitBiometricPassword}
            />
            {!!biometricError && <Text style={styles.biometricError}>{biometricError}</Text>}
            <ActionButton
              label={biometricLoading ? undefined : 'Confirmar e ativar'}
              onPress={submitBiometricPassword}
              disabled={biometricLoading}
              style={styles.biometricConfirm}
            >
              {biometricLoading
                ? <ActivityIndicator color={C.white} size="small" />
                : <Text style={styles.biometricConfirmText}>Confirmar e ativar</Text>
              }
            </ActionButton>
            <TouchableOpacity onPress={closeBiometricModal} disabled={biometricLoading}>
              <Text style={styles.biometricCancel}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  modelInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  modelName: { color: C.text, fontSize: 14, fontWeight: '700' },
  modelType: { color: C.dim, fontSize: 11, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 14, paddingTop: 10 },
  topics: { flex: 1 },
  section: { padding: 12, paddingTop: 8 },
  sectionLabel: { color: C.muted, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  chip: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  chipText: { color: C.dim, fontSize: 13, lineHeight: 18 },

  logoutSection: { paddingHorizontal: 12, paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface, gap: 8 },
  assistantBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: C.accent + '60', backgroundColor: C.infoSurface },
  assistantBtnActive: { borderColor: C.accent, backgroundColor: C.cardActive },
  assistantIcon: { fontSize: 16 },
  assistantText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  assistantTextActive: { color: C.accent },
  assistantSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent },

  iaBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2 },
  iaIcon: { fontSize: 16 },
  iaText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  iaSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  iaChevron: { color: C.muted, fontSize: 14 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: C.dangerBorder, backgroundColor: C.dangerSurface },
  logoutIcon: { fontSize: 16 },
  logoutText: { color: C.danger, fontSize: 14, fontWeight: '600' },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  modalCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface2, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: C.border,
    padding: 20, paddingBottom: 40, gap: 4,
  },
  modalTitle: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  iaOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  iaOptionActive: { borderColor: C.accent + '60', backgroundColor: C.accent + '12' },
  iaOptionLabel: { color: C.dim, fontSize: 14, fontWeight: '600' },
  iaOptionLabelActive: { color: C.accent },
  iaOptionSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  iaCheck: { color: C.accent, fontSize: 16, fontWeight: '700' },

  biometricBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 10 },
  biometricIcon: { color: C.accent, fontSize: 18, fontWeight: '700' },
  biometricText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  biometricSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  toggle: { width: 38, height: 22, borderRadius: 11, padding: 2, backgroundColor: C.border },
  toggleActive: { backgroundColor: C.accent },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.dim },
  toggleKnobActive: { backgroundColor: C.white, transform: [{ translateX: 16 }] },
  biometricOverlay: { flex: 1, justifyContent: 'flex-end' },
  biometricPromptText: { color: C.dim, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  biometricPasswordInput: {
    color: C.text, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  biometricError: { color: C.error, fontSize: 12, marginTop: 4 },
  biometricConfirm: { minHeight: 46, marginTop: 8 },
  biometricConfirmText: { color: C.white, fontSize: 13, fontWeight: '800' },
  biometricCancel: { color: C.dim, fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: C.dangerBorder, backgroundColor: C.dangerSurface },
  clearIcon: { color: C.danger, fontSize: 11, fontWeight: '700' },
  clearText: { color: C.danger, fontSize: 13, fontWeight: '600' },
  clearSub: { color: C.muted, fontSize: 10, marginTop: 2 },
});
