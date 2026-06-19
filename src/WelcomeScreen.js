import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { colors as C, radius, spacing } from './theme';

export default function WelcomeScreen({ brands, onSelectBrand }) {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.surface} />
      <View style={styles.content}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>TG</Text>
        </View>

        <Text style={styles.title}>Bem-vindo ao TechGuide IA!</Text>
        <Text style={styles.sub}>Selecione a marca do equipamento que deseja consultar</Text>

        <View style={styles.brandRow}>
          {brands.map(b => (
            <TouchableOpacity
              key={b.id}
              style={[styles.card, { borderColor: b.color }]}
              onPress={() => onSelectBrand(b.id, b.manuals[0].id)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 36 }}>🖨️</Text>
              <Text style={[styles.cardLabel, { color: b.color }]}>{b.label}</Text>
              <Text style={styles.cardSub}>
                {b.manuals.length} modelo{b.manuals.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 16,
  },
  logo: {
    width: 72, height: 72, borderRadius: radius.card,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  logoText: { color: C.white, fontWeight: '800', fontSize: 26 },
  title: { color: C.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  sub: { color: C.dim, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  brandRow: { flexDirection: 'row', gap: spacing.lg, marginTop: 8, width: '100%' },
  card: {
    flex: 1, borderWidth: 2, borderRadius: radius.card, backgroundColor: C.surface,
    alignItems: 'center', paddingVertical: 24, paddingHorizontal: 12, gap: 10,
  },
  cardLabel: { fontSize: 20, fontWeight: '800' },
  cardSub: { color: C.muted, fontSize: 12 },
});
