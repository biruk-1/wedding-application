import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { PaymentStatusBadge } from '@/features/budget/components/PaymentStatusBadge';
import {
  useBudgetItem,
  useDeleteBudgetItem,
  useDeletePayment,
  useWeddingBudget,
} from '@/features/budget/queries';
import {
  itemDueAmount,
  itemOutstanding,
  paymentStatus,
  sumPayments,
} from '@/features/budget/utils/budgetHelpers';
import { formatMoney } from '@/features/budget/utils/money';
import { useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function ExpenseDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { weddingId, itemId } = useLocalSearchParams<{ weddingId: string; itemId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/budget/expenses`);
  const { canWrite } = useWeddingRole(weddingId);
  const budgetQuery = useWeddingBudget(weddingId);
  const itemQuery = useBudgetItem(weddingId, itemId);
  const remove = useDeleteBudgetItem(weddingId ?? '');
  const removePayment = useDeletePayment(weddingId ?? '', itemId ?? '');

  if (!weddingId || !itemId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing expense.</AppText>
      </Screen>
    );
  }

  const header = <Header title="Expense" showBack onBack={goBack} />;

  if (itemQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton />
      </Screen>
    );
  }

  if (!itemQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <AppText color="danger">{errorMessage(itemQuery.error)}</AppText>
        <Button label="Retry" onPress={() => void itemQuery.refetch()} />
      </Screen>
    );
  }

  const item = itemQuery.data;
  const currency = budgetQuery.data?.currency_code ?? 'ETB';
  const paid = sumPayments(item.payments);
  const due = itemDueAmount(item);
  const outstanding = itemOutstanding(due, paid);
  const status = paymentStatus(due, paid);

  function onDelete() {
    if (!canWrite || remove.isPending) return;
    Alert.alert('Delete expense?', 'Payments on this expense will also be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(itemId, {
            onSuccess: () => router.replace(`/(app)/weddings/${weddingId}/budget/expenses` as Href),
            onError: (error) => Alert.alert('Could not delete', errorMessage(error)),
          }),
      },
    ]);
  }

  function onDeletePayment(paymentId: string) {

    if (!canWrite || removePayment.isPending) return;
    Alert.alert('Remove payment?', 'This changes outstanding balances immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removePayment.mutate(paymentId, {
            onError: (error) => Alert.alert('Could not remove payment', errorMessage(error)),
          }),
      },
    ]);
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      {header}
      <RefreshNotice
        error={itemQuery.isRefetchError ? itemQuery.error : null}
        onRetry={() => void itemQuery.refetch()}
      />

      <View style={styles.stack}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <AppText variant="title" style={styles.title}>
              {item.label}
            </AppText>
            <PaymentStatusBadge status={status} />
          </View>
          <AppText variant="caption" color="textMuted">
            {item.category?.name_en ?? 'Uncategorized'}
          </AppText>
          {item.wedding_vendor?.vendor ? (
            <AppText variant="caption" color="primary">
              Vendor: {item.wedding_vendor.vendor.business_name}
            </AppText>
          ) : null}
          <View style={styles.metrics}>
            <Metric label="Planned" value={formatMoney(Number(item.estimated_amount), currency)} />
            <Metric
              label="Actual"
              value={
                item.committed_amount != null
                  ? formatMoney(Number(item.committed_amount), currency)
                  : 'Not set'
              }
            />
            <Metric label="Paid" value={formatMoney(paid, currency)} />
            <Metric label="Outstanding" value={formatMoney(outstanding, currency)} />
          </View>
          {item.notes ? (
            <AppText variant="body" color="textMuted">
              {item.notes}
            </AppText>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <AppText variant="label">Payments</AppText>
          {item.payments.length === 0 ? (
            <AppText color="textMuted">No payments recorded yet.</AppText>
          ) : (
            item.payments.map((payment) => (
              <View key={payment.id} style={styles.payment}>
                <View style={styles.paymentMain}>
                  <AppText variant="subtitle">{formatMoney(Number(payment.amount), currency)}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {new Date(payment.paid_at).toLocaleString()}
                    {payment.payment_method ? ` · ${payment.payment_method.replace('_', ' ')}` : ''}
                  </AppText>
                  {payment.reference ? (
                    <AppText variant="caption" color="textSubtle">
                      Ref: {payment.reference}
                    </AppText>
                  ) : null}
                </View>
                {canWrite ? (
                  <Button
                    label="Remove"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => onDeletePayment(payment.id)}
                  />
                ) : null}
              </View>
            ))
          )}
        </Card>

        <View style={styles.actions}>
          {canWrite && outstanding > 0 ? (
            <Button
              label="Record payment"
              onPress={() =>
                router.push(`/(app)/weddings/${weddingId}/budget/expenses/${itemId}/pay` as Href)
              }
            />
          ) : null}
          {canWrite ? (
            <>
              <Button
                label="Edit expense"
                variant="secondary"
                onPress={() =>
                  router.push(`/(app)/weddings/${weddingId}/budget/expenses/${itemId}/edit` as Href)
                }
              />
              <Button label="Delete expense" variant="secondary" loading={remove.isPending} onPress={onDelete} />
            </>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.metric}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="body" style={styles.metricValue}>
        {value}
      </AppText>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  stack: {
    gap: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.text,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metric: {
    width: '47%',
    gap: spacing.xxs,
  },
  metricValue: {
    fontVariant: ['tabular-nums'],
  },
  payment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  paymentMain: {
    flex: 1,
    gap: spacing.xxs,
  },
  actions: {
    gap: spacing.md,
  },
  });
}
