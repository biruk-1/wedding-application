import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { getCelebrationCopy, normalizeCelebrationKind } from '@/features/weddings/celebrationCopy';
import { CELEBRATION_BY_KIND } from '@/features/weddings/celebrationsConfig';
import { getCountdownParts } from '@/features/weddings/utils/countdown';
import { useColors, useDecorations } from '@/theme/WeddingThemeContext';
import type { AppColors } from '@/theme/types';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

function compactDateLabel(isoDate: string | null | undefined): string | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DashboardHero({
  celebrationKind,
  title,
  partnerOne,
  partnerTwo,
  weddingDate,
  city,
  onEdit,
}: {
  celebrationKind: string | null;
  title: string;
  partnerOne: string | null;
  partnerTwo: string | null;
  weddingDate: string | null;
  city: string | null;
  onEdit?: () => void;
}) {
  const colors = useColors();
  const decorations = useDecorations();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const kind = normalizeCelebrationKind(celebrationKind);
  const copy = getCelebrationCopy(kind);
  const dateLabel = compactDateLabel(weddingDate);
  const meta = [dateLabel, city].filter(Boolean).join(' · ');
  const names = [partnerOne, partnerTwo].filter(Boolean).join(' & ');
  const heroTitle = kind === 'wedding' ? names : title;
  const countdown = weddingDate ? getCountdownParts(weddingDate) : null;
  const heroImage =
    kind === 'wedding' ? decorations.dashboardHeroImage : CELEBRATION_BY_KIND[kind].image;

  return (
    <View style={styles.wrap}>
      <Image
        source={heroImage}
        style={styles.image}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        colors={[...decorations.heroGradient]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.editAccessibilityLabel}
          onPress={onEdit}
          style={({ pressed }) => [styles.editBtn, pressed && styles.editPressed]}>
          <Ionicons name="pencil" size={14} color={colors.text} />
          <AppText variant="caption" style={styles.editLabel}>
            Edit
          </AppText>
        </Pressable>
      ) : null}

      <View style={styles.content}>
        {heroTitle ? (
          <AppText variant="display" color="textOnDark" style={styles.names}>
            {heroTitle}
          </AppText>
        ) : null}
        {meta ? (
          <AppText variant="bodyMedium" color="textOnDark" style={styles.meta}>
            {meta}
          </AppText>
        ) : null}

        {countdown ? (
          <View style={styles.countdown} accessibilityLabel={copy.countdownAccessibilityLabel}>
            {[
              { label: 'Days', value: countdown.days },
              { label: 'Hours', value: countdown.hours },
              { label: 'Minutes', value: countdown.minutes },
            ].map((cell, index) => (
              <View key={cell.label} style={styles.countdownCell}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.countdownInner}>
                  <AppText style={styles.countdownValue}>{cell.value}</AppText>
                  <AppText style={styles.countdownLabel}>{cell.label}</AppText>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      borderRadius: radii.xl,
      overflow: 'hidden',
      minHeight: 240,
      backgroundColor: colors.heading,
    },
    image: {
      ...StyleSheet.absoluteFill,
      width: '100%',
      height: '100%',
    },
    editBtn: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      zIndex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: 'rgba(255,255,255,0.92)',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
    },
    editPressed: {
      opacity: 0.85,
    },
    editLabel: {
      color: colors.text,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: spacing.lg,
      gap: spacing.xs,
      minHeight: 240,
    },
    names: {
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    meta: {
      opacity: 0.95,
      marginBottom: spacing.sm,
    },
    countdown: {
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: 'rgba(20, 22, 20, 0.62)',
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    countdownCell: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: 'rgba(255,255,255,0.28)',
      marginRight: spacing.sm,
    },
    countdownInner: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    countdownValue: {
      color: colors.textOnDark,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '700',
    },
    countdownLabel: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 11,
      lineHeight: 14,
    },
  });
}
