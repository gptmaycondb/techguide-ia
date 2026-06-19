import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme';

const tones = {
  offline: { color: colors.offline, backgroundColor: colors.offlineSurface, borderColor: colors.offline },
  alert: { color: colors.alert, backgroundColor: colors.alert + '20', borderColor: colors.alert },
  danger: { color: colors.danger, backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder },
};

// Small semantic status marker; supports an icon-only circle or a text pill.
export default function StatusBadge({ label, icon, tone = 'offline', size = 24, shape = 'circle', onPress, style, textStyle }) {
  const Component = onPress ? TouchableOpacity : View;
  const palette = tones[tone] || tones.offline;
  return (
    <Component
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={[
        styles.base,
        { width: shape === 'circle' ? size : undefined, minWidth: shape === 'pill' ? size : undefined, height: shape === 'pill' ? Math.round(size * 0.69) : size, borderRadius: shape === 'pill' ? size : size / 2 },
        palette,
        style,
      ]}
    >
      <Text style={[styles.text, { color: palette.color }, textStyle]}>{icon || label}</Text>
    </Component>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' },
});
