import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { GuestStatusBadge } from '@/features/guests/components/GuestStatusBadge';
import type { GuestListItem, RsvpResponse } from '@/features/guests/types';
import { guestAvatarTone, guestInitials } from '@/features/guests/utils/guestAvatar';
import { guestTypeLabel } from '@/features/guests/utils/guestHelpers';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedShadows } from '@/theme/useThemedStyles';
import type { AppColors } from '@/theme/types';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

/** Memoized with id-based callbacks so one guest changing re-renders only that row. */
export const GuestRow = memo(function GuestRow({
  guest,
  rsvp,
  canWrite,
  onOpen,
  onEdit,
  onInvite,
}: {
  guest: GuestListItem;
  rsvp: RsvpResponse | null;
  canWrite: boolean;
  onOpen: (guestId: string) => void;
  onEdit: (guestId: string) => void;
  onInvite?: (guestId: string) => void;
}) {
  const colors = useColors();
  const shadows = useThemedShadows();
  const styles = useMemo(() => createStyles(colors, shadows.card), [colors, shadows.card]);
  const tone = guestAvatarTone(guest.id, colors);
  const partySize = guest.plus_one_allowed ? 2 : 1;
  const meta = [guest.group?.name, guest.guest_type ? guestTypeLabel(guest.guest_type) : null]
    .filter(Boolean)
    .join(' · ');

  function openMenu() {

    const buttons: {
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }[] = [
      { text: 'View details', onPress: () => onOpen(guest.id) },
      { text: 'Edit guest', onPress: () => onEdit(guest.id) },
    ];
    if (canWrite && onInvite) {
      buttons.push({ text: 'Send invitation', onPress: () => onInvite(guest.id) });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(guest.full_name, undefined, buttons);
  }

  return (
    <Pressable
      onPress={() => onOpen(guest.id)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={guest.full_name}>
      <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
        <AppText variant="label" style={{ color: tone.fg }}>
          {guestInitials(guest.full_name)}
        </AppText>
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText variant="bodyMedium" color="heading" numberOfLines={1} style={styles.name}>
            {guest.full_name}
          </AppText>
          {canWrite ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${guest.full_name}`}
              hitSlop={10}
              onPress={() => onEdit(guest.id)}
              style={({ pressed }) => [styles.editBtn, pressed && styles.editPressed]}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          {rsvp ? <GuestStatusBadge rsvp={rsvp} /> : null}
          {meta ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.meta}>
              {meta}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.count} accessibilityLabel={`${partySize} guest${partySize === 1 ? '' : 's'}`}>
        <Ionicons name="swap-vertical" size={14} color={colors.textMuted} />
        <AppText variant="caption" color="textMuted" style={styles.countValue}>
          {partySize}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More options for ${guest.full_name}`}
        hitSlop={10}
        onPress={openMenu}
        style={styles.more}>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
});

function createStyles(colors: AppColors, cardShadow: object) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    ...(cardShadow as object),
  },
  pressed: {
    opacity: 0.94,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    flexShrink: 1,
  },
  editBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  editPressed: {
    backgroundColor: colors.primaryMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  meta: {
    flexShrink: 1,
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 28,
  },
  countValue: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  more: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  });
}
