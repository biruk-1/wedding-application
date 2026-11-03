import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/layout/Screen';
import { WeddingTabBar, weddingTabBarInset } from '@/components/navigation/WeddingTabBar';
import { GuestsSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { GuestFilterBar } from '@/features/guests/components/GuestFilterBar';
import { GuestRow } from '@/features/guests/components/GuestRow';
import { GuestStatsHeader } from '@/features/guests/components/GuestStatsHeader';
import {
  useGuestGroups,
  useGuestList,
  useGuestRsvps,
  useGuestSummaries,
  useWeddingEvents,
} from '@/features/guests/queries';
import type { GuestListItem, GuestRsvpFilter } from '@/features/guests/types';
import {
  buildRsvpStatusMap,
  computeGuestStats,
  filterGuests,
} from '@/features/guests/utils/guestHelpers';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedShadows, useThemedStyles } from '@/theme/useThemedStyles';

const EMPTY_RSVPS: never[] = [];
const BOTTOM_BAR_HEIGHT = 64;

export function GuestsScreen() {
  const colors = useColors();
  const shadows = useThemedShadows();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, shadows), [shadows]);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabInset = weddingTabBarInset(insets.bottom);
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();

  const wedding = useWedding(weddingId);
  const { canWrite } = useWeddingRole(weddingId);

  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [rsvp, setRsvp] = useState<GuestRsvpFilter>('all');
  const [eventId, setEventId] = useState<string | null>(null);

  const list = useGuestList(weddingId, { query, groupId });
  const summariesQuery = useGuestSummaries(weddingId);
  const rsvpsQuery = useGuestRsvps(weddingId);
  const groupsQuery = useGuestGroups(weddingId);
  const eventsQuery = useWeddingEvents(weddingId);

  const rsvps = rsvpsQuery.data ?? EMPTY_RSVPS;
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const selectedEvent = events.find((event) => event.id === eventId) ?? null;

  const stats = useMemo(
    () => computeGuestStats({ guests: summariesQuery.data ?? [], rsvps, eventId: selectedEvent?.id ?? null }),
    [summariesQuery.data, rsvps, selectedEvent],
  );

  const statusById = useMemo(
    () => buildRsvpStatusMap(list.guests, rsvps, selectedEvent?.id ?? null),
    [list.guests, rsvps, selectedEvent],
  );

  const visible = useMemo(
    () => filterGuests(list.guests, rsvps, { rsvp, eventId: selectedEvent?.id ?? null }),
    [list.guests, rsvps, rsvp, selectedEvent],
  );

  const base = weddingId ? `/(app)/weddings/${weddingId}/guests` : '';

  const onOpenGuest = useCallback(
    (guestId: string) => router.push(`${base}/${guestId}` as Href),
    [router, base],
  );

  const onEditGuest = useCallback(
    (guestId: string) => router.push(`${base}/${guestId}/edit` as Href),
    [router, base],
  );

  const onInviteGuest = useCallback(
    (guestId: string) => router.push(`${base}/invite?guestId=${guestId}` as Href),
    [router, base],
  );

  const rsvpsReady = rsvpsQuery.isSuccess;
  const renderItem = useCallback(
    ({ item }: { item: GuestListItem }) => (
      <GuestRow
        guest={item}
        rsvp={rsvpsReady ? (statusById.get(item.id) ?? 'pending') : null}
        canWrite={canWrite}
        onOpen={onOpenGuest}
        onEdit={onEditGuest}
        onInvite={canWrite ? onInviteGuest : undefined}
      />
    ),
    [statusById, onOpenGuest, onEditGuest, onInviteGuest, rsvpsReady, canWrite],
  );

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (list.isLoading) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <ListHeader
          weddingTitle={wedding.data?.title}
          canWrite={false}
          onAdd={() => undefined}
          onGroups={() => undefined}
          onDesigns={() => undefined}
        />
        <GuestsSkeleton />
      </Screen>
    );
  }

  if (list.error) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <ListHeader
          weddingTitle={wedding.data?.title}
          canWrite={canWrite}
          onAdd={() => router.push(`${base}/new` as Href)}
          onGroups={() => router.push(`${base}/groups` as Href)}
          onDesigns={() => router.push(`${base}/designs` as Href)}
        />
        <View style={styles.block}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(list.error)}
          </AppText>
          <Button label="Retry" onPress={list.refresh} />
        </View>
      </Screen>
    );
  }

  const hasActiveFilters = Boolean(query.trim() || groupId || rsvp !== 'all');
  const listPadBottom = tabInset + BOTTOM_BAR_HEIGHT + spacing.lg;

  const listHeader = (
    <View>
      <ListHeader
        weddingTitle={wedding.data?.title}
        canWrite={canWrite}
        onAdd={() => router.push(`${base}/new` as Href)}
        onGroups={() => router.push(`${base}/groups` as Href)}
        onDesigns={() => router.push(`${base}/designs` as Href)}
      />
      <RefreshNotice
        isRefreshing={list.isUpdating && !list.isRefetching}
        error={list.refreshError}
        onRetry={list.refresh}
      />
      <GuestStatsHeader stats={stats} eventName={selectedEvent?.name ?? null} />
      <GuestFilterBar
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        groupId={groupId}
        onGroupChange={setGroupId}
        rsvp={rsvp}
        onRsvpChange={setRsvp}
        events={events}
        eventId={eventId}
        onEventChange={setEventId}
        stats={stats}
      />
      {rsvp !== 'all' && list.hasNextPage ? (
        <AppText variant="caption" color="textMuted" style={styles.filterNote}>
          RSVP filter applies to the guests loaded so far. Load more to include everyone.
        </AppText>
      ) : null}
    </View>
  );

  const emptyState = !hasActiveFilters ? (
    <View style={styles.empty}>
      <AppText variant="subtitle" style={styles.center}>
        No guests yet
      </AppText>
      <AppText color="textMuted" style={styles.center}>
        Add the people you want to invite. You can organise them into groups and track RSVPs per event.
      </AppText>
      {canWrite ? (
        <Button label="Add your first guest" onPress={() => router.push(`${base}/new` as Href)} />
      ) : (
        <AppText variant="caption" color="textMuted" style={styles.center}>
          Viewers can browse guests once writers add them.
        </AppText>
      )}
    </View>
  ) : (
    <AppText color="textMuted" style={[styles.center, styles.noMatch]}>
      No guests match these filters.
    </AppText>
  );

  const footer = list.hasNextPage ? (
    <View style={styles.footer}>
      {list.nextPageError ? (
        <AppText variant="caption" color="danger" style={styles.center}>
          {errorMessage(list.nextPageError)}
        </AppText>
      ) : null}
      <Button
        label="Load more guests"
        variant="secondary"
        loading={list.isFetchingNextPage}
        onPress={list.fetchNextPage}
      />
    </View>
  ) : (
    <View style={styles.footerSpace} />
  );

  return (
    <View style={styles.root}>
      <Screen padded={false}>
        <StatusBar style="dark" />
        <FlatList
          data={visible}
          keyExtractor={(guest) => guest.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyState}
          ListFooterComponent={footer}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={[styles.content, { paddingBottom: listPadBottom }]}
          keyboardShouldPersistTaps="handled"
          onEndReached={list.fetchNextPage}
          onEndReachedThreshold={0.4}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching}
              onRefresh={list.refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      </Screen>

      <View style={[styles.bottomActions, { bottom: tabInset }]}>
        <BottomAction
          icon="people-outline"
          label="Groups"
          onPress={() => router.push(`${base}/groups` as Href)}
        />
        <BottomAction
          icon="grid-outline"
          label="Seating"
          onPress={() => router.push(`${base}/seating` as Href)}
        />
        <BottomAction
          icon="analytics-outline"
          label="Tracking"
          onPress={() => router.push(`${base}/tracking` as Href)}
        />
        {canWrite ? (
          <BottomAction
            icon="mail-outline"
            label="Invite"
            primary
            onPress={() => router.push(`${base}/invite` as Href)}
          />
        ) : (
          <BottomAction
            icon="color-palette-outline"
            label="Designs"
            onPress={() => router.push(`${base}/designs` as Href)}
          />
        )}
      </View>

      <View style={styles.tabBar}>
        <WeddingTabBar weddingId={weddingId} />
      </View>
    </View>
  );
}

function ListHeader({
  weddingTitle,
  canWrite,
  onAdd,
  onGroups,
  onDesigns,
}: {
  weddingTitle?: string;
  canWrite: boolean;
  onAdd: () => void;
  onGroups: () => void;
  onDesigns: () => void;
}) {
  const colors = useColors();
  const shadows = useThemedShadows();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, shadows), [shadows]);

  return (
    <View style={styles.header}>
      <View style={styles.headerTitles}>
        <AppText variant="title" color="heading">
          Guest List
        </AppText>
        {weddingTitle ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {weddingTitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage groups"
          hitSlop={8}
          onPress={onGroups}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
          <Ionicons name="people-outline" size={22} color={colors.heading} />
        </Pressable>
        {canWrite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invitation designs"
            hitSlop={8}
            onPress={onDesigns}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
            <Ionicons name="color-palette-outline" size={20} color={colors.heading} />
          </Pressable>
        ) : null}
        {canWrite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add guest"
            onPress={onAdd}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}>
            <Ionicons name="add" size={18} color={colors.onPrimary} />
            <AppText variant="caption" style={styles.addLabel}>
              Add Guest
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function BottomAction({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const colors = useColors();
  const shadows = useThemedShadows();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, shadows), [shadows]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bottomBtn,
        primary && styles.bottomBtnPrimary,
        pressed && (primary ? styles.bottomBtnPrimaryPressed : styles.bottomBtnPressed),
      ]}>
      <Ionicons name={icon} size={18} color={primary ? colors.onPrimary : colors.heading} />
      <AppText
        variant="caption"
        style={[styles.bottomLabel, primary && styles.bottomLabelPrimary]}
        numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Separator() {
  const shadows = useThemedShadows();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, shadows), [shadows]);
  return <View style={styles.separator} />;
}

function createStyles(colors: AppColors, shadows: ReturnType<typeof useThemedShadows>) {
  return StyleSheet.create({
  root: {
    flex: 1,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerTitles: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtnPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.lg,
    minHeight: 40,
  },
  addBtnPressed: {
    backgroundColor: colors.primaryPressed,
  },
  addLabel: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  block: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  filterNote: {
    marginBottom: spacing.md,
  },
  empty: {
    gap: spacing.lg,
    paddingVertical: spacing['2xl'],
  },
  noMatch: {
    paddingVertical: spacing.xl,
  },
  separator: {
    height: spacing.md,
  },
  footer: {
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing['2xl'],
  },
  footerSpace: {
    height: spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
  bottomActions: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.soft,
  },
  bottomBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    minHeight: 48,
  },
  bottomBtnPrimary: {
    backgroundColor: colors.primary,
  },
  bottomBtnPressed: {
    backgroundColor: colors.border,
  },
  bottomBtnPrimaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  bottomLabel: {
    color: colors.heading,
    fontWeight: '600',
    fontSize: 11,
  },
  bottomLabelPrimary: {
    color: colors.onPrimary,
  },
  });
}
