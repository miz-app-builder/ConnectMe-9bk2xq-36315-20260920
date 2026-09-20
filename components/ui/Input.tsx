import React, { memo, forwardRef } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { ThemeColors, FONTS, SPACING, RADIUS } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  colors: ThemeColors;
  containerStyle?: ViewStyle;
}

export const Input = memo(forwardRef<TextInput, InputProps>(
  ({ label, error, colors, containerStyle, style, ...rest }, ref) => {
    return (
      <View style={[styles.container, containerStyle]}>
        {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBg,
              color: colors.text,
              borderColor: error ? colors.danger : colors.border,
            },
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          {...rest}
        />
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      </View>
    );
  }
));

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    marginBottom: SPACING.xs,
  },
  input: {
    height: 52,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    fontSize: FONTS.sizes.md,
    borderWidth: 1,
  },
  error: {
    fontSize: FONTS.sizes.xs,
    marginTop: SPACING.xs,
  },
});
