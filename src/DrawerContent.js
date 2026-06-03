import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { BACKEND_PRESETS } from './data';

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230', border: '#2a2f3e',
  accent: '#0096ff', text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
};

export default function DrawerContent({ manual, mode, onQuestion, onLogout, showAssistant, onOpenAssistant, apiUrl, onChangeBackend }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState('');

  if (!manual) return null;
  const topics = manual.topics[mode] || manual.topics.user;

  function openModal() {
    setDraft(apiUrl || BACKEND_PRESETS[0].url);
    setModalOpen(true);
  }

  function confirm() {
    onChangeBackend && onChangeBackend(draft);
    setModalOpen(false);
  }

  function reset() {
    onChangeBackend && onChangeBackend(BACKEND_PRESETS[0].url);
    setModalOpen(false);
  }

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
          <View key={t} style={[styles.tag, { borderColor: manual.color + '60' }]}>
            <Text style={[styles.tagText, { color: manual.color }]}>{t}</Text>
          </View>
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
        <TouchableOpacity
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
        </TouchableOpacity>

        {onChangeBackend && (
          <TouchableOpacity style={styles.backendBtn} onPress={openModal} activeOpacity={0.75}>
            <Text style={styles.backendIcon}>🔗</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.backendText}>Backend</Text>
              <Text style={styles.backendSub} numberOfLines={1}>{apiUrl || BACKEND_PRESETS[0].url}</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.75}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModalOpen(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>URL do Backend</Text>
          <TextInput
            style={styles.modalInput}
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholderTextColor={C.muted}
            placeholder="https://..."
            selectTextOnFocus
          />
          <View style={styles.modalBtns}>
            <TouchableOpacity onPress={reset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.modalReset}>Restaurar padrão</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalConfirm} onPress={confirm}>
              <Text style={styles.modalConfirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  tag: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '600' },
  topics: { flex: 1 },
  section: { padding: 12, paddingTop: 8 },
  sectionLabel: { color: C.muted, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  chip: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  chipText: { color: C.dim, fontSize: 13, lineHeight: 18 },

  logoutSection: { paddingHorizontal: 12, paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface, gap: 8 },
  assistantBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#0a2040', backgroundColor: '#0a1628' },
  assistantBtnActive: { borderColor: '#0050aa', backgroundColor: '#071020' },
  assistantIcon: { fontSize: 16 },
  assistantText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  assistantTextActive: { color: '#4db8ff' },
  assistantSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent },

  backendBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#1a2a1a', backgroundColor: '#0a1410' },
  backendIcon: { fontSize: 16 },
  backendText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  backendSub: { color: C.muted, fontSize: 10, marginTop: 2 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#4a1020', backgroundColor: '#1a0a10' },
  logoutIcon: { fontSize: 16 },
  logoutText: { color: '#ff6b8a', fontSize: 14, fontWeight: '600' },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  modalCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface2, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: C.border,
    padding: 24, paddingBottom: 40, gap: 16,
  },
  modalTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  modalInput: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: C.text, fontSize: 13, fontFamily: 'monospace',
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  modalReset: { color: C.dim, fontSize: 13 },
  modalConfirm: { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  modalConfirmText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
