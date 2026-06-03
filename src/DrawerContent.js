import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { AI_PROVIDERS } from './data';

const C = {
  surface: '#161920', surface2: '#1e2230', border: '#2a2f3e',
  accent: '#0096ff', text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
};

export default function DrawerContent({ manual, mode, onQuestion, onLogout, showAssistant, onOpenAssistant, provider, onChangeProvider }) {
  const [providerModalOpen, setProviderModalOpen] = useState(false);

  if (!manual) return null;
  const topics = manual.topics[mode] || manual.topics.user;
  const activeProvider = AI_PROVIDERS.find(p => p.id === provider) || AI_PROVIDERS[0];

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

        {onChangeProvider && (
          <TouchableOpacity style={styles.iaBtn} onPress={() => setProviderModalOpen(true)} activeOpacity={0.75}>
            <Text style={styles.iaIcon}>🧠</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.iaText}>Modelo de IA</Text>
              <Text style={styles.iaSub} numberOfLines={1}>{activeProvider.label}</Text>
            </View>
            <Text style={styles.iaChevron}>▾</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.75}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={providerModalOpen} transparent animationType="fade" onRequestClose={() => setProviderModalOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setProviderModalOpen(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Modelo de IA</Text>
          {AI_PROVIDERS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.iaOption, p.id === provider && styles.iaOptionActive]}
              onPress={() => { onChangeProvider(p.id); setProviderModalOpen(false); }}
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

  iaBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#1a1a2e', backgroundColor: '#0d0d1f' },
  iaIcon: { fontSize: 16 },
  iaText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  iaSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  iaChevron: { color: C.muted, fontSize: 14 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#4a1020', backgroundColor: '#1a0a10' },
  logoutIcon: { fontSize: 16 },
  logoutText: { color: '#ff6b8a', fontSize: 14, fontWeight: '600' },

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
});
