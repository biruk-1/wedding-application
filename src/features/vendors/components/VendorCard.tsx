import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
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
 * Vendor-first marketplace card. Public listings are RLS-gated to verified vendors,
 * so the Verified badge reflects real listing eligibility — never invented ratings/prices.
 */
export function VendorCard({
  vendor,
  onPress,
  layout = 'row',
}: {
  vendor: VendorListItem;
  onPress: () => void;
  layout?: 'row' | 'grid';
}) {
  const { colors, decorations } = useWeddingTheme();
  const shadows = useThemedShadows();
  const styles = useMemo(
    () => createStyles(colors, decorations, shadows.soft, layout),
    [colors, decorations, shadows.soft, layout],
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
  const serviceSummary =
    vendor.serviceTitles.length > 0 ? vendor.serviceTitles.slice(0, 2).join(' · ') : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${vendor.business_name}. Verified vendor. View profile`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
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
          <Ionicons name="storefront-outline" size={layout === 'grid' ? 28 : 22} color={colors.textSubtle} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText
            variant={layout === 'grid' ? 'bodyMedium' : 'bodyMedium'}
            color="heading"
            numberOfLines={layout === 'grid' ? 2 : 1}
            style={styles.name}>
            {vendor.business_name}
          </AppText>
          <Badge label="Verified" tone="success" style={styles.badge} />
        </View>
        <AppText variant="caption" color="primary" numberOfLines={1}>
          {categoryLabel}
        </AppText>
        {location ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {location}
          </AppText>
        ) : null}
        {serviceSummary ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {serviceSummary}
          </AppText>
        ) : null}
        {price ? (
          <AppText variant="caption" color="text" numberOfLines={1}>
            {price}
          </AppText>
        ) : null}
        {vendor.rating ? (
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color={colors.accent} />
            <AppText variant="caption" numberOfLines={1}>
              {vendor.rating.average.toFixed(1)} ({vendor.rating.count})
            </AppText>
          </View>
        ) : null}
        {layout === 'row' ? (
          <View style={styles.cta}>
            <AppText variant="caption" style={[styles.ctaLabel, { color: ctaColor }]}>
              View profile
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={ctaColor} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function createStyles(
  colors: AppColors,
  decorations: ThemeDecorations,
  softShadow: object,
  layout: 'row' | 'grid',
) {
  const env = decorations.environment;
  const isGrid = layout === 'grid';
  return StyleSheet.create({
    card: {
      flexDirection: isGrid ? 'column' : 'row',
      alignItems: isGrid ? 'stretch' : 'center',
      gap: spacing.md,
      padding: isGrid ? 0 : spacing.md,
      overflow: 'hidden',
      backgroundColor: colors.surfaceElevated,
      borderRadius: decorations.cardRadius + 2,
      borderWidth: env === 'traditional' ? 1 : StyleSheet.hairlineWidth,
      borderColor: env === 'traditional' ? colors.primaryMuted : colors.border,
      ...softShadow,
      flex: isGrid ? 1 : undefined,
    },
    pressed: {
      opacity: 0.94,
    },
    thumb: {
      width: isGrid ? '100%' : 80,
      height: isGrid ? 120 : 80,
      borderRadius: isGrid ? 0 : env === 'traditional' ? radii.sm : radii.lg,
      backgroundColor: colors.surfaceMuted,
      borderWidth: isGrid || env === 'modern' ? 0 : 1.5,
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
      padding: isGrid ? spacing.md : 0,
      paddingTop: isGrid ? spacing.sm : 0,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    name: {
      flex: 1,
      minWidth: 0,
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      marginTop: 1,
    },
    rating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginTop: spacing.xs,
    },
    ctaLabel: {
      fontWeight: '600',
    },
  });
}
