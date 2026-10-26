import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
};

const variantStyles: Record<
  ButtonVariant,
  { idle: ViewStyle; pressed: ViewStyle; label: string; spinner: string }
> = {
  primary: {
    idle: { backgroundColor: colors.primary },
    pressed: { backgroundColor: colors.primaryPressed },
    label: colors.onPrimary,
    spinner: colors.onPrimary,
  },
  secondary: {
    idle: {
      backgroundColor: colors.transparent,
      borderWidth: 1.5,
      borderColor: colors.success,
    },
    pressed: { backgroundColor: colors.successMuted },
    label: colors.success,
    spinner: colors.success,
  },

  ghost: {
    idle: { backgroundColor: colors.transparent },
    pressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
    label: colors.textOnDark,
    spinner: colors.textOnDark,
  },
  success: {
    idle: { backgroundColor: colors.success },
    pressed: { backgroundColor: colors.successPressed },
    label: colors.onSuccess,
    spinner: colors.onSuccess,
  },
  danger: {
    idle: {
      backgroundColor: colors.transparent,
      borderWidth: 1.5,
      borderColor: colors.danger,
    },
    pressed: { backgroundColor: colors.dangerMuted },
    label: colors.danger,
    spinner: colors.danger,
  },
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  fullWidth = true,
  style,
  ...rest
}: ButtonProps) {
  const palette = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => {
        const composed: StyleProp<ViewStyle> = [
          styles.base,
          fullWidth && styles.fullWidth,
          palette.idle,
          state.pressed && !isDisabled ? palette.pressed : null,
          isDisabled && styles.disabled,
          typeof style === 'function' ? style(state) : style,
        ];
        return composed;
      }}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={palette.spinner} />
      ) : (
        <Text style={[styles.label, { color: palette.label }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.button,
    textAlign: 'center',
  },
});
