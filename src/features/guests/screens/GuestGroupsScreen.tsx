import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { Chip } from '@/features/guests/components/Chip';
import {
  useDeleteGuestGroup,
  useEnsureFamilyGuestGroups,
  useGuestGroups,
  useGuestSummaries,
  useSaveGuestGroup,
} from '@/features/guests/queries';
import type { GuestGroup } from '@/features/guests/types';
import { GUEST_SIDES, sideLabel } from '@/features/guests/utils/guestHelpers';
import { fieldErrorsFromZod, groupFormSchema } from '@/features/guests/validation/guestSchemas';
import { useWeddingAccess } from '@/features/team/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function GuestGroupsScreen() {
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/guests`);
  const { can, isOwner } = useWeddingAccess(weddingId);
  const canManageGroups = isOwner || can('guests.manage_all');

  const groupsQuery = useGuestGroups(weddingId);
  const summariesQuery = useGuestSummaries(weddingId);
  const save = useSaveGuestGroup(weddingId ?? '');
  const remove = useDeleteGuestGroup(weddingId ?? '');
  const ensureFamily = useEnsureFamilyGuestGroups(weddingId ?? '');

  const [editing, setEditing] = useState<GuestGroup | null>(null);
  const [name, setName] = useState('');
  const [side, setSide] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const memberCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const guest of summariesQuery.data ?? []) {
      if (guest.group_id) counts.set(guest.group_id, (counts.get(guest.group_id) ?? 0) + 1);
    }
    return counts;
  }, [summariesQuery.data]);

  function resetForm() {
    setEditing(null);
    setName('');
    setSide('');
    setNotes('');
    setFieldErrors({});
  }

  function startEdit(group: GuestGroup) {
    setEditing(group);
    setName(group.name);
    setSide(group.side ?? '');
    setNotes(group.notes ?? '');
    setFieldErrors({});
    setFormError(null);
  }

  function onSubmit() {
    if (save.isPending || !weddingId) return;
    setFormError(null);
    const parsed = groupFormSchema.safeParse({ name, side, notes });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    const values = {
      name: parsed.data.name,
      side: parsed.data.side ?? null,
      notes: parsed.data.notes ?? null,
    };
    save.mutate(editing ? { mode: 'edit', groupId: editing.id, values } : { mode: 'create', values }, {
      onError: (error) => setFormError(errorMessage(error)),
      onSuccess: resetForm,
    });
  }

  function onDelete(group: GuestGroup) {

    Alert.alert(
      `Delete "${group.name}"?`,
      'Guests stay on your list but lose this group. Invitations addressed only to this group are removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setFormError(null);
            remove.mutate(group.id, {
              onError: (error) => setFormError(errorMessage(error)),
              onSuccess: () => {
                if (editing?.id === group.id) resetForm();
              },
            });
          },
        },
      ],
    );
  }

  const header = <Header title="Guest groups" showBack onBack={goBack} />;

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (groupsQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton fields={2} />
      </Screen>
    );
  }

  if (groupsQuery.isError && !groupsQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.stack}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(groupsQuery.error)}
          </AppText>
          <Button label="Retry" loading={groupsQuery.isFetching} onPress={() => void groupsQuery.refetch()} />
        </View>
      </Screen>
    );
  }

  const groups = groupsQuery.data ?? [];

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      {header}
      <RefreshNotice
        error={groupsQuery.isRefetchError ? groupsQuery.error : null}
        onRetry={() => void groupsQuery.refetch()}
      />

      <View style={styles.stack}>
        {canManageGroups ? (
          <Button
            label="Create family groups"
            variant="secondary"
            loading={ensureFamily.isPending}
            onPress={() => {
              setFormError(null);
              ensureFamily.mutate(undefined, {
                onError: (error) => setFormError(errorMessage(error)),
              });
            }}
          />
        ) : null}

        {canManageGroups ? (
          <Card style={styles.card}>
            <AppText variant="label">{editing ? 'Edit group' : 'New group'}</AppText>
            <TextField
              label="Group name"
              placeholder="Family, college friends, coworkers"
              value={name}
              onChangeText={setName}
              error={fieldErrors.name}
              editable={!save.isPending}
            />
            <AppText variant="label">Side</AppText>
            <View style={styles.chips}>
              <Chip label="Not set" selected={!side} onPress={() => setSide('')} />
              {GUEST_SIDES.map((value) => (
                <Chip key={value} label={sideLabel(value)} selected={side === value} onPress={() => setSide(value)} />
              ))}
            </View>
            <TextField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              helperText="Optional"
              error={fieldErrors.notes}
              editable={!save.isPending}
            />
            <AuthFormError message={formError} />
            <Button label={editing ? 'Save group' : 'Create group'} loading={save.isPending} onPress={onSubmit} />
            {editing ? <Button label="Cancel editing" variant="secondary" onPress={resetForm} /> : null}
          </Card>
        ) : null}

        {groups.length === 0 ? (
          <EmptyState
            icon="people-circle-outline"
            title="No groups yet"
            description="Groups help you invite families or friends together and filter your guest list."
          />
        ) : (
          groups.map((group) => {
            const count = memberCounts.get(group.id) ?? 0;
            return (
              <Card key={group.id} style={styles.card}>
                <View style={styles.rowHeader}>
                  <AppText variant="bodyMedium" style={styles.groupName}>
                    {group.name}
                  </AppText>
                  <Badge label={`${count} guest${count === 1 ? '' : 's'}`} tone="neutral" />
                </View>
                {group.side ? (
                  <AppText variant="caption" color="textMuted">
                    {sideLabel(group.side)}
                  </AppText>
                ) : null}
                {group.notes ? (
                  <AppText variant="caption" color="textMuted">
                    {group.notes}
                  </AppText>
                ) : null}
                {canManageGroups ? (
                  <View style={styles.rowActions}>
                    <Button
                      label="Add guest"
                      variant="secondary"
                      fullWidth={false}
                      style={styles.small}
                      onPress={() =>
                        router.push(`/(app)/weddings/${weddingId}/guests/new?groupId=${group.id}` as Href)
                      }
                    />
                    <Button
                      label="Edit"
                      variant="secondary"
                      fullWidth={false}
                      style={styles.small}
                      onPress={() => startEdit(group)}
                    />
                    <Button
                      label="Delete"
                      variant="danger"
                      fullWidth={false}
                      style={styles.small}
                      loading={remove.isPending && remove.variables === group.id}
                      onPress={() => onDelete(group)}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  card: {
    gap: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  groupName: {
    flex: 1,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  small: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
});
