import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import type { VendorListItem } from '@/features/vendors/types';
import {
  formatStartingPrice,
  vendorCoverUrl,
} from '@/features/vendors/utils/vendorHelpers';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function VendorCard({
  vendor,
  onPress,
}: {
  vendor: VendorListItem;
  onPress: () => void;
}) {
  const cover = vendorCoverUrl(vendor);
  const price = formatStartingPrice(vendor.startingPrice);
  const categoryLabel = vendor.categories.map((c) => c.name_en).join(' · ') || 'Vendor';
  const location = [vendor.city, vendor.country_code].filter(Boolean).join(', ');

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={vendor.business_name}>
      <Card padded={false} style={styles.card}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <AppText variant="caption" color="textMuted">
              No photo yet
            </AppText>
          </View>
        )}
        <View style={styles.body}>
          <AppText variant="label">{vendor.business_name}</AppText>
          <AppText variant="caption" color="primary">
            {categoryLabel}
          </AppText>
          {location ? (
            <AppText variant="caption" color="textMuted">
              {location}
            </AppText>
          ) : null}
          {price ? (
            <AppText variant="caption" color="text" style={styles.price}>
              {price}
            </AppText>
          ) : (
            <AppText variant="caption" color="textSubtle">
              Pricing on request
            </AppText>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: 148,
    backgroundColor: colors.surfaceMuted,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  body: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  price: {
    marginTop: spacing.xs,
  },
});
