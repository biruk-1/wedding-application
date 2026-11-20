import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedBackground } from '@/components/theme/ThemedBackground';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { VendorProfile } from '@/features/vendors/types';
import {
  formatMoney,
  parseInclusions,
  priceUnitLabel,
  resolveMediaUrl,
  vendorCoverUrl,
} from '@/features/vendors/utils/vendorHelpers';
import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

/**
 * Vendor profile body shared by the signed-in marketplace and public Explore.
 * Callers supply the actions, which differ by context (wedding shortlist vs guest sign-in).
 */
export function VendorProfileDetails({
  profile,
  actions,
  notice,
  onInquireService,
}: {
  profile: VendorProfile;
  actions?: ReactNode;
  notice?: ReactNode;
  onInquireService?: (serviceId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const cover = vendorCoverUrl(profile);
  const location = [profile.city, profile.country_code].filter(Boolean).join(', ');
  const gallery = profile.media
    .filter((item) => item.media_type === 'image')
    .map((item) => ({ id: item.id, url: resolveMediaUrl(item.storage_path), caption: item.caption }))
    .filter((item): item is { id: string; url: string; caption: string | null } => Boolean(item.url));

  return (
    <>
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={styles.hero}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          accessibilityLabel={`${profile.business_name} cover photo`}
        />
      ) : (
        <View style={[styles.hero, styles.heroFallback]}>
          <ThemedBackground compact />
          <AppText color="textMuted">No cover image</AppText>
        </View>
      )}

      <View style={styles.stack}>
        {notice}

        <Card style={styles.section} ornament>
          <View style={styles.overviewHeader}>
            <AppText variant="label">Overview</AppText>
            <Badge label="Verified" tone="success" />
          </View>
          {profile.categories.length > 0 ? (
            <AppText variant="caption" color="primary">
              {profile.categories.map((c) => c.name_en).join(' · ')}
            </AppText>
          ) : null}
          {location ? (
            <AppText variant="caption" color="textMuted">
              {location}
            </AppText>
          ) : null}
          {profile.rating ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={colors.accent} />
              <AppText variant="caption">
                {profile.rating.average.toFixed(1)} · {profile.rating.count}{' '}
                {profile.rating.count === 1 ? 'review' : 'reviews'}
              </AppText>
            </View>
          ) : null}
          {profile.description ? (
            <AppText variant="body">{profile.description}</AppText>
          ) : (
            <AppText variant="body" color="textMuted">
              No description yet.
            </AppText>
          )}
          {profile.website_url ? (
            <AppText variant="caption" color="primary">
              {profile.website_url}
            </AppText>
          ) : null}
          {profile.instagram_url ? (
            <AppText variant="caption" color="primary">
              {profile.instagram_url}
            </AppText>
          ) : null}
        </Card>

        {actions ? <View style={styles.actions}>{actions}</View> : null}

        <Card style={styles.section}>
          <AppText variant="label">Services</AppText>
          {profile.services.length === 0 ? (
            <AppText variant="body" color="textMuted">
              No active services listed.
            </AppText>
          ) : (
            profile.services.map((service) => {
              const price = formatMoney(service.base_price, service.currency_code);
              return (
                <View key={service.id} style={styles.serviceBlock}>
                  <AppText variant="subtitle">{service.title}</AppText>
                  {service.description ? (
                    <AppText variant="body" color="textMuted">
                      {service.description}
                    </AppText>
                  ) : null}
                  <AppText variant="caption" color="primary">
                    {price
                      ? `${price} · ${priceUnitLabel(service.price_unit)}`
                      : 'Price on request'}
                  </AppText>
                  {service.packages.map((pkg) => {
                    const inclusions = parseInclusions(pkg.inclusions);
                    const pkgPrice = formatMoney(pkg.price, pkg.currency_code);
                    return (
                      <View key={pkg.id} style={styles.packageCard}>
                        <AppText variant="label">{pkg.name}</AppText>
                        {pkg.description ? (
                          <AppText variant="caption" color="textMuted">
                            {pkg.description}
                          </AppText>
                        ) : null}
                        <AppText variant="caption">{pkgPrice ?? 'Price on request'}</AppText>
                        {inclusions.length > 0 ? (
                          <AppText variant="caption" color="textMuted">
                            Includes: {inclusions.join(', ')}
                          </AppText>
                        ) : null}
                      </View>
                    );
                  })}
                  {onInquireService ? (
                    <Button
                      label="Ask about this service"
                      variant="outline"
                      size="compact"
                      onPress={() => onInquireService(service.id)}
                    />
                  ) : null}
                </View>
              );
            })
          )}
        </Card>

        {gallery.length > 0 ? (
          <Card style={styles.section} padded={false}>
            <AppText variant="label" style={styles.galleryTitle}>
              Gallery
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gallery}>
              {gallery.map((item) => (
                <Image
                  key={item.id}
                  source={{ uri: item.url }}
                  style={styles.galleryImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={item.id}
                  accessibilityLabel={item.caption ?? 'Vendor photo'}
                />
              ))}
            </ScrollView>
          </Card>
        ) : null}

        {profile.availability.length > 0 ? (
          <Card style={styles.section}>
            <AppText variant="label">Upcoming schedule windows</AppText>
            <AppText variant="caption" color="textMuted">
              Shown as recorded by the vendor — not a booking confirmation.
            </AppText>
            {profile.availability.map((slot) => (
              <AppText key={slot.id} variant="caption">
                {new Date(slot.starts_at).toLocaleString()} →{' '}
                {new Date(slot.ends_at).toLocaleString()} · {slot.status}
              </AppText>
            ))}
          </Card>
        ) : null}

        {profile.reviews.length > 0 ? (
          <Card style={styles.section}>
            <AppText variant="label">Reviews</AppText>
            {profile.reviews.map((review) => (
              <View key={review.id} style={styles.review}>
                <AppText variant="caption">
                  {review.rating}/5 · {new Date(review.created_at).toLocaleDateString()}
                </AppText>
                {review.comment ? (
                  <AppText variant="body" color="textMuted">
                    {review.comment}
                  </AppText>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}
      </View>
    </>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    hero: {
      width: '100%',
      height: 220,
      borderRadius: radii.lg,
      backgroundColor: colors.surfaceMuted,
      marginBottom: spacing.lg,
    },
    heroFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    stack: {
      gap: spacing.lg,
      paddingBottom: spacing['2xl'],
    },
    section: {
      gap: spacing.sm,
    },
    overviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    actions: {
      gap: spacing.md,
    },
    serviceBlock: {
      gap: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.primaryMuted,
    },
    packageCard: {
      gap: spacing.xs,
      marginTop: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.ornament,
    },
    galleryTitle: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    gallery: {
      gap: spacing.sm,
      padding: spacing.lg,
    },
    galleryImage: {
      width: 160,
      height: 120,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMuted,
    },
    review: {
      gap: spacing.xs,
      paddingTop: spacing.sm,
    },
  });
}
