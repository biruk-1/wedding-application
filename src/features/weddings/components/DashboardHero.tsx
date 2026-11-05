import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { FusionStripe, TibebBand } from '@/components/theme/ornaments';
import { AppText } from '@/components/ui/AppText';
import { getCelebrationCopy, normalizeCelebrationKind } from '@/features/weddings/celebrationCopy';
import { CELEBRATION_BY_KIND } from '@/features/weddings/celebrationsConfig';
import { getCountdownParts } from '@/features/weddings/utils/countdown';
import { useColors, useDecorations } from '@/theme/WeddingThemeContext';
import type { AppColors, ThemeDecorations } from '@/theme/types';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

function compactDateLabel(isoDate: string | null | undefined): string | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function greetingForNow(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHero({
  celebrationKind,
  title,
  partnerOne,
  partnerTwo,
  weddingDate,
  city,
  coverImageUrl,
  greetingName,
  onEdit,
  editBusy = false,
}: {
  celebrationKind: string | null;
  title: string;
  partnerOne: string | null;
  partnerTwo: string | null;
  weddingDate: string | null;
  city: string | null;
  /** Custom cover uploaded by the couple; falls back to theme / celebration hero. */
  coverImageUrl?: string | null;
  /** Optional first name for the soft greeting (reference: “Good morning, Selam!”). */
  greetingName?: string | null;
  onEdit?: () => void;
  editBusy?: boolean;
}) {
  const colors = useColors();
  const decorations = useDecorations();
  const styles = useMemo(
    () => createStyles(colors, decorations),
    [colors, decorations],
  );
  const kind = normalizeCelebrationKind(celebrationKind);
  const copy = getCelebrationCopy(kind);
  const dateLabel = compactDateLabel(weddingDate);
  const meta = [dateLabel, city].filter(Boolean).join(' · ');
  const names = [partnerOne, partnerTwo].filter(Boolean).join(' & ');
  const heroTitle = kind === 'wedding' ? names : title;
  const greetName = (greetingName || partnerOne || '').trim().split(/\s+/)[0] || null;
  const greeting = greetName ? `${greetingForNow()}, ${greetName}!` : `${greetingForNow()}!`;
  const countdown = weddingDate ? getCountdownParts(weddingDate) : null;
  const defaultHero =
    kind === 'wedding' ? decorations.dashboardHeroImage : CELEBRATION_BY_KIND[kind].image;
  const heroSource = coverImageUrl ? { uri: coverImageUrl } : defaultHero;
  const env = decorations.environment;

  return (
    <View style={[styles.wrap, { borderRadius: decorations.cardRadius + 4 }]}>
      <Image
        source={heroSource}
        style={styles.image}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      {/* Light top + bottom scrims only — keep the photo itself looking real. */}
      <LinearGradient
        colors={
          env === 'traditional'
            ? ['rgba(28,40,30,0.45)', 'rgba(28,40,30,0.08)', 'rgba(28,40,30,0.55)']
            : env === 'fusion'
              ? ['rgba(40,28,30,0.42)', 'rgba(40,28,30,0.06)', 'rgba(40,28,30,0.58)']
              : ['rgba(20,24,20,0.38)', 'rgba(20,24,20,0.05)', 'rgba(20,24,20,0.52)']
        }
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      {env === 'traditional' ? (
        <View style={styles.bottomBand}>
          <TibebBand height={9} />
        </View>
      ) : null}
      {env === 'fusion' ? (
        <View style={styles.topStripe}>
          <FusionStripe height={7} />
        </View>
      ) : null}

      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            editBusy ? 'Updating cover photo' : copy.editAccessibilityLabel
          }
          accessibilityState={{ busy: editBusy, disabled: editBusy }}
          disabled={editBusy}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.editBtn,
            pressed && !editBusy && styles.editPressed,
          ]}>
          {editBusy ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Ionicons name="pencil" size={14} color={colors.text} />
          )}
          <AppText variant="caption" style={styles.editLabel}>
            {editBusy ? 'Saving…' : 'Edit'}
          </AppText>
        </Pressable>
      ) : null}

      <View style={styles.content}>
        <AppText variant="bodyMedium" color="textOnDark" style={styles.greeting}>
          {greeting}
        </AppText>
        <View style={styles.spacer} />
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
          <View
            style={[
              styles.countdown,
              env === 'traditional' && styles.countdownTraditional,
              env === 'fusion' && styles.countdownFusion,
            ]}
            accessibilityLabel={copy.countdownAccessibilityLabel}>
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

function createStyles(colors: AppColors, decorations: ThemeDecorations) {
  return StyleSheet.create({
    wrap: {
      borderRadius: decorations.cardRadius + 4,
      overflow: 'hidden',
      minHeight: 300,
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
      minWidth: 72,
      justifyContent: 'center',
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
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      minHeight: 300,
      gap: spacing.xs,
    },
    greeting: {
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
      fontWeight: '600',
      opacity: 0.96,
      maxWidth: '78%',
    },
    spacer: {
      flex: 1,
    },
    names: {
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 10,
    },
    meta: {
      opacity: 0.94,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    countdown: {
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: 'rgba(20, 22, 20, 0.62)',
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      marginTop: spacing.xs,
    },
    countdownTraditional: {
      backgroundColor: 'rgba(28, 59, 44, 0.78)',
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: 'rgba(198, 154, 69, 0.6)',
    },
    countdownFusion: {
      backgroundColor: 'rgba(52, 30, 33, 0.66)',
      borderWidth: 1,
      borderColor: 'rgba(185, 145, 80, 0.45)',
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
    bottomBand: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    },
    topStripe: {
      position: 'absolute',
      top: spacing.md,
      left: '32%',
      right: '32%',
      zIndex: 1,
    },
  });
}
