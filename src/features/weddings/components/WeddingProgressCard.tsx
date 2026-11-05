import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { ChecklistProgress } from '@/features/checklist/types';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors, ThemeDecorations } from '@/theme/types';
import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import { useThemedShadows } from '@/theme/useThemedStyles';

/**
 * Dashboard progress card matching the Kiburan reference: large %, thin themed bar,
 * and a clear calendar “days left” counter on the right.
 */
export function WeddingProgressCard({
  progress,
  daysLeft,
  isPast = false,
  label = 'Wedding progress',
}: {
  progress: ChecklistProgress;
  daysLeft: number | null;
  isPast?: boolean;
  label?: string;
}) {
  const { colors, decorations } = useWeddingTheme();
  const shadows = useThemedShadows();
  const styles = useMemo(
    () => createStyles(colors, decorations, shadows),
    [colors, decorations, shadows],
  );
  const env = decorations.environment;
  const fillColor =
    env === 'traditional' ? colors.success : env === 'fusion' ? colors.accent : colors.primary;
  const daysCopy =
    daysLeft == null
      ? null
      : isPast
        ? daysLeft === 0
          ? 'Today'
          : `${daysLeft} day${daysLeft === 1 ? '' : 's'} ago`
        : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;

  return (
    <View
      style={styles.card}
      accessibilityLabel={`${label} ${progress.percent}% complete${
        daysCopy ? `, ${daysCopy}` : ''
      }`}>
      <AppText variant="caption" color="textMuted" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.topRow}>
        <AppText style={[styles.percent, { color: colors.heading }]}>{progress.percent}%</AppText>
        {daysCopy ? (
          <View style={styles.daysChip}>
            <Ionicons name="calendar-outline" size={16} color={fillColor} />
            <AppText variant="bodyMedium" style={[styles.daysText, { color: colors.text }]}>
              {daysCopy}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(0, Math.min(100, progress.percent))}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>
      <AppText variant="caption" color="textMuted">
        {progress.completed} of {progress.total} completed
        {progress.overdue > 0 ? ` · ${progress.overdue} overdue` : ''}
      </AppText>
    </View>
  );
}

function createStyles(
  colors: AppColors,
  decorations: ThemeDecorations,
  shadows: ReturnType<typeof useThemedShadows>,
) {
  const env = decorations.environment;
  return StyleSheet.create({
    card: {
      gap: spacing.sm,
      padding: spacing.lg,
      backgroundColor: colors.surfaceElevated,
      borderRadius: decorations.cardRadius + 2,
      borderWidth: env === 'traditional' ? 1 : StyleSheet.hairlineWidth,
      borderColor: env === 'traditional' ? colors.primaryMuted : colors.border,
      ...(env === 'traditional' ? shadows.soft : shadows.card),
    },
    label: {
      letterSpacing: 0.2,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    percent: {
      fontSize: 36,
      lineHeight: 40,
      fontWeight: '700',
      letterSpacing: -0.5,
    },
    daysChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor:
        env === 'traditional'
          ? colors.successMuted
          : env === 'fusion'
            ? colors.accentMuted
            : colors.primaryMuted,
    },
    daysText: {
      fontWeight: '600',
      fontSize: 14,
      lineHeight: 18,
    },
    track: {
      height: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    fill: {
      height: '100%',
      borderRadius: radii.pill,
    },
  });
}
