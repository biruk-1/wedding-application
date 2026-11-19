import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { PermissionToggleList } from '@/features/team/components/PermissionToggleList';
import type { PermissionKey } from '@/features/team/permissions';
import {
  useMemberPermissions,
  useSetMemberPermissions,
  useTeamMembers,
  useWeddingAccess,
} from '@/features/team/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function PermissionEditorScreen() {
  const router = useRouter();
  const { weddingId, userId: memberUserId } = useLocalSearchParams<{
    weddingId: string;
    userId: string;
  }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/team/${memberUserId}`);
  const { isOwner, isLoading: accessLoading } = useWeddingAccess(weddingId);
  const membersQuery = useTeamMembers(weddingId);
  const permissionsQuery = useMemberPermissions(
    isOwner ? weddingId : undefined,
    isOwner ? memberUserId : undefined,
  );
  const save = useSetMemberPermissions(weddingId);

  const member = useMemo(
    () => (membersQuery.data ?? []).find((row) => row.user_id === memberUserId) ?? null,
    [membersQuery.data, memberUserId],
  );

  /** `null` means “use server snapshot until the owner edits”. */
  const [draft, setDraft] = useState<PermissionKey[] | null>(null);
  const selected = draft ?? permissionsQuery.data ?? [];
  const [formError, setFormError] = useState<string | null>(null);

  const header = <Header title="Edit permissions" showBack onBack={goBack} />;

  if (!weddingId || !memberUserId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing member.</AppText>
      </Screen>
    );
  }

  if (accessLoading || membersQuery.isPending || (isOwner && permissionsQuery.isPending)) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton fields={4} />
      </Screen>
    );
  }

  if (!isOwner) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <EmptyState
          icon="lock-closed-outline"
          title="Owners only"
          description="Only wedding owners can edit member permissions."
        />
      </Screen>
    );
  }

  if (!member || member.is_owner) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <EmptyState
          icon="shield-checkmark-outline"
          title="Cannot edit"
          description="Owners keep full access. Choose a non-owner collaborator."
        />
      </Screen>
    );
  }

  function onSave() {
    if (save.isPending || !member) return;
    setFormError(null);
    save.mutate(
      { memberUserId: member.user_id, permissions: selected },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: () => router.back(),
      },
    );
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      {header}

      <View style={styles.stack}>
        <AppText variant="body" color="textMuted">
          Access for {member.display_name}. Reserved owner powers are never grantable here. Budget
          stays off unless you turn it on.
        </AppText>

        <PermissionToggleList
          selected={selected}
          onChange={setDraft}
          disabled={save.isPending}
        />

        <AuthFormError message={formError} />
        <Button label="Save permissions" loading={save.isPending} onPress={onSave} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
});
