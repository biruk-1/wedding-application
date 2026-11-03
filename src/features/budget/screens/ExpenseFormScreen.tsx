import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import {
  useBudgetCategories,
  useBudgetItem,
  useBudgetVendorOptions,
  useSaveBudgetItem,
} from '@/features/budget/queries';
import type { BudgetItemWithRelations } from '@/features/budget/types';
import {
  expenseFormSchema,
  fieldErrorsFromZod,
} from '@/features/budget/validation/budgetSchemas';
import { useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function ExpenseFormScreen({ mode }: { mode: 'create' | 'edit' }) {

  const { weddingId, itemId } = useLocalSearchParams<{ weddingId: string; itemId?: string }>();
  const goBack = useBackTo(
    mode === 'edit'
      ? `/(app)/weddings/${weddingId}/budget/expenses/${itemId}`
      : `/(app)/weddings/${weddingId}/budget/expenses`,
  );
  const itemQuery = useBudgetItem(weddingId, mode === 'edit' ? itemId : undefined);
  const title = mode === 'create' ? 'Add expense' : 'Edit expense';

  if (!weddingId || (mode === 'edit' && !itemId)) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing expense.</AppText>
      </Screen>
    );
  }

  if (mode === 'edit' && itemQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title={title} showBack onBack={goBack} />
        <FormSkeleton />
      </Screen>
    );
  }

  if (mode === 'edit' && !itemQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title={title} showBack onBack={goBack} />
        <AppText color="danger">{errorMessage(itemQuery.error)}</AppText>
        <Button label="Retry" onPress={() => void itemQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <ExpenseForm
      key={itemQuery.data?.id ?? 'new'}
      mode={mode}
      weddingId={weddingId}
      item={mode === 'edit' ? itemQuery.data : undefined}
      title={title}
      onBack={goBack}
    />
  );
}

function ExpenseForm({
  mode,
  weddingId,
  item,
  title,
  onBack,
}: {
  mode: 'create' | 'edit';
  weddingId: string;
  item?: BudgetItemWithRelations;
  title: string;
  onBack: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { canWrite } = useWeddingRole(weddingId);
  const categoriesQuery = useBudgetCategories();
  const vendorsQuery = useBudgetVendorOptions(weddingId);
  const save = useSaveBudgetItem(weddingId);

  const [label, setLabel] = useState(item?.label ?? '');
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '');
  const [estimatedAmount, setEstimatedAmount] = useState(
    item ? String(item.estimated_amount) : '',
  );
  const [committedAmount, setCommittedAmount] = useState(
    item?.committed_amount != null ? String(item.committed_amount) : '',
  );
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [weddingVendorId, setWeddingVendorId] = useState(item?.wedding_vendor_id ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit() {

    if (!canWrite || save.isPending) return;
    setFormError(null);
    const parsed = expenseFormSchema.safeParse({
      label,
      categoryId,
      estimatedAmount,
      committedAmount,
      notes,
      weddingVendorId,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    const values = {
      label: parsed.data.label,
      categoryId: parsed.data.categoryId,
      estimatedAmount: parsed.data.estimatedAmount,
      committedAmount: parsed.data.committedAmount,
      notes: parsed.data.notes,
      weddingVendorId: parsed.data.weddingVendorId,
    };
    save.mutate(
      mode === 'create' ? { mode: 'create', values } : { mode: 'edit', itemId: item!.id, values },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: (saved) => {
          if (mode === 'create') {
            router.replace(`/(app)/weddings/${weddingId}/budget/expenses/${saved.id}`);
          } else {
            router.back();
          }
        },
      },
    );
  }

  const categories = categoriesQuery.data ?? [];
  const vendors = vendorsQuery.data ?? [];
  const submitting = save.isPending;

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header title={title} showBack onBack={onBack} />
      <View style={styles.form}>
        <TextField
          label="Name"
          value={label}
          onChangeText={setLabel}
          error={fieldErrors.label}
          editable={canWrite && !submitting}
        />
        <AppText variant="label">Category</AppText>
        <View style={styles.chips}>
          <Chip
            label="None"
            active={!categoryId}
            onPress={() => setCategoryId('')}
            disabled={!canWrite || submitting}
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name_en}
              active={categoryId === category.id}
              onPress={() => setCategoryId(category.id)}
              disabled={!canWrite || submitting}
            />
          ))}
        </View>
        <TextField
          label="Planned amount"
          value={estimatedAmount}
          onChangeText={setEstimatedAmount}
          keyboardType="decimal-pad"
          error={fieldErrors.estimatedAmount}
          helperText="Allocated / estimated cost for this line"
          editable={canWrite && !submitting}
        />
        <TextField
          label="Actual amount (optional)"
          value={committedAmount}
          onChangeText={setCommittedAmount}
          keyboardType="decimal-pad"
          error={fieldErrors.committedAmount}
          helperText="Committed cost once agreed. Leave blank if still planned only."
          editable={canWrite && !submitting}
        />
        {vendors.length > 0 ? (
          <>
            <AppText variant="label">Linked vendor (optional)</AppText>
            <View style={styles.chips}>
              <Chip
                label="None"
                active={!weddingVendorId}
                onPress={() => setWeddingVendorId('')}
                disabled={!canWrite || submitting}
              />
              {vendors.map((vendor) => (
                <Chip
                  key={vendor.id}
                  label={vendor.businessName}
                  active={weddingVendorId === vendor.id}
                  onPress={() => setWeddingVendorId(vendor.id)}
                  disabled={!canWrite || submitting}
                />
              ))}
            </View>
          </>
        ) : null}
        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          error={fieldErrors.notes}
          editable={canWrite && !submitting}
        />
        {formError ? <AppText color="danger">{formError}</AppText> : null}
        {canWrite ? (
          <Button
            label={mode === 'create' ? 'Create expense' : 'Save changes'}
            loading={submitting}
            onPress={onSubmit}
          />
        ) : (
          <AppText color="textMuted">Viewers cannot edit expenses.</AppText>
        )}
      </View>
    </Screen>
  );
}

function Chip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}>
      <AppText variant="caption" color={active ? 'onSuccess' : 'text'}>
        {label}
      </AppText>
    </Pressable>
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
  chipDisabled: {
    opacity: 0.5,
  },
  });
}
