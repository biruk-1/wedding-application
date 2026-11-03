import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { TextField } from '@/components/ui/TextField';
import { todayIsoDate } from '@/lib/datetime/localDate';
import { useBudgetItem, useRecordPayment, useWeddingBudget } from '@/features/budget/queries';
import { PAYMENT_METHODS, type PaymentMethod } from '@/features/budget/types';
import {
  itemDueAmount,
  itemOutstanding,
  sumPayments,
} from '@/features/budget/utils/budgetHelpers';
import { formatMoney } from '@/features/budget/utils/money';
import {
  fieldErrorsFromZod,
  paymentFormSchema,
} from '@/features/budget/validation/budgetSchemas';
import { useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function PaymentFormScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { weddingId, itemId } = useLocalSearchParams<{ weddingId: string; itemId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/budget/expenses/${itemId}`);
  const { canWrite } = useWeddingRole(weddingId);
  const budgetQuery = useWeddingBudget(weddingId);
  const itemQuery = useBudgetItem(weddingId, itemId);
  const record = useRecordPayment(weddingId ?? '', itemId ?? '');

  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(todayIsoDate());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const outstanding = useMemo(() => {
    if (!itemQuery.data) return 0;
    return itemOutstanding(itemDueAmount(itemQuery.data), sumPayments(itemQuery.data.payments));
  }, [itemQuery.data]);

  if (!weddingId || !itemId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing expense.</AppText>
      </Screen>
    );
  }

  if (itemQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title="Record payment" showBack onBack={goBack} />
        <FormSkeleton />
      </Screen>
    );
  }

  if (!itemQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Record payment" showBack onBack={goBack} />
        <AppText color="danger">{errorMessage(itemQuery.error)}</AppText>
      </Screen>
    );
  }

  const currency = budgetQuery.data?.currency_code ?? 'ETB';

  function onSubmit() {

    if (!canWrite || record.isPending) return;
    setFormError(null);
    const parsed = paymentFormSchema.safeParse({
      amount,
      paidAt,
      paymentMethod,
      reference,
      notes,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    if (parsed.data.amount > outstanding) {
      setFieldErrors({
        amount: `Cannot exceed outstanding ${formatMoney(outstanding, currency)}`,
      });
      return;
    }
    setFieldErrors({});
    const paidAtIso = paidAt.includes('T') ? paidAt : `${paidAt}T12:00:00.000Z`;
    record.mutate(
      {
        amount: parsed.data.amount,
        paidAt: paidAtIso,
        paymentMethod: parsed.data.paymentMethod ?? null,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
      },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: () => router.back(),
      },
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header title="Record payment" showBack onBack={goBack} />
      <View style={styles.form}>
        <AppText variant="body" color="textMuted">
          Outstanding on {itemQuery.data.label}: {formatMoney(outstanding, currency)}. This records
          tracking only — it does not charge a card or mobile money account.
        </AppText>
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          error={fieldErrors.amount}
          editable={canWrite && !record.isPending}
        />
        <AppDatePicker
          label="Payment date"
          value={paidAt}
          onChange={setPaidAt}
          error={fieldErrors.paidAt}
          disabled={!canWrite || record.isPending}
        />
        <AppText variant="label">Method</AppText>
        <View style={styles.chips}>
          {PAYMENT_METHODS.map((method) => (
            <Pressable
              key={method}
              onPress={() => setPaymentMethod(method)}
              style={[styles.chip, paymentMethod === method && styles.chipActive]}>
              <AppText variant="caption" color={paymentMethod === method ? 'onSuccess' : 'text'}>
                {method.replace('_', ' ')}
              </AppText>
            </Pressable>
          ))}
        </View>
        <TextField
          label="Reference"
          value={reference}
          onChangeText={setReference}
          error={fieldErrors.reference}
          editable={canWrite && !record.isPending}
        />
        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          error={fieldErrors.notes}
          editable={canWrite && !record.isPending}
        />
        {formError ? <AppText color="danger">{formError}</AppText> : null}
        {canWrite ? (
          <Button label="Save payment" loading={record.isPending} onPress={onSubmit} />
        ) : (
          <AppText color="textMuted">Viewers cannot record payments.</AppText>
        )}
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  form: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  });
}
