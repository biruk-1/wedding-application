import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { WeddingListSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useMyPendingTeamInvites } from '@/features/team/queries';
import {
  resolveVendorActionStep,
  vendorActionHref,
} from '@/features/vendors/navigation/resolveVendorActionStep';
import {
  clearPendingVendorAction,
  loadPendingVendorAction,
  type PendingVendorAction,
} from '@/features/vendors/services/pendingVendorAction';
import { canWriteWedding, saveVendorToWedding } from '@/features/vendors/services/vendorService';
import { useMyWeddings } from '@/features/weddings/hooks/useMyWeddings';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

type RunOutcome =
  | { type: 'done' }
  | { type: 'skipped' }
  | { type: 'read-only'; weddingId: string }
  | { type: 'failed'; message: string };

/**
 * Finishes a vendor action a guest started on Explore: picks the celebration (or sends the user
 * to create one first), then opens the inquiry form or saves the vendor. The stored action is
 * cleared before acting, so it never runs twice.
 */
export function VendorActionResumeScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { weddingId: requestedWeddingId } = useLocalSearchParams<{ weddingId?: string }>();
  const { memberships, isLoading, error: weddingsError, refresh } = useMyWeddings();
  const pendingInvites = useMyPendingTeamInvites();
  const [action, setAction] = useState<PendingVendorAction | null | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [readOnlyWeddingId, setReadOnlyWeddingId] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadPendingVendorAction().then((loaded) => {
      if (!cancelled) setAction(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(
    async (weddingId: string): Promise<RunOutcome> => {
      if (!action || started.current) return { type: 'skipped' };
      started.current = true;

      if (!(await canWriteWedding(weddingId))) {
        await clearPendingVendorAction();
        return { type: 'read-only', weddingId };
      }

      if (action.kind === 'save') {
        const saved = await saveVendorToWedding({ weddingId, vendorId: action.vendorId });
        if (!saved.ok) {
          started.current = false;
          return { type: 'failed', message: saved.error.message };
        }
      }

      await clearPendingVendorAction();
      router.replace(vendorActionHref(action, weddingId) as Href);
      return { type: 'done' };
    },
    [action, router],
  );

  const applyOutcome = useCallback((outcome: RunOutcome) => {
    if (outcome.type === 'read-only') {
      setRunning(false);
      setReadOnlyWeddingId(outcome.weddingId);
      setMessage(
        'You have view-only access to this celebration. Ask an owner or editor to save vendors or send inquiries.',
      );
    } else if (outcome.type === 'failed') {
      setRunning(false);
      setMessage(outcome.message);
    }
  }, []);

  function runFromPress(weddingId: string) {
    if (started.current) return;
    setRunning(true);
    setMessage(null);
    void run(weddingId).then(applyOutcome);
  }

  const ready = action !== undefined && !isLoading && !pendingInvites.isLoading && !weddingsError;
  const step = ready
    ? resolveVendorActionStep({
        hasAction: Boolean(action),
        membershipIds: memberships.map((m) => m.wedding_id),
        pendingInviteCount: pendingInvites.data?.length ?? 0,
        requestedWeddingId,
      })
    : null;
  const stepType = step?.type ?? null;
  const stepWeddingId = step?.type === 'run' ? step.weddingId : null;

  useEffect(() => {
    if (stepType === 'none') {
      router.replace('/(app)' as Href);
    } else if (stepType === 'create') {
      router.replace('/(app)/create-wedding' as Href);
    } else if (stepType === 'run' && stepWeddingId) {
      void run(stepWeddingId).then(applyOutcome);
    }
  }, [stepType, stepWeddingId, run, applyOutcome, router]);

  async function cancel() {
    await clearPendingVendorAction();
    router.replace('/(app)' as Href);
  }

  const vendorName = action?.vendorName || 'this vendor';
  const verb = action?.kind === 'save' ? 'save' : 'contact';

  if (weddingsError) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <AppText variant="body" color="danger" style={styles.copy}>
            {weddingsError.message}
          </AppText>
          <Button label="Retry" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  if (message) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title={action?.vendorName || 'Vendor'} />
        <View style={styles.stack}>
          <AppText variant="body" color={readOnlyWeddingId ? 'textMuted' : 'danger'}>
            {message}
          </AppText>
          {readOnlyWeddingId && action ? (
            <Button
              label="View vendor"
              onPress={() =>
                router.replace(
                  `/(app)/weddings/${readOnlyWeddingId}/vendors/${action.vendorId}` as Href,
                )
              }
            />
          ) : stepWeddingId ? (
            <Button label="Try again" loading={running} onPress={() => runFromPress(stepWeddingId)} />
          ) : null}
          <Button label="Go to dashboard" variant="secondary" onPress={() => void cancel()} />
        </View>
      </Screen>
    );
  }

  if (stepType === 'choose' && !running) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title="Choose a celebration" subtitle={`Where should we ${verb} ${vendorName}?`} />
        <View style={styles.stack}>
          {memberships.map((membership) => (
            <Pressable
              key={membership.wedding_id}
              accessibilityRole="button"
              onPress={() => runFromPress(membership.wedding_id)}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
              <AppText variant="bodyMedium" color="heading">
                {membership.wedding.title}
              </AppText>
              {membership.wedding.wedding_date ? (
                <AppText variant="caption" color="textMuted">
                  {new Date(membership.wedding.wedding_date).toLocaleDateString()}
                </AppText>
              ) : null}
            </Pressable>
          ))}
          <Button label="Cancel" variant="secondary" onPress={() => void cancel()} />
        </View>
      </Screen>
    );
  }

  if (stepType === 'create-or-invites') {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="One more step" subtitle={`To ${verb} ${vendorName}, add it to a celebration.`} />
        <View style={styles.stack}>
          <Button
            label="Create a celebration"
            onPress={() => router.replace('/(app)/create-wedding' as Href)}
          />
          <Button
            label="Review my invitations"
            variant="secondary"
            onPress={() => router.replace('/(app)/weddings' as Href)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <WeddingListSkeleton />
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    center: {
      flex: 1,
      justifyContent: 'center',
      gap: spacing.lg,
    },
    copy: {
      textAlign: 'center',
    },
    stack: {
      gap: spacing.md,
    },
    option: {
      gap: spacing.xs,
      padding: spacing.lg,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    optionPressed: {
      opacity: 0.9,
    },
  });
}
