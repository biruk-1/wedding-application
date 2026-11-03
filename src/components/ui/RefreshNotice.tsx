import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

/**
 * Inline status for screens that already show cached data: a small spinner while refreshing in
 * the background, or a retry prompt when the refresh failed. Never replaces the content.
 */
export function RefreshNotice({
  isRefreshing,
  error,
  onRetry,
}: {
  isRefreshing?: boolean;
  error?: Error | null;
  onRetry: () => void;
}) {
  const colors = useColors();
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      minHeight: 24,
    },
    error: {
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.dangerMuted,
    },
    text: {
      flex: 1,
    },
  });

  if (error) {
    return (
      <View style={[styles.row, styles.error]} accessibilityLiveRegion="polite">
        <AppText variant="caption" color="danger" style={styles.text}>
          {"Couldn't refresh — showing saved data."}
        </AppText>
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <AppText variant="label" color="success">
            Retry
          </AppText>
        </Pressable>
      </View>
    );
  }
  if (isRefreshing) {
    return (
      <View style={styles.row} accessibilityLabel="Refreshing">
        <ActivityIndicator size="small" color={colors.textSubtle} />
        <AppText variant="caption" color="textSubtle">
          Updating…
        </AppText>
      </View>
    );
  }
  return null;
}
