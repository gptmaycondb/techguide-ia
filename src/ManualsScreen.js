import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MODEL_GROUPS } from './data';

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
  success: '#22c55e',
};

export default function ManualsScreen() {
  const [loading, setLoading] = useState({});
  const [progress, setProgress] = useState({});
  const [downloaded, setDownloaded] = useState({});
  const [expanded, setExpanded] = useState({ mfpe52645_group: true });

  useEffect(() => { checkDownloaded(); }, []);

  async function checkDownloaded() {
    const status = {};
    for (const group of MODEL_GROUPS) {
      for (const m of group.manuals) {
        const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory + m.localName);
        status[m.id] = info.exists && (info.size || 0) > 10000;
      }
    }
    setDownloaded(status);
  }

  async function handlePdf(manual) {
    const dest = FileSystem.documentDirectory + manual.localName;
    const info = await FileSystem.getInfoAsync(dest);

    if (info.exists && (info.size || 0) > 10000) {
      await openPdf(dest, manual);
      return;
    }

    setLoading(l => ({ ...l, [manual.id]: true }));
    setProgress(p => ({ ...p, [manual.id]: 0 }));

    try {
      await FileSystem.deleteAsync(dest, { idempotent: true });

      const dl = FileSystem.createDownloadResumable(
        manual.url, dest,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
        (dp) => {
          if (dp.totalBytesExpectedToWrite > 0) {
            const pct = Math.round(dp.totalBytesWritten * 100 / dp.totalBytesExpectedToWrite);
            setProgress(p => ({ ...p, [manual.id]: pct }));
          }
        }
      );

      const result = await dl.downloadAsync();
      if (!result?.uri) throw new Error('Download nao concluido');

      const check = await FileSystem.getInfoAsync(dest);
      if ((check.size || 0) < 10000) {
        await FileSystem.deleteAsync(dest, { idempotent: true });
        throw new Error('Arquivo invalido. Verifique sua conexao.');
      }

      setDownloaded(d => ({ ...d, [manual.id]: true }));
      await openPdf(dest, manual);
    } catch (e) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
      Alert.alert('Erro no download', e.message);
    }

    setLoading(l => ({ ...l, [manual.id]: false }));
    setProgress(p => ({ ...p, [manual.id]: 0 }));
  }

  async function openPdf(dest, manual) {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: manual.title, UTI: 'com.adobe.pdf' });
      }
    } catch (e) {
      Alert.alert('Erro', e.message);
    }
  }

  async function deletePdf(manual) {
    Alert.alert('Remover', 'Remover o arquivo baixado?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        await FileSystem.deleteAsync(FileSystem.documentDirectory + manual.localName, { idempotent: true });
        setDownloaded(d => ({ ...d, [manual.id]: false }));
      }},
    ]);
  }

  function toggleGroup(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }));
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {MODEL_GROUPS.map(group => (
          <View key={group.id} style={styles.group}>
            {/* Group Header */}
            <TouchableOpacity
              style={[styles.groupHeader, { borderLeftColor: group.color }]}
              onPress={() => toggleGroup(group.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.groupIcon}>{group.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupLabel, { color: group.color }]}>{group.label}</Text>
                <Text style={styles.groupSubtitle}>{group.subtitle}</Text>
              </View>
              <Text style={[styles.groupArrow, { color: group.color }]}>
                {expanded[group.id] ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {/* Manuals in group */}
            {expanded[group.id] && group.manuals.map(manual => {
              const isLoading = !!loading[manual.id];
              const pct = progress[manual.id] || 0;
              const isDone = !!downloaded[manual.id];

              return (
                <View key={manual.id} style={[styles.card, { borderLeftColor: manual.color }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIcon}>{manual.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{manual.title}</Text>
                      <Text style={styles.cardSubtitle}>{manual.subtitle}</Text>
                    </View>
                    {isDone && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>✓</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.tagsRow}>
                    {manual.tags.map(t => (
                      <View key={t} style={[styles.tag, { borderColor: manual.color + '60' }]}>
                        <Text style={[styles.tagText, { color: manual.color }]}>{t}</Text>
                      </View>
                    ))}
                  </View>

                  {isLoading && (
                    <View style={styles.progressWrap}>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: pct + '%', backgroundColor: manual.color }]} />
                      </View>
                      <Text style={styles.progressText}>{pct}%</Text>
                    </View>
                  )}

                  <View style={styles.btns}>
                    <TouchableOpacity
                      style={[styles.btnMain, { backgroundColor: isLoading ? C.surface2 : manual.color }]}
                      onPress={() => handlePdf(manual)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <View style={styles.btnRow}>
                          <ActivityIndicator size="small" color={manual.color} />
                          <Text style={[styles.btnLoadText, { color: manual.color }]}>
                            {pct > 0 ? `${pct}%` : 'Iniciando...'}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.btnText}>{isDone ? '📂 Abrir' : '⬇ Baixar e Abrir'}</Text>
                      )}
                    </TouchableOpacity>
                    {isDone && !isLoading && (
                      <TouchableOpacity style={styles.btnDel} onPress={() => deletePdf(manual)}>
                        <Text style={styles.btnDelText}>🗑</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💾 Salvos no dispositivo para acesso offline{'\n'}
            🗑 Toque na lixeira para liberar espaco
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 14, gap: 12, paddingBottom: 30 },
  group: { gap: 8 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderWidth: 1, borderColor: C.border,
  },
  groupIcon: { fontSize: 22 },
  groupLabel: { fontSize: 15, fontWeight: '800' },
  groupSubtitle: { color: C.dim, fontSize: 11, marginTop: 2 },
  groupArrow: { fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderWidth: 1, borderColor: C.border,
    marginLeft: 8, gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { fontSize: 20 },
  cardTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  cardSubtitle: { color: C.dim, fontSize: 10, marginTop: 1 },
  badge: { backgroundColor: '#0d2a1a', borderWidth: 1, borderColor: C.success, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: C.success, fontSize: 11, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 9, fontWeight: '600' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBg: { flex: 1, height: 6, backgroundColor: C.surface2, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { color: C.text, fontSize: 11, fontWeight: '600', minWidth: 30 },
  btns: { flexDirection: 'row', gap: 8 },
  btnMain: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnLoadText: { fontSize: 12, fontWeight: '600' },
  btnDel: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#1a0a10', borderWidth: 1, borderColor: '#4a1020', alignItems: 'center', justifyContent: 'center' },
  btnDelText: { fontSize: 18 },
  footer: { padding: 14, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  footerText: { color: C.muted, fontSize: 11, textAlign: 'center', lineHeight: 20 },
});
