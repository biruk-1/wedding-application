import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { fontFamilies } from '@/theme/typography';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';

const AVATAR = require('../../../../assets/images/welcome-hero.jpg');

export function DashboardHomeHeader({
  onSettings,
  onNotifications,
}: {
  onSettings: () => void;
  onNotifications?: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <Image source={AVATAR} style={styles.avatar} accessibilityIgnoresInvertColors />
        <AppText style={styles.wordmark} accessibilityRole="header">
          Kiburan
        </AppText>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={10}
          onPress={onSettings}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="settings-outline" size={22} color={colors.heading} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          accessibilityState={{ disabled: !onNotifications }}
          hitSlop={10}
          disabled={!onNotifications}
          onPress={onNotifications}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed, !onNotifications && styles.disabled]}>
          <Ionicons name="notifications-outline" size={22} color={colors.heading} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
  },
  wordmark: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.heading,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  });
}
