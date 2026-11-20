import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WEDDING_TAB_BAR_HEIGHT } from '@/components/navigation/WeddingTabBar';
import { useColors } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedShadows, useThemedStyles } from '@/theme/useThemedStyles';

/** Circular support-style AI button above the home tab bar (bottom-right). Does not change the tab bar. */
export function AiAssistantFab({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const shadows = useThemedShadows();
  const styles = useThemedStyles(createStyles);
  const bottom = WEDDING_TAB_BAR_HEIGHT + Math.max(insets.bottom, spacing.sm) + spacing.md;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <View style={[styles.glow, { backgroundColor: colors.successMuted }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Meet our AI assistant"
        accessibilityHint="Opens Kiburan AI chat"
        onPress={onPress}
        style={({ pressed }) => [
          styles.fab,
          shadows.card,
          pressed && styles.pressed,
        ]}>
        <Ionicons name="sparkles" size={26} color={colors.onSuccess} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      right: spacing.xl,
      zIndex: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glow: {
      position: 'absolute',
      width: 72,
      height: 72,
      borderRadius: 36,
      opacity: 0.85,
    },
    fab: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.surfaceElevated,
    },
    pressed: {
      opacity: 0.92,
      transform: [{ scale: 0.97 }],
    },
  });
}
