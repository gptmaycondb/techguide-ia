import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { BRAND_GROUPS } from './data';

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
  // Expandir: brand → model → manuals
  const [expandedBrand, setExpandedBrand] = useState({ hp: true, ricoh: true });
  const [expandedModel, setExpandedModel] = useState({});

  useEffect(() => {
    checkDownloaded();
    // Expand first model of each brand by default
    const modelExp = {};
    BRAND_GROUPS.forEach(b => {
      if (b.models[0]) modelExp[b.models[0].id] = true;
    });
    setExpandedModel(modelExp);
  }, []);

  async function checkDownloaded() {
    const status = {};
    for (const brand of BRAND_GROUPS) {
      for (const model of brand.models) {
        for (const m of model.manuals) {
          const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory + m.localName);
          status[m.id] = info.exists && (info.size || 0) > 10000;
        }
      }
    }
    setDownloaded(status);
  }

  async function handlePdf(manual) {
    if (!manual.url) {
      Alert.alert('Em breve', 'Este manual ainda não está disponível para download.\nAguarde a próxima atualização!');
      return;
    }
    const dest = FileSystem.documentDirectory + manual.localName;
    const info = await FileSystem.getInfoAsync(dest);

    if (info.exists && (info.size || 0) > 10000) {
      await openPdf(dest);
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
      await openPdf(dest);
    } catch (e) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
      Alert.alert('Erro no download', e.message);
    }

    setLoading(l => ({ ...l, [manual.id]: false }));
    setProgress(p => ({ ...p, [manual.id]: 0 }));
  }

  async function openPdf(dest) {
    try {
      const contentUri = await FileSystem.getContentUriAsync(dest);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/pdf',
      });
    } catch {
      try {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/pdf',
          dialogTitle: 'Abrir manual com...',
          UTI: 'com.adobe.pdf',
        });
      } catch (e2) {
        Alert.alert('Erro ao abrir', e2.message);
      }
    }
  }

  async function deletePdf(manual) {
    Alert.alert('Remover', 'Remover o arquivo baixado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          await FileSystem.deleteAsync(FileSystem.documentDirectory + manual.localName, { idempotent: true });
          setDownloaded(d => ({ ...d, [manual.id]: false }));
        }
      },
    ]);
  }

  function toggleBrand(id) {
    setExpandedBrand(e => ({ ...e, [id]: !e[id] }));
  }

  function toggleModel(id) {
    setExpandedModel(e => ({ ...e, [id]: !e[id] }));
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {BRAND_GROUPS.map(brand => (
          <View key={brand.id} style={styles.brandBlock}>

            {/* ── Brand Header ─────────────────────────────── */}
            <TouchableOpacity
              style={[styles.brandHeader, { borderColor: brand.color + '50' }]}
              onPress={() => toggleBrand(brand.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.brandIconBadge, { backgroundColor: brand.color + '22', borderColor: brand.color + '60' }]}>
                <Text style={styles.brandIcon}>{brand.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.brandLabel, { color: brand.color }]}>{brand.label}</Text>
                <Text style={styles.brandSubtitle}>{brand.subtitle}</Text>
              </View>
              <Text style={[styles.arrow, { color: brand.color }]}>
                {expandedBrand[brand.id] ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {/* ── Models inside brand ───────────────────────── */}
            {expandedBrand[brand.id] && brand.models.map(model => (
              <View key={model.id} style={styles.modelBlock}>

                {/* Model Header */}
                <TouchableOpacity
                  style={[styles.modelHeader, { borderLeftColor: model.color }]}
                  onPress={() => toggleModel(model.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modelIcon}>{model.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modelLabel, { color: model.color }]}>{model.label}</Text>
                    <Text style={styles.modelSubtitle}>{model.subtitle}</Text>
                  </View>
                  <Text style={[styles.arrow, { color: model.color }]}>
                    {expandedModel[model.id] ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {/* Manuals in model */}
                {expandedModel[model.id] && model.manuals.map(manual => {
                  const isLoading = !!loading[manual.id];
                  const pct = progress[manual.id] || 0;
                  const isDone = !!downloaded[manual.id];
                  const isUnavailable = !manual.url;

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
                        {isUnavailable && (
                          <View style={[styles.badge, { backgroundColor: '#1a1200', borderColor: '#f59e0b' }]}>
                            <Text style={[styles.badgeText, { color: '#f59e0b' }]}>⏳</Text>
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
                          style={[
                            styles.btnMain,
                            {
                              backgroundColor: isLoading
                                ? C.surface2
                                : isUnavailable
                                  ? C.surface2
                                  : manual.color
                            },
                            isUnavailable && { borderWidth: 1, borderColor: '#f59e0b44' },
                          ]}
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
                          ) : isUnavailable ? (
                            <Text style={[styles.btnText, { color: '#f59e0b' }]}>⏳ Em breve</Text>
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
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            📥 Baixe os manuais para consulta offline em campo{'\n'}
            🔍 Pesquise códigos de erro e procedimentos na aba Consulta{'\n'}
            🗑 Toque na lixeira para remover e liberar espaço
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 14, gap: 14, paddingBottom: 30 },

  // Brand
  brandBlock: { gap: 8 },
  brandHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1,
  },
  brandIconBadge: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  brandIcon: { fontSize: 20 },
  brandLabel: { fontSize: 16, fontWeight: '800' },
  brandSubtitle: { color: C.dim, fontSize: 11, marginTop: 2 },

  // Model
  modelBlock: { gap: 6, marginLeft: 4 },
  modelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface2, borderRadius: 11, padding: 12,
    borderLeftWidth: 3, borderWidth: 1, borderColor: C.border,
  },
  modelIcon: { fontSize: 18 },
  modelLabel: { fontSize: 13, fontWeight: '700' },
  modelSubtitle: { color: C.dim, fontSize: 10, marginTop: 1 },

  arrow: { fontSize: 11, fontWeight: '700' },

  // Manual card
  card: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderWidth: 1, borderColor: C.border,
    marginLeft: 12, gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { fontSize: 20 },
  cardTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  cardSubtitle: { color: C.dim, fontSize: 10, marginTop: 1 },
  badge: {
    backgroundColor: '#0d2a1a', borderWidth: 1, borderColor: C.success,
    borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: C.success, fontSize: 11, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 9, fontWeight: '600' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBg: { flex: 1, height: 6, backgroundColor: C.surface2, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { color: C.text, fontSize: 11, fontWeight: '600', minWidth: 30 },
  btns: { flexDirection: 'row', gap: 8 },
  btnMain: {
    flex: 1, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', minHeight: 46,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnLoadText: { fontSize: 12, fontWeight: '600' },
  btnDel: {
    width: 46, height: 46, borderRadius: 10, backgroundColor: '#1a0a10',
    borderWidth: 1, borderColor: '#4a1020', alignItems: 'center', justifyContent: 'center',
  },
  btnDelText: { fontSize: 18 },
  footer: {
    padding: 14, backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  footerText: { color: C.muted, fontSize: 11, textAlign: 'center', lineHeight: 20 },
});
