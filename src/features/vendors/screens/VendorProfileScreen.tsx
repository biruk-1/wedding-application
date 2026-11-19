import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { VendorProfileSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { VendorProfileDetails } from '@/features/vendors/components/VendorProfileDetails';
import {
  canWriteWedding,
  getVendorProfile,
  getWeddingVendorLink,
  removeVendorFromWedding,
  saveVendorToWedding,
} from '@/features/vendors/services/vendorService';
import type { VendorProfile, WeddingVendor } from '@/features/vendors/types';
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
        <VendorProfileSkeleton />
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

  const inquireHref = (serviceId?: string) =>
    `/(app)/weddings/${weddingId}/vendors/${vendorId}/inquire${
      serviceId ? `?serviceId=${serviceId}` : ''
    }` as Href;

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header
        title={profile.business_name}
        subtitle={profile.categories.map((c) => c.name_en).join(' · ') || 'Vendor'}
        showBack
        onBack={() => router.replace(`/(app)/weddings/${weddingId}/vendors` as Href)}
      />

      <VendorProfileDetails
        profile={profile}
        onInquireService={canWrite ? (serviceId) => router.push(inquireHref(serviceId)) : undefined}
        notice={
          error ? (
            <AppText color="danger" variant="caption">
              {error}
            </AppText>
          ) : null
        }
        actions={
          <>
            {canWrite ? (
              <Button
                label={link ? 'Remove from wedding' : 'Save to wedding'}
                variant={link ? 'secondary' : 'success'}
                loading={busy}
                onPress={() => void onToggleSave()}
              />
            ) : null}
            {canWrite ? (
              <Button label="Send inquiry" onPress={() => router.push(inquireHref())} />
            ) : (
              <AppText variant="caption" color="textMuted">
                Ask a wedding editor to save vendors or send inquiries.
              </AppText>
            )}
            {link ? <Badge label={`Saved · ${link.status}`} tone="success" /> : null}
          </>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  center: {
    textAlign: 'center',
  },
});
