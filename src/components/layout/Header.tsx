import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export type HeaderProps = ViewProps & {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
};

export function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  style,
  ...rest
}: HeaderProps) {
  const router = useRouter();

  return (
    <View style={[styles.container, style]} {...rest}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={onBack ?? (() => router.back())}
          style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.success} />
        </Pressable>
      ) : (
        <View style={styles.side} />
      )}
      <View style={styles.titles}>
        <AppText variant="title" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: 2,
  },
  side: {
    width: 40,
  },
  titles: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  title: {
    textAlign: 'center',
    color: colors.text,
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
});
