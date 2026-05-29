import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar,
} from 'react-native';
import { Image } from 'react-native';

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
};

export default function ProfileSelect({ onSelect }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.content}>
        {/* Logo */}
        <Image
          source={require('../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.appName}>TechGuide IA</Text>
        <Text style={styles.appSub}>Consulta inteligente de manuais técnicos multimarca</Text>

        <View style={styles.divider} />

        <Text style={styles.welcome}>
          Bem-vindo! O TechGuide IA reúne manuais técnicos de diferentes modelos e marcas — HP e Ricoh. Consulte códigos de erro, procedimentos de manutenção e especificações com o apoio da inteligência artificial.
        </Text>

        <TouchableOpacity
          style={styles.enterBtn}
          onPress={() => onSelect('user')}
          activeOpacity={0.85}
        >
          <Text style={styles.enterBtnText}>Acessar o App →</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Acesso offline disponível • PDFs originais incluídos
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  logo: { width: 120, height: 120, borderRadius: 24 },
  appName: { color: C.text, fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
  appSub: { color: C.dim, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  divider: { width: 60, height: 2, backgroundColor: C.accent, borderRadius: 1, marginVertical: 8 },
  welcome: { color: C.dim, fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  enterBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 40,
    marginTop: 8,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  enterBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  footer: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 8 },
});
