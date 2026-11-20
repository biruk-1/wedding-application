import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { VendorProfileSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { VendorProfileDetails } from '@/features/vendors/components/VendorProfileDetails';
import { usePublicVendorProfile } from '@/features/vendors/queries';
import {
  savePendingVendorAction,
  type PendingVendorActionKind,
} from '@/features/vendors/services/pendingVendorAction';
import { errorMessage } from '@/lib/query/queryError';
import { useColors } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';

/**
 * Public vendor profile. Browsing needs no account; saving or contacting the vendor keeps the
 * intended action, asks the guest to sign in, and resumes it inside the app afterwards.
 */
export function PublicVendorProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { session } = useAuth();
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const profile = usePublicVendorProfile(vendorId);
  const [pending, setPending] = useState<PendingVendorActionKind | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/explore-vendors' as Href);
  };

  async function startAction(kind: PendingVendorActionKind, serviceId: string | null = null) {
    if (!profile.data || pending) return;
    setPending(kind);
    await savePendingVendorAction({
      kind,
      vendorId: profile.data.id,
      vendorName: profile.data.business_name,
      serviceId,
    });
    setPending(null);
    router.push((session ? '/(app)/vendor-action' : '/login') as Href);
  }

  if (profile.isPending) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <VendorProfileSkeleton />
      </Screen>
    );
  }

  if (profile.error || !profile.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Vendor" showBack onBack={goBack} />
        <EmptyState
          icon="storefront-outline"
          title="Vendor unavailable"
          description={errorMessage(profile.error, 'This vendor is not available right now.')}
          action={<Button label="Retry" variant="secondary" onPress={() => void profile.refetch()} />}
        />
      </Screen>
    );
  }

  const vendor = profile.data;

  return (
    <Screen padded={false}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={profile.isRefetching}
            onRefresh={() => void profile.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }>
        <Header
          title={vendor.business_name}
          subtitle={vendor.categories.map((c) => c.name_en).join(' · ') || 'Vendor'}
          showBack
          onBack={goBack}
        />
        <VendorProfileDetails
          profile={vendor}
          onInquireService={(serviceId) => void startAction('inquire', serviceId)}
          actions={
            <>
              <Button
                label="Send inquiry"
                loading={pending === 'inquire'}
                onPress={() => void startAction('inquire')}
              />
              <Button
                label="Save to my plan"
                variant="success"
                loading={pending === 'save'}
                onPress={() => void startAction('save')}
              />
              {!session ? (
                <View style={styles.hint}>
                  <AppText variant="caption" color="textMuted" style={styles.center}>
                    Browsing is free. Saving or sending an inquiry needs an account — we will bring
                    you back here to finish.
                  </AppText>
                </View>
              ) : null}
            </>
          }
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  hint: {
    paddingHorizontal: spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
});
