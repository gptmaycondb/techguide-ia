import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, SafeAreaView, Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
  purple: '#a855f7',
};

const MANUALS_LIST = [
  {
    id: 'guia',
    title: 'Guia do Usuario',
    subtitle: 'HP LaserJet Managed MFP E52645',
    desc: 'Manual completo de operacao, configuracao e solucao de problemas',
    color: C.accent2,
    icon: '📗',
    tags: ['E52645', 'MFP', 'Flow', 'PT-BR'],
    require: require('../assets/manuals/guia_e52645.pdf'),
    filename: 'HP_E52645_Guia_Usuario.pdf',
  },
  {
    id: 'cpmd',
    title: 'Codigos de Erro (CPMD)',
    subtitle: 'Todos os Modelos - 2023',
    desc: 'Codigos de erro do painel de controle, diagnostico e solucoes',
    color: C.purple,
    icon: '⚠️',
    tags: ['M501', 'M506', 'M507', 'M527', 'M528', 'E52645'],
    require: require('../assets/manuals/cpmd_2023.pdf'),
    filename: 'HP_CPMD_2023.pdf',
  },
  {
    id: 'service1',
    title: 'Service Parts Catalog - Parte 1',
    subtitle: 'HP LaserJet Series',
    desc: 'Catalogo de pecas, teoria de operacao e procedimentos de reparo',
    color: C.accent,
    icon: '🔧',
    tags: ['M501', 'M506', 'M507', 'Service'],
    require: require('../assets/manuals/service_part1.pdf'),
    filename: 'HP_ServiceParts_Part1.pdf',
  },
  {
    id: 'service2',
    title: 'Service Parts Catalog - Parte 2',
    subtitle: 'HP LaserJet Series',
    desc: 'Continuacao do catalogo de pecas e procedimentos',
    color: C.accent,
    icon: '🔧',
    tags: ['M527', 'M528', 'E50045', 'Service'],
    require: require('../assets/manuals/service_part2.pdf'),
    filename: 'HP_ServiceParts_Part2.pdf',
  },
  {
    id: 'service3',
    title: 'Service Parts Catalog - Parte 3',
    subtitle: 'HP LaserJet Series',
    desc: 'Pecas de reposicao e diagramas de montagem',
    color: C.accent,
    icon: '🔧',
    tags: ['E50145', 'E52545', 'Service'],
    require: require('../assets/manuals/service_part3.pdf'),
    filename: 'HP_ServiceParts_Part3.pdf',
  },
  {
    id: 'service4',
    title: 'Service Parts Catalog - Parte 4',
    subtitle: 'HP LaserJet Series',
    desc: 'Acessorios, consumiveis e pecas opcionais',
    color: C.accent,
    icon: '🔧',
    tags: ['E52645', 'MFP', 'Service'],
    require: require('../assets/manuals/service_part4.pdf'),
    filename: 'HP_ServiceParts_Part4.pdf',
  },
];

export default function ManualsScreen() {
  const [loading, setLoading] = useState(null);

  async function getPdfPath(manual) {
    const asset = Asset.fromModule(manual.require);
    await asset.downloadAsync();
    return asset.localUri;
  }

  async function viewPdf(manual) {
    setLoading(manual.id + '_view');
    try {
      const uri = await getPdfPath(manual);
      const dest = FileSystem.cacheDirectory + manual.filename;
      await FileSystem.copyAsync({ from: uri, to: dest });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/pdf',
          dialogTitle: manual.title,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Erro', 'Visualizador de PDF nao disponivel neste dispositivo');
      }
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel abrir o PDF: ' + e.message);
    }
    setLoading(null);
  }

  async function downloadPdf(manual) {
    setLoading(manual.id + '_down');
    try {
      const uri = await getPdfPath(manual);
      const dest = FileSystem.documentDirectory + manual.filename;
      await FileSystem.copyAsync({ from: uri, to: dest });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/pdf',
          dialogTitle: 'Salvar ' + manual.filename,
          UTI: 'com.adobe.pdf',
        });
      }
      Alert.alert('Sucesso', manual.filename + ' pronto para salvar!');
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel baixar: ' + e.message);
    }
    setLoading(null);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>📚 Manuais Disponíveis</Text>
        <Text style={styles.pageDesc}>Todos os manuais estao embutidos no app — acesso offline garantido</Text>

        {MANUALS_LIST.map(manual => (
          <View key={manual.id} style={[styles.card, { borderLeftColor: manual.color }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>{manual.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{manual.title}</Text>
                <Text style={styles.cardSubtitle}>{manual.subtitle}</Text>
              </View>
            </View>

            <Text style={styles.cardDesc}>{manual.desc}</Text>

            <View style={styles.tags}>
              {manual.tags.map(t => (
                <View key={t} style={[styles.tag, { borderColor: manual.color + '50' }]}>
                  <Text style={[styles.tagText, { color: manual.color }]}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={styles.btns}>
              <TouchableOpacity
                style={[styles.btn, styles.btnView, { borderColor: manual.color }]}
                onPress={() => viewPdf(manual)}
                disabled={!!loading}
              >
                {loading === manual.id + '_view'
                  ? <ActivityIndicator size="small" color={manual.color} />
                  : <Text style={[styles.btnText, { color: manual.color }]}>👁 Visualizar</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnDown, { backgroundColor: manual.color }]}
                onPress={() => downloadPdf(manual)}
                disabled={!!loading}
              >
                {loading === manual.id + '_down'
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnDownText}>⬇ Baixar PDF</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            📴 Todos os manuais funcionam offline{'\n'}
            🔒 Arquivos embutidos no app
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14 },
  pageTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  pageDesc: { color: C.dim, fontSize: 12, marginBottom: 8, lineHeight: 18 },
  card: {
    backgroundColor: C.surface, borderRadius: 14,
    padding: 16, borderLeftWidth: 3, gap: 10,
    borderWidth: 1, borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: { fontSize: 24 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  cardSubtitle: { color: C.dim, fontSize: 11, marginTop: 2 },
  cardDesc: { color: C.dim, fontSize: 12, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '600' },
  btns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', height: 42 },
  btnView: { borderWidth: 1, backgroundColor: 'transparent' },
  btnDown: { borderWidth: 0 },
  btnText: { fontSize: 13, fontWeight: '600' },
  btnDownText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  footer: {
    marginTop: 8, padding: 16, backgroundColor: C.surface,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  footerText: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 20 },
});
