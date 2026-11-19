import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/layout/Screen';
import { WeddingTabBar, weddingTabBarInset } from '@/components/navigation/WeddingTabBar';
import { DashboardSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { formatMoney } from '@/features/budget/utils/money';
import { useBudgetDashboard } from '@/features/budget/queries';
import { useToggleTaskStatus, useWeddingTasks } from '@/features/checklist/queries';
import {
  computeChecklistProgress,
  tasksAssignedToUser,
} from '@/features/checklist/utils/taskHelpers';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useGuestSummaries, useInvitations } from '@/features/guests/queries';
import { summarizeInvitations } from '@/features/guests/utils/guestHelpers';
import { useWeddingAccess } from '@/features/team/queries';
import { getCelebrationCopy } from '@/features/weddings/celebrationCopy';
import { DashboardHero } from '@/features/weddings/components/DashboardHero';
import { DashboardHomeHeader } from '@/features/weddings/components/DashboardHomeHeader';
import {
  FeatureShortcutGrid,
  type FeatureShortcut,
} from '@/features/weddings/components/FeatureShortcutGrid';
import { UpcomingTaskCard } from '@/features/weddings/components/UpcomingTaskCard';
import { WeddingProgressCard } from '@/features/weddings/components/WeddingProgressCard';
import { useUploadWeddingCover, useWedding } from '@/features/weddings/queries';
import { useSavedVendorCount } from '@/features/weddings/queries/useSavedVendorCount';
import { getCountdownParts } from '@/features/weddings/utils/countdown';
import { markMilestone } from '@/lib/perf';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function WeddingDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const insets = useSafeAreaInsets();
  const weddingQuery = useWedding(weddingId);
  const wedding = weddingQuery.data;
  const { canWrite, can, isOwner, access } = useWeddingAccess(weddingId);
  const coverUpload = useUploadWeddingCover(weddingId);
  const tasksQuery = useWeddingTasks(weddingId);
  const budgetQuery = useBudgetDashboard(weddingId);
  const guestsQuery = useGuestSummaries(weddingId);
  const invitationsQuery = useInvitations(weddingId);
  const savedVendors = useSavedVendorCount(weddingId);
  const toggle = useToggleTaskStatus(weddingId ?? '');

  const handleEditCover = useCallback(() => {
    const copy = getCelebrationCopy(wedding?.celebration_kind);
    Alert.alert(copy.editDialogTitle, copy.editDialogBody, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: wedding?.cover_image_url ? 'Replace photo' : 'Choose photo',
        onPress: () => {
          void (async () => {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              Alert.alert(
                'Permission needed',
                'Allow photo library access to update your cover image.',
              );
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [3, 4],
              quality: 0.85,
            });
            if (result.canceled || !result.assets[0]) return;
            const asset = result.assets[0];
            coverUpload.mutate(
              { uri: asset.uri, mimeType: asset.mimeType },
              {
                onError: (error) => {
                  Alert.alert('Could not update cover', errorMessage(error));
                },
              },
            );
          })();
        },
      },
    ]);
  }, [coverUpload, wedding?.celebration_kind, wedding?.cover_image_url]);

  useEffect(() => {
    if (wedding) markMilestone('dashboard:first-usable');
  }, [wedding]);

  const progress = useMemo(
    () => computeChecklistProgress(tasksQuery.data ?? []),
    [tasksQuery.data],
  );
  const countdown = useMemo(
    () => (weddingQuery.data?.wedding_date ? getCountdownParts(weddingQuery.data.wedding_date) : null),
    [weddingQuery.data],
  );

  const yourTasks = useMemo(() => {
    const assigned = tasksAssignedToUser(tasksQuery.data ?? [], user?.id);
    return [...assigned]
      .sort((a, b) => {
        const ap = a.priority === 'urgent' || a.priority === 'high' ? 0 : 1;
        const bp = b.priority === 'urgent' || b.priority === 'high' ? 0 : 1;
        if (ap !== bp) return ap - bp;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 3);
  }, [tasksQuery.data, user]);

  const canToggleTask = useCallback(
    (taskId: string) => {
      if (can('tasks.update')) return true;
      const task = (tasksQuery.data ?? []).find((row) => row.id === taskId);
      return Boolean(user?.id && task?.assignees.some((a) => a.user_id === user.id));
    },
    [can, tasksQuery.data, user],
  );

  const inviteStats = useMemo(
    () => summarizeInvitations(invitationsQuery.data ?? []),
    [invitationsQuery.data],
  );
  const sentInvites = inviteStats.sent + inviteStats.delivered + inviteStats.opened;
  const guestTotal = guestsQuery.data?.length ?? 0;
  const budgetHint = budgetQuery.summary
    ? formatMoney(
        budgetQuery.summary.totalBudget,
        budgetQuery.summary.currencyCode,
      )
    : undefined;

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText variant="body" color="danger" style={styles.center}>
          Missing wedding id.
        </AppText>
      </Screen>
    );
  }

  if (weddingQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <DashboardSkeleton />
      </Screen>
    );
  }

  if (!wedding) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.centerBlock}>
          <AppText variant="body" color="danger" style={styles.center}>
            {weddingQuery.error ? errorMessage(weddingQuery.error) : 'Wedding unavailable.'}
          </AppText>
          <Button
            label="Retry"
            loading={weddingQuery.isFetching}
            onPress={() => void weddingQuery.refetch()}
          />
          <Button
            label="Back to home"
            variant="secondary"
            onPress={() => router.replace('/(app)' as Href)}
          />
        </View>
      </Screen>
    );
  }

  const copy = getCelebrationCopy(wedding.celebration_kind);
  const isWedding = copy.kind === 'wedding';
  const canSeeTeam = isOwner || can('team.view');
  const canSeeBudget = isOwner || can('budget.view');
  const canSeeTimeline = isOwner || can('timeline.view');
  const canSeeGuests =
    isOwner ||
    can('guests.view') ||
    can('guests.manage_all') ||
    (access?.coordinated_groups.length ?? 0) > 0;
  const canSeeTasks = isOwner || can('tasks.view');
  const canSendInvites = isOwner || can('guests.send_invitations');

  const shortcuts: FeatureShortcut[] = [
    {
      id: 'checklist',
      label: isWedding ? 'Checklist' : 'Tasks',
      sublabel: progress.total > 0 ? `${progress.completed}/${progress.total}` : 'Start',
      icon: 'checkbox-outline' as const,
      tone: 'green' as const,
      onPress: () => router.push(`/(app)/weddings/${wedding.id}/checklist` as Href),
      enabled: copy.capabilities.tasks && canSeeTasks,
    },
    {
      id: 'vendors',
      label: 'Vendors',
      sublabel: savedVendors.count > 0 ? `${savedVendors.count} saved` : 'Browse',
      icon: 'briefcase-outline' as const,
      tone: 'gold' as const,
      onPress: () => router.push(`/(app)/weddings/${wedding.id}/vendors` as Href),
      enabled: copy.capabilities.vendors,
    },
    {
      id: 'guests',
      label: 'Guest List',
      sublabel:
        guestTotal > 0
          ? isWedding
            ? `${guestTotal} invited`
            : `${guestTotal} guests`
          : 'Add',
      icon: 'people-outline' as const,
      tone: 'green' as const,
      onPress: () => router.push(`/(app)/weddings/${wedding.id}/guests` as Href),
      enabled: copy.capabilities.guests && canSeeGuests,
    },
    {
      id: 'budget',
      label: 'Budget',
      sublabel: budgetHint ?? 'Set up',
      icon: 'wallet-outline' as const,
      tone: 'gold' as const,
      onPress: () => router.push(`/(app)/weddings/${wedding.id}/budget` as Href),
      enabled: copy.capabilities.budget && canSeeBudget,
    },
    {
      id: 'invites',
      label: 'Invitations',
      sublabel: sentInvites > 0 ? `${sentInvites} sent` : 'Create',
      icon: 'mail-outline' as const,
      tone: 'wine' as const,
      onPress: () => router.push(`/(app)/weddings/${wedding.id}/guests/invite` as Href),
      enabled: copy.capabilities.invitations && canSendInvites,
    },
    {
      id: 'timeline',
      label: 'Schedule',
      sublabel: 'View',
      icon: 'calendar-outline' as const,
      tone: 'green' as const,
      onPress: () => router.push(`/(app)/weddings/${wedding.id}/timeline` as Href),
      enabled: copy.capabilities.timeline && canSeeTimeline,
    },
    {
      id: 'team',
      label: 'Team',
      sublabel: isOwner ? 'Invite' : 'Members',
      icon: 'people-circle-outline' as const,
      tone: 'wine' as const,
      onPress: () => router.push(`/(app)/weddings/${wedding.id}/team` as Href),
      enabled: canSeeTeam,
    },
  ].filter((shortcut) => shortcut.enabled);

  return (
    <View style={styles.root}>
      <Screen scroll contentStyle={{ paddingBottom: weddingTabBarInset(insets.bottom) }}>
        <StatusBar style="dark" />
        <DashboardHomeHeader
          onSettings={() => router.push(`/(app)/weddings/${wedding.id}/more` as Href)}
        />

        <RefreshNotice
          error={weddingQuery.isRefetchError ? weddingQuery.error : null}
          onRetry={() => void weddingQuery.refetch()}
        />

        <View style={styles.stack}>
          <DashboardHero
            celebrationKind={wedding.celebration_kind}
            title={wedding.title}
            partnerOne={wedding.partner_one_name}
            partnerTwo={wedding.partner_two_name}
            weddingDate={wedding.wedding_date}
            city={wedding.city}
            coverImageUrl={wedding.cover_image_url}
            greetingName={wedding.partner_one_name}
            onEdit={canWrite ? handleEditCover : undefined}
            editBusy={coverUpload.isPending}
          />

          <WeddingProgressCard
            progress={progress}
            daysLeft={countdown?.days ?? null}
            isPast={countdown?.isPast}
            label={copy.progressLabel}
          />

          <FeatureShortcutGrid items={shortcuts} />

          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <AppText variant="label" color="heading">
                Your tasks
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/(app)/weddings/${wedding.id}/checklist` as Href)}>
                <AppText variant="caption" color="primary" style={styles.viewAll}>
                  View All
                </AppText>
              </Pressable>
            </View>
            {yourTasks.length === 0 ? (
              <Card style={styles.emptyCard}>
                <AppText variant="body" color="textMuted">
                  Nothing assigned to you yet. Open the checklist to see every task.
                </AppText>
                <Button
                  label="Open checklist"
                  onPress={() => router.push(`/(app)/weddings/${wedding.id}/checklist` as Href)}
                />
              </Card>
            ) : (
              <View style={styles.taskList}>
                {yourTasks.map((task) => (
                  <UpcomingTaskCard
                    key={task.id}
                    task={task}
                    canWrite={canToggleTask(task.id)}
                    onOpen={(id) =>
                      router.push(`/(app)/weddings/${wedding.id}/checklist/${id}` as Href)
                    }
                    onToggleComplete={(id, done) =>
                      toggle.mutate({ taskId: id, status: done ? 'todo' : 'done' })
                    }
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </Screen>
      <View style={styles.tabBar}>
        <WeddingTabBar weddingId={weddingId} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stack: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewAll: {
    fontWeight: '600',
  },
  taskList: {
    gap: spacing.md,
  },
  emptyCard: {
    gap: spacing.md,
  },
  centerBlock: {
    gap: spacing.lg,
    marginTop: spacing['2xl'],
  },
  center: {
    textAlign: 'center',
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
