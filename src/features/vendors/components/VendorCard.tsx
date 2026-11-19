import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { VendorListItem } from '@/features/vendors/types';
import {
  formatStartingPrice,
  vendorCoverUrl,
} from '@/features/vendors/utils/vendorHelpers';
import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors, ThemeDecorations } from '@/theme/types';
import { useThemedShadows } from '@/theme/useThemedStyles';

/**
 * Horizontal marketplace row matching the Kiburan reference:
 * thumbnail · name/meta · View profile.
 */
export function VendorCard({
  vendor,
  onPress,
}: {
  vendor: VendorListItem;
  onPress: () => void;
}) {
  const { colors, decorations } = useWeddingTheme();
  const shadows = useThemedShadows();
  const styles = useMemo(
    () => createStyles(colors, decorations, shadows.soft),
    [colors, decorations, shadows.soft],
  );
  const ctaColor =
    decorations.environment === 'traditional'
      ? colors.success
      : decorations.environment === 'fusion'
        ? colors.accent
        : colors.primary;
  const cover = vendorCoverUrl(vendor);
  const price = formatStartingPrice(vendor.startingPrice);
  const categoryLabel = vendor.categories.map((c) => c.name_en).join(' · ') || 'Vendor';
  const location = [vendor.city, vendor.country_code].filter(Boolean).join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${vendor.business_name}. View profile`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={styles.thumb}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={vendor.id}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons name="storefront-outline" size={22} color={colors.textSubtle} />
        </View>
      )}
      <View style={styles.body}>
        <AppText variant="bodyMedium" color="heading" numberOfLines={1}>
          {vendor.business_name}
        </AppText>
        <AppText variant="caption" color="primary" numberOfLines={1}>
          {categoryLabel}
        </AppText>
        {location ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {location}
          </AppText>
        ) : null}
        <AppText variant="caption" color={price ? 'text' : 'textSubtle'} numberOfLines={1}>
          {price ?? 'Pricing on request'}
        </AppText>
        {vendor.rating ? (
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color={colors.accent} />
            <AppText variant="caption" numberOfLines={1}>
              {vendor.rating.average.toFixed(1)} ({vendor.rating.count})
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.cta}>
        <AppText variant="caption" style={[styles.ctaLabel, { color: ctaColor }]}>
          View profile
        </AppText>
        <Ionicons name="chevron-forward" size={16} color={ctaColor} />
      </View>
    </Pressable>
  );
}

function createStyles(colors: AppColors, decorations: ThemeDecorations, softShadow: object) {
  const env = decorations.environment;
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: decorations.cardRadius + 2,
    borderWidth: env === 'traditional' ? 1 : StyleSheet.hairlineWidth,
    borderColor: env === 'traditional' ? colors.primaryMuted : colors.border,
    ...softShadow,
  },
  pressed: {
    opacity: 0.94,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: env === 'traditional' ? radii.sm : radii.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: env === 'modern' ? 0 : 1.5,
    borderColor: env === 'traditional' ? colors.primary : colors.accentMuted,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: spacing.xs,
  },
  ctaLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  });
}
