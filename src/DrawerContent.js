import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

const C = {
  surface: '#161920', surface2: '#1e2230', border: '#2a2f3e',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
};

export default function DrawerContent({ manual, mode, onQuestion, onLogout }) {
  if (!manual) return null;
  const topics = manual.topics[mode] || manual.topics.user;

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
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.75}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  logoutSection: { paddingHorizontal: 12, paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#4a1020', backgroundColor: '#1a0a10' },
  logoutIcon: { fontSize: 16 },
  logoutText: { color: '#ff6b8a', fontSize: 14, fontWeight: '600' },
});
