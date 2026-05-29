import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
  purple: '#a855f7', success: '#22c55e',
};

// Use a redirect-friendly download approach
const MANUALS_LIST = [
  {
    id: 'guia', title: 'Guia do Usuario',
    subtitle: 'HP LaserJet Managed MFP E52645',
    desc: 'Manual completo de operacao, configuracao e solucao de problemas para o usuario final',
    color: C.accent2, icon: '📗',
    tags: ['E52645', 'MFP', 'PT-BR'],
    url: 'https://github.com/gptmaycondb/techguide-ia/releases/download/untagged-98ad022da9c4ab02088c/Guia.do.usuario.pdf',
    localName: 'tg_guia_e52645.pdf',
    size: '6.5 MB',
  },
  {
    id: 'cpmd', title: 'Codigos de Erro (CPMD)',
    subtitle: 'Todos os Modelos - 2023',
    desc: 'Codigos de erro do painel de controle, mensagens e procedimentos de solucao',
    color: C.purple, icon: '⚠️',
    tags: ['M501','M527','E52645','CPMD'],
    url: 'https://github.com/gptmaycondb/techguide-ia/releases/download/untagged-98ad022da9c4ab02088c/CPMD_HP_E52645_2023.pdf',
    localName: 'tg_cpmd_2023.pdf',
    size: '6.0 MB',
  },
  {
    id: 'service', title: 'Service Parts Catalog',
    subtitle: 'HP LaserJet Series - 2025',
    desc: 'Catalogo completo de pecas, teoria de operacao, troubleshooting e reparo',
    color: C.accent, icon: '🔧',
    tags: ['M501','M506','M527','E50045','E52645'],
    url: 'https://github.com/gptmaycondb/techguide-ia/releases/download/untagged-98ad022da9c4ab02088c/Service_PartsCatalog_HP_E52645_2025.pdf',
    localName: 'tg_service_2025.pdf',
    size: '90 MB',
  },
];

export default function ManualsScreen() {
  const [loading, setLoading] = useState({});
  const [progress, setProgress] = useState({});
  const [downloaded, setDownloaded] = useState({});

  useEffect(() => { checkDownloaded(); }, []);

  async function checkDownloaded() {
    const status = {};
    for (const m of MANUALS_LIST) {
      const dest = FileSystem.documentDirectory + m.localName;
      const info = await FileSystem.getInfoAsync(dest);
      status[m.id] = info.exists && (info.size || 0) > 10000;
    }
    setDownloaded(status);
  }

  async function handlePdf(manual) {
    const dest = FileSystem.documentDirectory + manual.localName;
    const info = await FileSystem.getInfoAsync(dest);

    // Already downloaded and valid
    if (info.exists && (info.size || 0) > 10000) {
      await openPdf(dest, manual);
      return;
    }

    // Download
    setLoading(l => ({ ...l, [manual.id]: true }));
    setProgress(p => ({ ...p, [manual.id]: 0 }));

    try {
      // Delete any partial file
      await FileSystem.deleteAsync(dest, { idempotent: true });

      // Resolve GitHub redirect to get direct CDN URL
      let downloadUrl = manual.url;
      try {
        const headRes = await fetch(manual.url, { method: 'GET', redirect: 'follow' });
        if (headRes.url && headRes.url !== manual.url) {
          downloadUrl = headRes.url;
        }
        await headRes.body?.cancel?.();
      } catch {}

      const dl = FileSystem.createDownloadResumable(
        downloadUrl,
        dest,
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
      const size = check.size || 0;

      if (size < 10000) {
        await FileSystem.deleteAsync(dest, { idempotent: true });
        throw new Error(`Arquivo muito pequeno (${size} bytes). Link pode estar incorreto.`);
      }

      setDownloaded(d => ({ ...d, [manual.id]: true }));
      await openPdf(dest, manual);

    } catch (e) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
      Alert.alert(
        'Erro no download',
        e.message + '\n\nTente novamente com boa conexao.',
        [{ text: 'OK' }]
      );
    }

    setLoading(l => ({ ...l, [manual.id]: false }));
    setProgress(p => ({ ...p, [manual.id]: 0 }));
  }

  async function openPdf(dest, manual) {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/pdf',
          dialogTitle: 'Abrir ' + manual.title,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Aviso', 'Instale um leitor de PDF para abrir o arquivo.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel abrir: ' + e.message);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>📚 Manuais Originais</Text>
        <Text style={styles.pageDesc}>PDFs originais completos com imagens e formatação preservadas</Text>

        {MANUALS_LIST.map(manual => {
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
                {isDone && <View style={styles.badge}><Text style={styles.badgeText}>✓ Salvo</Text></View>}
              </View>

              <Text style={styles.cardDesc}>{manual.desc}</Text>

              <View style={styles.tags}>
                {manual.tags.map(t => (
                  <View key={t} style={[styles.tag, { borderColor: manual.color + '60' }]}>
                    <Text style={[styles.tagText, { color: manual.color }]}>{t}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sizeText}>📦 {manual.size}</Text>

              {isLoading && (
                <View style={styles.progressWrap}>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: (pct || 0) + '%', backgroundColor: manual.color }]} />
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
                        {pct > 0 ? `Baixando ${pct}%` : 'Iniciando...'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.btnText}>{isDone ? '📂 Abrir PDF' : '⬇ Baixar e Abrir'}</Text>
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

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            📄 PDFs originais com imagens e formatação{'\n'}
            💾 Salvos no dispositivo para acesso offline{'\n'}
            🗑 Toque na lixeira para remover e liberar espaço
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
  pageDesc: { color: C.dim, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderLeftWidth: 3, gap: 10, borderWidth: 1, borderColor: C.border },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: { fontSize: 24 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  cardSubtitle: { color: C.dim, fontSize: 11, marginTop: 2 },
  badge: { backgroundColor: '#0d2a1a', borderWidth: 1, borderColor: C.success, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: C.success, fontSize: 10, fontWeight: '700' },
  cardDesc: { color: C.dim, fontSize: 12, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '600' },
  sizeText: { color: C.muted, fontSize: 11 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBg: { flex: 1, height: 8, backgroundColor: C.surface2, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { color: C.text, fontSize: 11, fontWeight: '600', minWidth: 35, textAlign: 'right' },
  btns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnMain: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnLoadText: { fontSize: 13, fontWeight: '600' },
  btnDel: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#1a0a10', borderWidth: 1, borderColor: '#4a1020', alignItems: 'center', justifyContent: 'center' },
  btnDelText: { fontSize: 20 },
  footer: { padding: 16, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  footerText: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 22 },
});
