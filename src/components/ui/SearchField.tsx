import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { AppColors } from '@/theme/types';

export type SearchFieldProps = Omit<TextInputProps, 'style'> & {
  containerStyle?: TextInputProps['style'];
  /** Clears the query when provided and a value exists (Android-friendly; iOS also keeps while-editing clear). */
  onClear?: () => void;
};

export function SearchField({ containerStyle, onClear, value, onChangeText, ...rest }: SearchFieldProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasQuery = typeof value === 'string' && value.length > 0;

  return (
    <View style={[styles.shell, containerStyle]}>
      <Ionicons name="search" size={18} color={colors.textSubtle} accessibilityElementsHidden />
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode={onClear ? 'never' : 'while-editing'}
      />
      {hasQuery && onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          onPress={onClear}
          style={styles.clear}>
          <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
        </Pressable>
      ) : null}
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
    clear: {
      padding: spacing.xs,
    },
  });
}
