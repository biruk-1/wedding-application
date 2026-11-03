import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { AppColors } from '@/theme/types';

export type SearchFieldProps = Omit<TextInputProps, 'style'> & {
  containerStyle?: TextInputProps['style'];
};

export function SearchField({ containerStyle, ...rest }: SearchFieldProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.shell, containerStyle]}>
      <Ionicons name="search" size={18} color={colors.textSubtle} accessibilityElementsHidden />
      <TextInput
        {...rest}
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  });
}
