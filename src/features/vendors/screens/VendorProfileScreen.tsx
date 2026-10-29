import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AuthScreenSkeleton } from '@/components/ui/Skeleton';
import {
  canWriteWedding,
  getVendorProfile,
  getWeddingVendorLink,
  removeVendorFromWedding,
  saveVendorToWedding,
} from '@/features/vendors/services/vendorService';
import type { VendorProfile, WeddingVendor } from '@/features/vendors/types';
import {
  formatMoney,
  parseInclusions,
  priceUnitLabel,
  resolveMediaUrl,
  vendorCoverUrl,
} from '@/features/vendors/utils/vendorHelpers';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function VendorProfileScreen() {
  const router = useRouter();
  const { weddingId, vendorId } = useLocalSearchParams<{
    weddingId: string;
    vendorId: string;
  }>();
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [link, setLink] = useState<WeddingVendor | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!vendorId || !weddingId) return;
    let cancelled = false;

    void (async () => {
      const [profileResult, linkResult, write] = await Promise.all([
        getVendorProfile(vendorId),
        getWeddingVendorLink(weddingId, vendorId),
        canWriteWedding(weddingId),
      ]);
      if (cancelled) return;

      if (!profileResult.ok) {
        setProfile(null);
        setError(profileResult.error.message);
      } else {
        setProfile(profileResult.data);
        setError(null);
      }
      if (linkResult.ok) setLink(linkResult.data);
      setCanWrite(write);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [vendorId, weddingId, reloadToken]);

  async function removeSaved() {
    if (!link) return;
    setBusy(true);
    setError(null);
    const result = await removeVendorFromWedding(link.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setLink(null);
  }

  async function onToggleSave() {
    if (!profile || !weddingId || !canWrite) return;
    if (link) {
      Alert.alert('Remove vendor?', 'This removes them from your wedding shortlist.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void removeSaved();
          },
        },
      ]);
      return;
    }

    setBusy(true);
    setError(null);
    const result = await saveVendorToWedding({
      weddingId,
      vendorId: profile.id,
      categoryId: profile.categories[0]?.id ?? null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setLink(result.data);
  }

  if (!weddingId || !vendorId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing vendor.</AppText>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AuthScreenSkeleton />
      </Screen>
    );
  }

  if (error && !profile) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header
          title="Vendor"
          showBack
          onBack={() => router.replace(`/(app)/weddings/${weddingId}/vendors` as Href)}
        />
        <View style={styles.block}>
          <AppText color="danger" style={styles.center}>
            {error}
          </AppText>
          <Button label="Retry" onPress={() => setReloadToken((v) => v + 1)} />
        </View>
      </Screen>
    );
  }

  if (!profile) return null;

  const cover = vendorCoverUrl(profile);
  const location = [profile.city, profile.country_code].filter(Boolean).join(', ');
  const gallery = profile.media
    .filter((item) => item.media_type === 'image')
    .map((item) => ({ id: item.id, url: resolveMediaUrl(item.storage_path), caption: item.caption }))
    .filter((item): item is { id: string; url: string; caption: string | null } => Boolean(item.url));

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header
        title={profile.business_name}
        subtitle={profile.categories.map((c) => c.name_en).join(' · ') || 'Vendor'}
        showBack
        onBack={() => router.replace(`/(app)/weddings/${weddingId}/vendors` as Href)}
      />

      {cover ? (
        <Image source={{ uri: cover }} style={styles.hero} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.hero, styles.heroFallback]}>
          <AppText color="textMuted">No cover image</AppText>
        </View>
      )}

      <View style={styles.stack}>
        {error ? (
          <AppText color="danger" variant="caption">
            {error}
          </AppText>
        ) : null}

        <Card style={styles.section}>
          <AppText variant="label">Overview</AppText>
          {location ? (
            <AppText variant="caption" color="textMuted">
              {location}
            </AppText>
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
        </Card>

        <View style={styles.actions}>
          {canWrite ? (
            <Button
              label={link ? 'Remove from wedding' : 'Save to wedding'}
              variant={link ? 'secondary' : 'success'}
              loading={busy}
              onPress={() => void onToggleSave()}
            />
          ) : null}
          {canWrite ? (
            <Button
              label="Send inquiry"
              onPress={() =>
                router.push(
                  `/(app)/weddings/${weddingId}/vendors/${vendorId}/inquire` as Href,
                )
              }
            />
          ) : (
            <AppText variant="caption" color="textMuted">
              Ask a wedding editor to save vendors or send inquiries.
            </AppText>
          )}
          {link ? (
            <Badge label={`Saved · ${link.status}`} tone="success" />
          ) : null}
        </View>

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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
              {gallery.map((item) => (
                <Image
                  key={item.id}
                  source={{ uri: item.url }}
                  style={styles.galleryImage}
                  contentFit="cover"
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
                  {review.rating}/5 · {review.reviewer?.display_name || 'Guest'}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    height: 200,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.lg,
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  section: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  serviceBlock: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  packageCard: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
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
  block: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  center: {
    textAlign: 'center',
  },
});
