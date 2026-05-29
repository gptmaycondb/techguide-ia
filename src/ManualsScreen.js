import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, SafeAreaView, Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
  purple: '#a855f7', success: '#22c55e', error: '#ff4d6d',
};

const BASE_URL = 'https://github.com/gptmaycondb/techguide-ia/releases/download/untagged-98ad022da9c4ab02088c';

const MANUALS_LIST = [
  {
    id: 'guia',
    title: 'Guia do Usuario',
    subtitle: 'HP LaserJet Managed MFP E52645',
    desc: 'Manual completo de operacao, configuracao e solucao de problemas para o usuario final',
    color: C.accent2,
    icon: '📗',
    tags: ['E52645', 'MFP', 'Flow', 'PT-BR'],
    filename: 'Guia.do.usuario.pdf',
    size: '6.5 MB',
  },
  {
    id: 'cpmd',
    title: 'Codigos de Erro (CPMD)',
    subtitle: 'Todos os Modelos - 2023',
    desc: 'Codigos de erro do painel de controle, mensagens de diagnostico e procedimentos de solucao',
    color: C.purple,
    icon: '⚠️',
    tags: ['M501', 'M506', 'M507', 'M527', 'M528', 'E52645'],
    filename: 'CPMD_HP_E52645_2023.pdf',
    size: '6.0 MB',
  },
  {
    id: 'service',
    title: 'Service Parts Catalog',
    subtitle: 'HP LaserJet Series - 2025',
    desc: 'Catalogo completo de pecas, teoria de operacao, troubleshooting e procedimentos de reparo',
    color: C.accent,
    icon: '🔧',
    tags: ['M501', 'M506', 'M507', 'M527', 'M528', 'E50045', 'E50145', 'E52545', 'E52645'],
    filename: 'Service_PartsCatalog_HP_E52645_2025.pdf',
    size: '90 MB',
  },
];

export default function ManualsScreen() {
  const [loading, setLoading] = useState({});
  const [progress, setProgress] = useState({});
  const [downloaded, setDownloaded] = useState({});

  useEffect(() => {
    checkDownloaded();
  }, []);

  async function checkDownloaded() {
    const status = {};
    for (const manual of MANUALS_LIST) {
      const dest = FileSystem.documentDirectory + manual.filename;
      const info = await FileSystem.getInfoAsync(dest);
      status[manual.id] = info.exists;
    }
    setDownloaded(status);
  }

  async function downloadPdf(manual) {
    const dest = FileSystem.documentDirectory + manual.filename;
    const url = BASE_URL + '/' + manual.filename;

    setLoading(l => ({ ...l, [manual.id]: true }));
    setProgress(p => ({ ...p, [manual.id]: 0 }));

    try {
      // Check if already downloaded
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) {
        // Already downloaded - open directly
        await openPdf(dest, manual);
        setLoading(l => ({ ...l, [manual.id]: false }));
        return;
      }

      // Download with progress
      const downloadResumable = FileSystem.createDownloadResumable(
        url, dest, {},
        (downloadProgress) => {
          const pct = downloadProgress.totalBytesExpectedToWrite > 0
            ? Math.round((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100)
            : 0;
          setProgress(p => ({ ...p, [manual.id]: pct }));
        }
      );

      await downloadResumable.downloadAsync();
      setDownloaded(d => ({ ...d, [manual.id]: true }));
      await openPdf(dest, manual);

    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel baixar o manual: ' + e.message);
    }

    setLoading(l => ({ ...l, [manual.id]: false }));
    setProgress(p => ({ ...p, [manual.id]: 0 }));
  }

  async function openPdf(dest, manual) {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(dest, {
        mimeType: 'application/pdf',
        dialogTitle: manual.title,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Erro', 'Nenhum leitor de PDF encontrado no dispositivo');
    }
  }

  async function deletePdf(manual) {
    Alert.alert(
      'Remover manual',
      'Deseja remover o arquivo baixado? Voce pode baixar novamente a qualquer momento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: async () => {
            const dest = FileSystem.documentDirectory + manual.filename;
            await FileSystem.deleteAsync(dest, { idempotent: true });
            setDownloaded(d => ({ ...d, [manual.id]: false }));
          }
        }
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>📚 Manuais Disponíveis</Text>
        <Text style={styles.pageDesc}>Baixe os manuais originais completos com imagens e formatacao preservadas</Text>

        {MANUALS_LIST.map(manual => {
          const isLoading = loading[manual.id];
          const pct = progress[manual.id] || 0;
          const isDone = downloaded[manual.id];

          return (
            <View key={manual.id} style={[styles.card, { borderLeftColor: manual.color }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>{manual.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{manual.title}</Text>
                  <Text style={styles.cardSubtitle}>{manual.subtitle}</Text>
                </View>
                {isDone && (
                  <View style={styles.savedBadge}>
                    <Text style={styles.savedBadgeText}>✓ Salvo</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cardDesc}>{manual.desc}</Text>

              <View style={styles.tags}>
                {manual.tags.map(t => (
                  <View key={t} style={[styles.tag, { borderColor: manual.color + '50' }]}>
                    <Text style={[styles.tagText, { color: manual.color }]}>{t}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sizeText}>Tamanho: {manual.size}</Text>

              {isLoading && pct > 0 && (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: pct + '%', backgroundColor: manual.color }]} />
                  <Text style={styles.progressText}>{pct}%</Text>
                </View>
              )}

              <View style={styles.btns}>
                <TouchableOpacity
                  style={[styles.btnMain, { backgroundColor: isLoading ? C.surface2 : manual.color }]}
                  onPress={() => downloadPdf(manual)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <View style={styles.btnLoading}>
                      <ActivityIndicator size="small" color={manual.color} />
                      <Text style={[styles.btnLoadingText, { color: manual.color }]}>
                        {pct > 0 ? `Baixando ${pct}%...` : 'Preparando...'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.btnMainText}>
                      {isDone ? '📂 Abrir PDF' : '⬇ Baixar e Abrir PDF'}
                    </Text>
                  )}
                </TouchableOpacity>

                {isDone && !isLoading && (
                  <TouchableOpacity
                    style={styles.btnDelete}
                    onPress={() => deletePdf(manual)}
                  >
                    <Text style={styles.btnDeleteText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            📄 PDFs originais completos com imagens{'\n'}
            💾 Salvos no dispositivo para acesso offline{'\n'}
            🗑 Toque no icone de lixeira para remover
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 30 },
  pageTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  pageDesc: { color: C.dim, fontSize: 12, marginBottom: 8, lineHeight: 18 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderLeftWidth: 3, gap: 10, borderWidth: 1, borderColor: C.border },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: { fontSize: 24 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  cardSubtitle: { color: C.dim, fontSize: 11, marginTop: 2 },
  savedBadge: { backgroundColor: '#0d2a1a', borderWidth: 1, borderColor: C.success, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  savedBadgeText: { color: C.success, fontSize: 10, fontWeight: '700' },
  cardDesc: { color: C.dim, fontSize: 12, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '600' },
  sizeText: { color: C.muted, fontSize: 11 },
  progressBar: { height: 8, backgroundColor: C.surface2, borderRadius: 4, overflow: 'hidden', position: 'relative' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { position: 'absolute', right: 4, top: -4, fontSize: 9, color: C.text },
  btns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnMain: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  btnMainText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnLoadingText: { fontSize: 13, fontWeight: '600' },
  btnDelete: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#1a0a10', borderWidth: 1, borderColor: '#4a1020', alignItems: 'center', justifyContent: 'center' },
  btnDeleteText: { fontSize: 18 },
  footer: { marginTop: 8, padding: 16, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  footerText: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 22 },
});
