import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { DesignData, DesignLayout } from '@/features/guests/types';
import { DEFAULT_ACCENT, isHexColor } from '@/features/guests/utils/guestHelpers';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { fontFamilies } from '@/theme/typography';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedShadows } from '@/theme/useThemedStyles';

const DEFAULT_TITLE = 'You are invited';
const DEFAULT_MESSAGE = 'Together with our families, we joyfully invite you to celebrate our wedding.';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Perceived brightness, used to pick readable text over the accent. */
function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

export type InvitationPreviewCardProps = {
  design: DesignData | null | undefined;
  /** e.g. "Selam & Dawit" */
  coupleNames: string;
  dateLabel?: string | null;
  locationLabel?: string | null;
  eventNames?: string[];
  /** Personalises the card ("Dear Abebe"); omitted for a generic preview. */
  guestName?: string | null;
};

/**
 * Renders a design (`design_data` convention) with real couple/date data. Pure presentation:
 * unknown layouts and invalid colours fall back to the classic layout and default accent.
 */
export function InvitationPreviewCard({
  design,
  coupleNames,
  dateLabel,
  locationLabel,
  eventNames,
  guestName,
}: InvitationPreviewCardProps) {
  const colors = useColors();
  const shadows = useThemedShadows();

  const layout: DesignLayout = design?.layout ?? 'classic';
  const accent = isHexColor(design?.accent) ? design!.accent!.trim() : DEFAULT_ACCENT;
  const title = design?.title?.trim() || DEFAULT_TITLE;
  const message = design?.message?.trim() || DEFAULT_MESSAGE;
  const modern = layout === 'modern';

  const textColor = modern ? colors.textOnDark : '#3A3328';
  const mutedColor = modern ? 'rgba(255,255,255,0.72)' : colors.textMuted;
  const background = modern ? '#1F2A22' : layout === 'floral' ? withAlpha(accent, 0.12) : colors.surface;
  const align = modern ? 'flex-start' : 'center';
  const textAlign = modern ? 'left' : 'center';

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        { backgroundColor: background },
        layout === 'classic' && { borderColor: accent, borderWidth: 1.5 },
        layout === 'floral' && { borderColor: withAlpha(accent, 0.5), borderWidth: 1 },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Invitation preview for ${coupleNames}`}>
      {layout === 'floral' ? (
        <>
          <View style={[styles.petal, styles.petalTopLeft, { backgroundColor: withAlpha(accent, 0.28) }]} />
          <View style={[styles.petalSmall, styles.petalTopLeftSmall, { backgroundColor: withAlpha(accent, 0.18) }]} />
          <View style={[styles.petal, styles.petalBottomRight, { backgroundColor: withAlpha(accent, 0.28) }]} />
          <View
            style={[styles.petalSmall, styles.petalBottomRightSmall, { backgroundColor: withAlpha(accent, 0.18) }]}
          />
        </>
      ) : null}
      {layout === 'classic' ? <View style={[styles.innerFrame, { borderColor: withAlpha(accent, 0.45) }]} /> : null}
      {modern ? <View style={[styles.modernBar, { backgroundColor: accent }]} /> : null}

      <View style={[styles.content, { alignItems: align }]}>
        {guestName ? (
          <AppText variant="caption" style={{ color: mutedColor, textAlign }}>
            Dear {guestName}
          </AppText>
        ) : null}
        <AppText
          variant="caption"
          style={[
            styles.eyebrow,
            { color: modern ? accent : isDark(accent) ? accent : '#8A7344', textAlign },
          ]}>
          {title.toUpperCase()}
        </AppText>
        <AppText
          style={[
            styles.names,
            {
              color: textColor,
              textAlign,
              fontFamily: modern ? fontFamilies.bodyBold : fontFamilies.displayBold,
              fontSize: modern ? 30 : 38,
              lineHeight: modern ? 36 : 44,
            },
          ]}>
          {coupleNames}
        </AppText>
        {!modern ? <View style={[styles.rule, { backgroundColor: accent }]} /> : null}
        <AppText variant="body" style={{ color: mutedColor, textAlign }}>
          {message}
        </AppText>
        {dateLabel ? (
          <AppText variant="subtitle" style={{ color: textColor, textAlign }}>
            {dateLabel}
          </AppText>
        ) : null}
        {locationLabel ? (
          <AppText variant="caption" style={{ color: mutedColor, textAlign }}>
            {locationLabel}
          </AppText>
        ) : null}
        {eventNames && eventNames.length > 0 ? (
          <View style={[styles.events, { alignItems: align }]}>
            {eventNames.map((name) => (
              <View key={name} style={[styles.eventPill, { borderColor: withAlpha(accent, 0.7) }]}>
                <AppText variant="caption" style={{ color: textColor }}>
                  {name}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    minHeight: 320,
    justifyContent: 'center',
  },
  innerFrame: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  modernBar: {
    height: 6,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  petal: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  petalSmall: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  petalTopLeft: { top: -40, left: -40 },
  petalTopLeftSmall: { top: 36, left: 40 },
  petalBottomRight: { bottom: -40, right: -40 },
  petalBottomRightSmall: { bottom: 36, right: 40 },
  content: {
    gap: spacing.md,
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
  },
  eyebrow: {
    letterSpacing: 2.4,
    fontFamily: fontFamilies.bodyMedium,
  },
  names: {
    letterSpacing: 0.4,
  },
  rule: {
    width: 56,
    height: 2,
    borderRadius: 1,
  },
  events: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  eventPill: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
