import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

const variants = {
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.dangerSurface, borderWidth: 1, borderColor: colors.dangerBorder },
};

// Shared rectangular action surface; children preserve complex existing button content.
export default function ActionButton({ variant = 'primary', label, icon, children, style, textStyle, ...props }) {
  return (
    <TouchableOpacity {...props} style={[styles.base, variants[variant], style]}>
      {children || <Text style={[styles.text, variant === 'danger' && styles.dangerText, textStyle]}>{icon ? `${icon} ${label}` : label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  text: { color: colors.white, fontSize: 13, fontWeight: '700' },
  dangerText: { color: colors.danger },
});
