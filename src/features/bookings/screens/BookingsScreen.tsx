import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { ExpenseListSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { useWeddingBookings } from '@/features/bookings/queries';
import type { BookingListItem } from '@/features/bookings/types';
import {
  bookingStatusLabel,
  summarizeBookingPayments,
} from '@/features/bookings/utils/paymentHelpers';
import { formatMoney } from '@/features/budget/utils/money';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function BookingsScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/vendors`);
  const bookingsQuery = useWeddingBookings(weddingId);

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <Header title="Bookings" showBack onBack={goBack} />
      <AppText variant="caption" color="textMuted" style={styles.hint}>
        Pay deposits and balances securely with Chapa (Telebirr, bank, card).
      </AppText>

      {bookingsQuery.isPending ? (
        <ExpenseListSkeleton rows={4} />
      ) : bookingsQuery.error ? (
        <AppText color="danger">{errorMessage(bookingsQuery.error)}</AppText>
      ) : (
        <FlatList
          data={bookingsQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={bookingsQuery.isRefetching}
              onRefresh={() => void bookingsQuery.refetch()}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No bookings yet"
              description="Accept a vendor quote to create a booking you can pay here."
            />
          }
          renderItem={({ item }) => (
            <BookingRow
              booking={item}
              onPress={() =>
                router.push(`/(app)/weddings/${weddingId}/bookings/${item.id}` as Href)
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

function BookingRow({
  booking,
  onPress,
}: {
  booking: BookingListItem;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const vendorName = booking.wedding_vendor?.vendor?.business_name ?? 'Vendor';
  const summary = summarizeBookingPayments({
    totalAmount: booking.total_amount,
    depositAmount: booking.deposit_amount,
    payments: booking.payments ?? [],
  });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <AppText variant="body" color="heading" numberOfLines={1}>
          {vendorName}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {bookingStatusLabel(booking.status)}
          {summary.isFullyPaid
            ? ' · Paid'
            : summary.paidAmount > 0
              ? ` · Paid ${formatMoney(summary.paidAmount, booking.currency_code)}`
              : ''}
        </AppText>
      </View>
      <AppText variant="body" color="heading" style={styles.amount}>
        {formatMoney(booking.total_amount, booking.currency_code)}
      </AppText>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    hint: {
      marginBottom: spacing.md,
    },
    list: {
      paddingBottom: spacing['2xl'],
      gap: spacing.sm,
      flexGrow: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    pressed: {
      opacity: 0.92,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    amount: {
      fontWeight: '600',
    },
  });
}
