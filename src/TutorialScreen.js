import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  StatusBar, FlatList, Dimensions,
} from 'react-native';

const { width: SW } = Dimensions.get('window');

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
};

const SLIDES = [
  {
    icon: '🤖',
    title: 'Bem-vindo ao TechGuide IA!',
    desc: 'Consulte manuais técnicos de impressoras HP e Ricoh com inteligência artificial. Respostas precisas baseadas nos manuais oficiais.',
  },
  {
    icon: '💬',
    title: 'Faça Perguntas',
    desc: 'Digite qualquer dúvida técnica — código de erro, procedimento de reparo, part number — e receba a resposta direto do manual do equipamento.',
  },
  {
    icon: '🔄',
    title: 'Troque de Equipamento',
    desc: 'Toque em "Trocar ▾" na barra superior para alternar entre modelos HP e Ricoh. Cada equipamento tem seu próprio histórico de conversa.',
  },
  {
    icon: '📚',
    title: 'Manuais para Download',
    desc: 'Na aba Manuais, baixe os PDFs completos para consulta offline. Útil em campo sem conexão à internet.',
  },
];

export default function TutorialScreen({ onComplete }) {
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]) setIndex(viewableItems[0].index);
  });

  function goNext() {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      onComplete();
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.surface} />

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={onComplete}>
        <Text style={styles.skipText}>Pular</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged.current}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.iconWrap}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Dots + Next */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
          <Text style={styles.nextText}>
            {index === SLIDES.length - 1 ? 'Começar' : 'Próximo'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  skipBtn: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
  skipText: { color: C.dim, fontSize: 14, fontWeight: '600' },

  slide: {
    width: SW,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    gap: 20,
  },

  iconWrap: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  iconText: { fontSize: 48 },

  title: { color: C.text, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
  desc:  { color: C.dim, fontSize: 15, textAlign: 'center', lineHeight: 24 },

  footer: {
    paddingHorizontal: 28, paddingBottom: 24, paddingTop: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },

  dots: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.border,
  },
  dotActive: { backgroundColor: C.accent, width: 20 },

  nextBtn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  nextText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
