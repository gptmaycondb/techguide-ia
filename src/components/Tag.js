import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

// Compact metadata label used for model and manual tags.
export default function Tag({ label, color = colors.accent, size = 'default', style, textStyle }) {
  const compact = size === 'compact';
  return (
    <View style={[styles.tag, compact && styles.compact, { borderColor: color + '60' }, style]}>
      <Text style={[styles.text, compact && styles.compactText, { color }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { borderWidth: 1, borderRadius: radius.sm / 2, paddingHorizontal: 7, paddingVertical: 2 },
  compact: { borderRadius: 5, paddingHorizontal: 6 },
  text: { fontSize: 10, fontWeight: '600' },
  compactText: { fontSize: 9 },
});
