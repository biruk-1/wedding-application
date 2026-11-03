import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useUpdateWeddingBudget, useWeddingBudget } from '@/features/budget/queries';
import type { WeddingBudget } from '@/features/budget/types';
import {
  budgetTotalSchema,
  fieldErrorsFromZod,
} from '@/features/budget/validation/budgetSchemas';
import { useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function BudgetEditScreen() {
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/budget`);
  const budgetQuery = useWeddingBudget(weddingId);

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (budgetQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title="Edit budget" showBack onBack={goBack} />
        <FormSkeleton />
      </Screen>
    );
  }

  if (!budgetQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Edit budget" showBack onBack={goBack} />
        <AppText color="danger">{errorMessage(budgetQuery.error)}</AppText>
        <Button label="Retry" onPress={() => void budgetQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <BudgetEditForm
      key={`${budgetQuery.data.wedding_id}-${budgetQuery.data.updated_at}`}
      weddingId={weddingId}
      budget={budgetQuery.data}
      onBack={goBack}
    />
  );
}

function BudgetEditForm({
  weddingId,
  budget,
  onBack,
}: {
  weddingId: string;
  budget: WeddingBudget;
  onBack: () => void;
}) {
  const router = useRouter();
  const { canWrite } = useWeddingRole(weddingId);
  const save = useUpdateWeddingBudget(weddingId);
  const [totalBudget, setTotalBudget] = useState(String(budget.total_budget));
  const [currencyCode, setCurrencyCode] = useState(budget.currency_code);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function onSave() {

    if (!canWrite || save.isPending) return;
    setFormError(null);
    const parsed = budgetTotalSchema.safeParse({ totalBudget, currencyCode });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    save.mutate(
      { totalBudget: parsed.data.totalBudget, currencyCode: parsed.data.currencyCode },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: () => router.back(),
      },
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header title="Edit budget" showBack onBack={onBack} />
      <View style={styles.form}>
        <AppText variant="body" color="textMuted">
          This updates the wedding budget total. Planned and actual amounts come from expenses.
        </AppText>
        <TextField
          label="Total budget"
          value={totalBudget}
          onChangeText={setTotalBudget}
          keyboardType="decimal-pad"
          error={fieldErrors.totalBudget}
          editable={canWrite && !save.isPending}
        />
        <TextField
          label="Currency"
          value={currencyCode}
          onChangeText={setCurrencyCode}
          autoCapitalize="characters"
          maxLength={3}
          error={fieldErrors.currencyCode}
          editable={canWrite && !save.isPending}
          helperText="ISO code such as ETB. Do not mix currencies in one wedding."
        />
        {formError ? (
          <AppText color="danger" variant="body">
            {formError}
          </AppText>
        ) : null}
        {canWrite ? (
          <Button label="Save budget" loading={save.isPending} onPress={onSave} />
        ) : (
          <AppText color="textMuted">Viewers cannot edit the budget.</AppText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
});
