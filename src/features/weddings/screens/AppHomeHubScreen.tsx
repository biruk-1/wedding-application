import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { WeddingListSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { useMyPendingTeamInvites } from '@/features/team/queries';
import {
  loadPendingVendorAction,
  peekPendingVendorAction,
} from '@/features/vendors/services/pendingVendorAction';
import { normalizeCelebrationKind } from '@/features/weddings/celebrationCopy';
import { useMyWeddings } from '@/features/weddings/hooks/useMyWeddings';
import { resolveAppHomeDestination } from '@/features/weddings/navigation/resolveAppHomeDestination';
import { spacing } from '@/theme/spacing';

/**
 * Authenticated entry: create/onboarding (0), dashboard (1), or selector (many / pending invites).
 * No intermediate “Welcome to Kiburan” screen — destinations are replace()-navigated once.
 */
export function AppHomeHubScreen() {
  const router = useRouter();
  const { memberships, isLoading, error, refresh } = useMyWeddings();
  const pendingQuery = useMyPendingTeamInvites();
  const singleId = memberships.length === 1 ? memberships[0]?.wedding_id ?? null : null;
  const pendingLoading = pendingQuery.isLoading;
  const pendingCount = pendingQuery.data?.length ?? 0;
  const membershipCount = memberships.length;
  const includesOtherCelebrations = memberships.some(
    ({ wedding }) => normalizeCelebrationKind(wedding.celebration_kind) !== 'wedding',
  );
  const [hasVendorAction, setHasVendorAction] = useState<boolean | null>(
    peekPendingVendorAction() ? true : null,
  );

  useEffect(() => {
    let cancelled = false;
    void loadPendingVendorAction().then((action) => {
      if (!cancelled) setHasVendorAction(Boolean(action));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const vendorActionLoading = hasVendorAction === null;
  const ready = !isLoading && !pendingLoading && !error && !vendorActionLoading;
  const destination = ready
    ? resolveAppHomeDestination({
        membershipCount,
        singleWeddingId: singleId,
        pendingInviteCount: pendingCount,
        hasPendingVendorAction: Boolean(hasVendorAction),
      })
    : null;

  useEffect(() => {
    if (!ready) return;
    const next = resolveAppHomeDestination({
      membershipCount,
      singleWeddingId: singleId,
      pendingInviteCount: pendingCount,
      hasPendingVendorAction: Boolean(hasVendorAction),
    });
    if (next.type === 'vendor-action') {
      router.replace('/(app)/vendor-action' as Href);
      return;
    }
    if (next.type === 'wedding') {
      router.replace(`/(app)/weddings/${next.weddingId}` as Href);
      return;
    }
    if (next.type === 'selector') {
      router.replace('/(app)/weddings' as Href);
      return;
    }
    if (next.type === 'create') {
      router.replace('/(app)/create-wedding' as Href);
    }
  }, [ready, membershipCount, singleId, pendingCount, hasVendorAction, router]);

  if (isLoading || pendingLoading || vendorActionLoading || (destination && destination.type !== 'stay-chooser')) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <WeddingListSkeleton />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <AppText variant="title" style={styles.title}>
            {"Couldn't load weddings"}
          </AppText>
          <AppText variant="body" color="textMuted" style={styles.copy}>
            {error.message}
          </AppText>
          <Button label="Retry" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.center}>
        <AppText variant="title" style={styles.title}>
          {includesOtherCelebrations ? 'Choose a celebration' : 'Choose a wedding'}
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.copy}>
          You belong to {memberships.length}{' '}
          {includesOtherCelebrations ? 'celebrations' : 'weddings'}.
        </AppText>
        <Button
          label={includesOtherCelebrations ? 'View celebrations' : 'View weddings'}
          onPress={() => router.push('/(app)/weddings' as Href)}
        />
        <Button
          label="Create another"
          variant="secondary"
          onPress={() => router.push('/(app)/create-wedding' as Href)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: {
    textAlign: 'center',
  },
  copy: {
    textAlign: 'center',
  },
});
