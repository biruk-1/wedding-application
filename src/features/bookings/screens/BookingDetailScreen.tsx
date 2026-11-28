import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { usePayBooking, useWeddingBooking } from '@/features/bookings/queries';
import {
  bookingStatusLabel,
  paymentPurposeLabel,
  summarizeBookingPayments,
} from '@/features/bookings/utils/paymentHelpers';
import { formatMoney } from '@/features/budget/utils/money';
import { useWeddingAccess } from '@/features/team/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function BookingDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const { weddingId, bookingId } = useLocalSearchParams<{
    weddingId: string;
    bookingId: string;
  }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/bookings`);
  const bookingQuery = useWeddingBooking(weddingId, bookingId);
  const pay = usePayBooking(weddingId ?? '', bookingId ?? '');
  const { can } = useWeddingAccess(weddingId);
  const [payError, setPayError] = useState<string | null>(null);

  const canPay = can('budget.expenses.create') || can('vendors.manage');

  const onPay = useCallback(async () => {
    if (!weddingId || !bookingId || pay.isPending) return;
    setPayError(null);
    try {
      await pay.mutateAsync({
        returnUrl: `kiburan://weddings/${weddingId}/bookings/${bookingId}`,
      });
      await bookingQuery.refetch();
    } catch (error) {
      setPayError(errorMessage(error));
    }
  }, [bookingId, bookingQuery, pay, weddingId]);

  if (!weddingId || !bookingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing booking.</AppText>
      </Screen>
    );
  }

  if (bookingQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title="Booking" showBack onBack={goBack} />
        <FormSkeleton fields={6} />
      </Screen>
    );
  }

  if (!bookingQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Booking" showBack onBack={goBack} />
        <AppText color="danger">
          {errorMessage(bookingQuery.error) || 'Booking not found.'}
        </AppText>
      </Screen>
    );
  }

  const booking = bookingQuery.data;
  const vendorName = booking.wedding_vendor?.vendor?.business_name ?? 'Vendor';
  const hasSplit = Boolean(booking.wedding_vendor?.vendor?.chapa_subaccount_id);
  const summary = summarizeBookingPayments({
    totalAmount: booking.total_amount,
    depositAmount: booking.deposit_amount,
    payments: booking.payments ?? [],
  });
  const cancelled = booking.status === 'cancelled';
  const payLabel = summary.nextPurpose
    ? `Pay ${paymentPurposeLabel(summary.nextPurpose).toLowerCase()} · ${formatMoney(
        summary.nextAmount,
        booking.currency_code,
      )}`
    : 'Paid in full';

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header title="Booking" showBack onBack={goBack} />

      <View style={styles.card}>
        <AppText variant="caption" color="textMuted">
          Vendor
        </AppText>
        <AppText variant="subtitle" color="heading">
          {vendorName}
        </AppText>
        <AppText variant="caption" color="textMuted" style={styles.meta}>
          {bookingStatusLabel(booking.status)}
        </AppText>
      </View>

      <View style={styles.card}>
        <Row label="Total" value={formatMoney(booking.total_amount, booking.currency_code)} />
        {booking.deposit_amount != null ? (
          <Row
            label="Deposit required"
            value={formatMoney(booking.deposit_amount, booking.currency_code)}
          />
        ) : null}
        <Row label="Paid" value={formatMoney(summary.paidAmount, booking.currency_code)} />
        <Row
          label="Remaining"
          value={formatMoney(summary.remainingAmount, booking.currency_code)}
        />
      </View>

      <View style={styles.card}>
        <AppText variant="caption" color="textMuted" style={styles.sectionTitle}>
          Payment history
        </AppText>
        {(booking.payments ?? []).length === 0 ? (
          <AppText variant="body" color="textMuted">
            No Chapa payments yet.
          </AppText>
        ) : (
          (booking.payments ?? [])
            .slice()
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <View style={styles.rowText}>
                  <AppText variant="body" color="heading">
                    {paymentPurposeLabel(payment.purpose)}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {payment.status}
                    {payment.tx_ref ? ` · ${payment.tx_ref}` : ''}
                  </AppText>
                </View>
                <AppText variant="body" color="heading">
                  {formatMoney(payment.amount, payment.currency_code)}
                </AppText>
              </View>
            ))
        )}
      </View>

      {!hasSplit ? (
        <AppText variant="caption" color="textMuted" style={styles.note}>
          This vendor has not linked a Chapa payout account yet. Your payment still completes
          securely; Kiburan collects and settles to the vendor separately.
        </AppText>
      ) : (
        <AppText variant="caption" color="textMuted" style={styles.note}>
          Marketplace split is enabled for this vendor — deposit shares go to their Chapa
          subaccount automatically.
        </AppText>
      )}

      {payError ? (
        <AppText color="danger" style={styles.error}>
          {payError}
        </AppText>
      ) : null}

      {!cancelled && summary.nextPurpose && canPay ? (
        <Button label={payLabel} loading={pay.isPending} onPress={() => void onPay()} />
      ) : null}

      {!cancelled && summary.nextPurpose && !canPay ? (
        <AppText variant="caption" color="textMuted">
          You need budget payment permission to pay this booking.
        </AppText>
      ) : null}

      {summary.isFullyPaid ? (
        <AppText variant="body" color="success" style={styles.paidBanner}>
          This booking is paid in full. The payment is also recorded in your budget.
        </AppText>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.statRow}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="body" color="heading">
        {value}
      </AppText>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      gap: spacing.sm,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    meta: {
      marginTop: spacing.xs,
    },
    sectionTitle: {
      marginBottom: spacing.xs,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.md,
    },
    paymentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    note: {
      marginBottom: spacing.md,
    },
    error: {
      marginBottom: spacing.md,
    },
    paidBanner: {
      marginTop: spacing.md,
    },
  });
}
