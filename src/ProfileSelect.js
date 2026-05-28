import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
  purple: '#a855f7',
};

export default function ProfileSelect({ onSelect }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Logo */}
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>TG</Text>
        </View>
        <Text style={styles.appName}>TechGuide IA</Text>
        <Text style={styles.appSub}>Consulta inteligente de manuais HP</Text>
      </View>

      {/* Question */}
      <Text style={styles.question}>Como voce quer usar o app?</Text>

      {/* Cards */}
      <View style={styles.cards}>

        {/* USER CARD */}
        <TouchableOpacity
          style={[styles.card, styles.cardUser]}
          onPress={() => onSelect('user')}
          activeOpacity={0.85}
        >
          <View style={[styles.cardIcon, { backgroundColor: C.accent2 + '20', borderColor: C.accent2 + '40' }]}>
            <Text style={styles.cardEmoji}>👤</Text>
          </View>
          <Text style={[styles.cardTitle, { color: C.accent2 }]}>Sou Usuario</Text>
          <Text style={styles.cardDesc}>
            Tenho uma impressora HP em casa ou no escritorio e quero tirar duvidas simples
          </Text>
          <View style={styles.cardTags}>
            {['Uso diario','Atolamentos','Configuracao','Suprimentos'].map(t => (
              <View key={t} style={[styles.tag, { borderColor: C.accent2 + '50' }]}>
                <Text style={[styles.tagText, { color: C.accent2 }]}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.cardBtn, { backgroundColor: C.accent2 }]}>
            <Text style={styles.cardBtnText}>Entrar como Usuario →</Text>
          </View>
        </TouchableOpacity>

        {/* TECH CARD */}
        <TouchableOpacity
          style={[styles.card, styles.cardTech]}
          onPress={() => onSelect('tech')}
          activeOpacity={0.85}
        >
          <View style={[styles.cardIcon, { backgroundColor: C.accent + '20', borderColor: C.accent + '40' }]}>
            <Text style={styles.cardEmoji}>🔧</Text>
          </View>
          <Text style={[styles.cardTitle, { color: C.accent }]}>Sou Tecnico</Text>
          <Text style={styles.cardDesc}>
            Sou tecnico ou revendedor e preciso de informacoes tecnicas, codigos de erro e pecas
          </Text>
          <View style={styles.cardTags}>
            {['Codigos de erro','Part numbers','Service manual','Diagnostico'].map(t => (
              <View key={t} style={[styles.tag, { borderColor: C.accent + '50' }]}>
                <Text style={[styles.tagText, { color: C.accent }]}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.cardBtn, { backgroundColor: C.accent }]}>
            <Text style={styles.cardBtnText}>Entrar como Tecnico →</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Voce pode trocar o perfil a qualquer momento</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  header: { alignItems: 'center', paddingTop: 40, paddingBottom: 28 },
  logo: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 22, letterSpacing: 1 },
  appName: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  appSub: { color: C.dim, fontSize: 12, marginTop: 4, textAlign: 'center' },
  question: {
    color: C.text, fontSize: 16, fontWeight: '700',
    textAlign: 'center', marginBottom: 20,
  },
  cards: { gap: 14 },
  card: {
    borderRadius: 16, padding: 20,
    borderWidth: 1, gap: 12,
  },
  cardUser: { backgroundColor: '#0d2020', borderColor: '#1a4040' },
  cardTech: { backgroundColor: '#0d1a2a', borderColor: '#1a2f50' },
  cardIcon: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  cardEmoji: { fontSize: 26 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardDesc: { color: C.dim, fontSize: 13, lineHeight: 19 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '600' },
  cardBtn: {
    borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginTop: 4,
  },
  cardBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  footer: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 16, marginBottom: 8 },
});
