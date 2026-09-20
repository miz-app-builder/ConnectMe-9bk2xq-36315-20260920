import React, { memo } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button = memo(({ label, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) => {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isDanger && styles.danger,
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? COLORS.primary : '#fff'} size="small" />
      ) : (
        <Text style={[styles.label, isPrimary && styles.labelPrimary, isDanger && styles.labelDanger, isGhost && styles.labelGhost]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  danger: {
    backgroundColor: COLORS.light.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
  },
  labelPrimary: { color: '#FFFFFF' },
  labelDanger: { color: '#FFFFFF' },
  labelGhost: { color: COLORS.primary },
});
