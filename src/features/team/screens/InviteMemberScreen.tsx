import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { Chip } from '@/features/guests/components/Chip';
import { useGuestGroups } from '@/features/guests/queries';
import { PermissionToggleList } from '@/features/team/components/PermissionToggleList';
import { RoleTemplatePicker } from '@/features/team/components/RoleTemplatePicker';
import type { InviteRoleTemplate } from '@/features/team/permissionLabels';
import type { PermissionKey } from '@/features/team/permissions';
import {
  useCreateTeamInvite,
  useRoleTemplatePermissions,
  useWeddingAccess,
} from '@/features/team/queries';
import {
  fieldErrorsFromZod,
  inviteExpiryOptions,
  inviteMemberSchema,
} from '@/features/team/validation/teamSchemas';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function InviteMemberScreen() {
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/team`);
  const { isOwner, isLoading: accessLoading } = useWeddingAccess(weddingId);
  const createInvite = useCreateTeamInvite(weddingId);
  const groupsQuery = useGuestGroups(weddingId);

  const [email, setEmail] = useState('');
  const [inviteKind, setInviteKind] = useState<'collaborator' | 'co_owner'>('collaborator');
  const [roleTemplate, setRoleTemplate] = useState<InviteRoleTemplate>('collaborator');
  const [expiresIn, setExpiresIn] = useState<(typeof inviteExpiryOptions)[number]>('7 days');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const templateQuery = useRoleTemplatePermissions(
    inviteKind === 'collaborator' ? roleTemplate : undefined,
  );
  const previewPermissions = useMemo(
    () => (templateQuery.data ?? []) as PermissionKey[],
    [templateQuery.data],
  );

  const header = <Header title="Invite member" showBack onBack={goBack} />;

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (accessLoading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
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
          description="Only wedding owners can invite people to the planning team."
        />
      </Screen>
    );
  }

  async function onSubmit() {
    if (createInvite.isPending || !weddingId) return;
    setFormError(null);
    const parsed = inviteMemberSchema.safeParse({
      email,
      inviteKind,
      roleTemplate,
      expiresIn,
      groupIds,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});

    try {
      const created = await createInvite.mutateAsync({
        email: parsed.data.email,
        inviteKind: parsed.data.inviteKind,
        roleTemplate:
          parsed.data.inviteKind === 'co_owner' ? 'owner' : parsed.data.roleTemplate,
        expiresIn: parsed.data.expiresIn,
        groupAssignments: parsed.data.groupIds.map((groupId) => ({ groupId })),
      });
      const link = Linking.createURL(`/join/${created.rawToken}`);
      setCreatedLink(link);
      const result = await Share.share({
        message: `Join the planning team: ${link}`,
      });
      if (result.action === Share.sharedAction) {
        router.back();
      }
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  function toggleGroup(groupId: string) {
    setGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      {header}

      <View style={styles.stack}>
        {createdLink ? (
          <Card style={styles.card}>
            <AppText variant="label">Invite link ready</AppText>
            <AppText variant="caption" color="textMuted">
              Share this link in WhatsApp, SMS, or mail. The invitee opens it, verifies their email
              with a one-time code (no password required), then joins. It only works for the invited
              email. Existing accounts can also join from Your weddings → Pending team invites.
            </AppText>
            <AppText variant="caption" selectable>
              {createdLink}
            </AppText>
            <Button
              label="Share link"
              onPress={() => void Share.share({ message: `Join the planning team: ${createdLink}` })}
            />
            <Button label="Done" variant="secondary" onPress={() => router.back()} />
          </Card>
        ) : (
          <>
            <Card style={styles.card}>
              <TextField
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                error={fieldErrors.email}
                editable={!createInvite.isPending}
              />

              <AppText variant="label">Invite as</AppText>
              <View style={styles.chips}>
                <Chip
                  label="Collaborator"
                  selected={inviteKind === 'collaborator'}
                  onPress={() => setInviteKind('collaborator')}
                  disabled={createInvite.isPending}
                />
                <Chip
                  label="Co-owner"
                  selected={inviteKind === 'co_owner'}
                  onPress={() => setInviteKind('co_owner')}
                  disabled={createInvite.isPending}
                />
              </View>
              {inviteKind === 'co_owner' ? (
                <AppText variant="caption" color="textMuted">
                  Co-owners have full access. A wedding can have at most two owners.
                </AppText>
              ) : (
                <>
                  <AppText variant="label">Role template</AppText>
                  <RoleTemplatePicker
                    value={roleTemplate}
                    onChange={setRoleTemplate}
                    disabled={createInvite.isPending}
                  />
                </>
              )}

              <AppText variant="label">Link expires</AppText>
              <View style={styles.chips}>
                {inviteExpiryOptions.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    selected={expiresIn === option}
                    onPress={() => setExpiresIn(option)}
                    disabled={createInvite.isPending}
                  />
                ))}
              </View>
            </Card>

            {inviteKind === 'collaborator' && roleTemplate === 'family_coordinator' ? (
              <Card style={styles.card}>
                <AppText variant="label">Guest groups to coordinate</AppText>
                <AppText variant="caption" color="textMuted">
                  Optional. They can manage guests in these groups after they join.
                </AppText>
                <View style={styles.chips}>
                  {(groupsQuery.data ?? []).map((group) => (
                    <Chip
                      key={group.id}
                      label={group.name}
                      selected={groupIds.includes(group.id)}
                      onPress={() => toggleGroup(group.id)}
                      disabled={createInvite.isPending}
                    />
                  ))}
                </View>
                {(groupsQuery.data ?? []).length === 0 ? (
                  <AppText variant="caption" color="textMuted">
                    Create guest groups first if you want to assign coordinators now.
                  </AppText>
                ) : null}
              </Card>
            ) : null}

            {inviteKind === 'collaborator' ? (
              <View style={styles.stack}>
                <AppText variant="label">Access preview</AppText>
                <AppText variant="caption" color="textMuted">
                  These permissions come with the selected template. You can fine-tune after they join.
                </AppText>
                <PermissionToggleList
                  selected={previewPermissions}
                  onChange={() => undefined}
                  disabled
                />
              </View>
            ) : null}

            <AuthFormError message={formError} />
            <Button
              label="Create & share invite"
              loading={createInvite.isPending}
              onPress={() => void onSubmit()}
            />
          </>
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
});
