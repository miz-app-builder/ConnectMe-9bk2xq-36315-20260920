import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemeColors, FONTS, SPACING } from '@/constants/theme';

interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  colors: ThemeColors;
}

export const EmptyState = memo(({ icon, title, subtitle, colors }: EmptyStateProps) => (
  <View style={styles.container}>
    <MaterialIcons name={icon} size={64} color={colors.textMuted} />
    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
  </View>
));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxxl,
    gap: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});
