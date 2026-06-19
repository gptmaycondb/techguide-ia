import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

// Flexible themed surface: pass `as` for TouchableOpacity or Animated.View.
export default function SurfaceCard({ as: Component = View, variant = 'card', style, children, ...props }) {
  return <Component {...props} style={[styles.base, styles[variant], style]}>{children}</Component>;
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.surface, borderRadius: radius.card },
  raised: { backgroundColor: colors.surface2, borderRadius: radius.lg },
  compact: { backgroundColor: colors.surface, borderRadius: radius.md },
  bare: { backgroundColor: 'transparent' },
});
