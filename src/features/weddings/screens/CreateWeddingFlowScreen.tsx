import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { ThemePreviewCard } from '@/components/theme/ThemePreviewCard';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { useBudgetCategories } from '@/features/budget/queries';
import {
  CELEBRATION_BY_KIND,
  CELEBRATIONS,
  getDefaultCelebrationTitle,
} from '@/features/weddings/celebrationsConfig';
import { createWedding } from '@/features/weddings/services/weddingService';
import type { CelebrationKind } from '@/features/weddings/types';
import {
  createCelebrationTypeSchema,
  createWeddingBudgetSchema,
  createWeddingDetailsSchema,
  createWeddingSchema,
  createWeddingStyleSchema,
  fieldErrorsFromZod,
  isPastIsoDate,
} from '@/features/weddings/validation/weddingSchemas';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors, WeddingThemeProvider } from '@/theme/WeddingThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';


const STEPS = ['Event', 'Details', 'Aesthetic', 'Budget', 'Review'];

type WeddingStyle = 'traditional' | 'modern' | 'blend';

const STYLE_OPTIONS: { id: WeddingStyle; label: string }[] = [
  { id: 'traditional', label: 'Traditional' },
  { id: 'modern', label: 'Modern' },
  { id: 'blend', label: 'Fusion' },
];

export function CreateWeddingFlowScreen() {
  const [style, setStyle] = useState<WeddingStyle | undefined>('traditional');
  return (
    <WeddingThemeProvider previewStyle={style ?? 'traditional'}>
      <CreateWeddingFlowContent style={style} setStyle={setStyle} />
    </WeddingThemeProvider>
  );
}

function CreateWeddingFlowContent({
  style,
  setStyle,
}: {
  style: WeddingStyle | undefined;
  setStyle: (value: WeddingStyle | undefined) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const budgetCategories = useBudgetCategories();
  const [step, setStep] = useState(0);
  const [celebrationKind, setCelebrationKind] = useState<CelebrationKind>('wedding');
  const [partnerOneName, setPartnerOneName] = useState('');
  const [partnerTwoName, setPartnerTwoName] = useState('');
  const [title, setTitle] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [city, setCity] = useState('');
  const [estimatedGuestCount, setEstimatedGuestCount] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [allocationValues, setAllocationValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const celebration = CELEBRATION_BY_KIND[celebrationKind];
  const resolvedTitle = useMemo(() => {
    const trimmed = title.trim();
    return trimmed || getDefaultCelebrationTitle(celebrationKind, partnerOneName, partnerTwoName);
  }, [celebrationKind, title, partnerOneName, partnerTwoName]);

  const parsedBudget = useMemo(() => {
    const allocations = Object.entries(allocationValues)
      .filter(([, value]) => value.trim().length > 0)
      .map(([categorySlug, value]) => ({
        categorySlug,
        amount: Number(value.replace(/,/g, '')),
      }));
    return {
      totalBudget: totalBudget.trim() ? Number(totalBudget.replace(/,/g, '')) : 0,
      budgetAllocations: allocations,
    };
  }, [allocationValues, totalBudget]);

  const allocatedTotal = parsedBudget.budgetAllocations.reduce(
    (sum, allocation) => sum + (Number.isFinite(allocation.amount) ? allocation.amount : 0),
    0,
  );
  const remainingBudget =
    (Number.isFinite(parsedBudget.totalBudget) ? parsedBudget.totalBudget : 0) - allocatedTotal;

  function goBack() {
    if (step === 0) {
      // Hub replace()-navigates here for new users; prefer selector over a dead back stack.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(app)/weddings' as Href);
      }
      return;
    }
    setFormError(null);
    setFieldErrors({});
    setStep((value) => value - 1);
  }

  function onSelectCelebration(kind: CelebrationKind) {
    setCelebrationKind(kind);
    setTitle('');
    setFieldErrors({});
    setFormError(null);
  }

  function onNextFromEvent() {
    setFormError(null);
    const parsed = createCelebrationTypeSchema.safeParse({ celebrationKind });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setStep(1);
  }

  function onNextFromDetails() {
    setFormError(null);
    const parsed = createWeddingDetailsSchema.safeParse({
      celebrationKind,
      title: resolvedTitle,
      partnerOneName,
      partnerTwoName,
      weddingDate: weddingDate || undefined,
      city: city || undefined,
      estimatedGuestCount: estimatedGuestCount.trim()
        ? Number(estimatedGuestCount.replace(/,/g, ''))
        : undefined,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    if (!title.trim()) setTitle(resolvedTitle);
    setStep(2);
  }

  function onNextFromStyle() {
    const parsed = createWeddingStyleSchema.safeParse({ style });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setStep(3);
  }

  function onNextFromBudget() {
    const parsed = createWeddingBudgetSchema.safeParse(parsedBudget);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setStep(4);
  }

  async function onConfirm() {
    if (submitting) return;
    setFormError(null);
    const parsed = createWeddingSchema.safeParse({
      celebrationKind,
      title: resolvedTitle,
      partnerOneName,
      partnerTwoName,
      weddingDate: weddingDate || undefined,
      city: city || undefined,
      style,
      estimatedGuestCount: estimatedGuestCount.trim()
        ? Number(estimatedGuestCount.replace(/,/g, ''))
        : undefined,
      ...parsedBudget,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      setStep(1);
      return;
    }

    setSubmitting(true);
    const result = await createWedding({
      title: parsed.data.title,
      celebrationKind: parsed.data.celebrationKind,
      partnerOneName: parsed.data.partnerOneName ?? null,
      partnerTwoName: parsed.data.partnerTwoName ?? null,
      weddingDate: parsed.data.weddingDate ?? null,
      city: parsed.data.city ?? null,
      style: parsed.data.style,
      estimatedGuestCount: parsed.data.estimatedGuestCount ?? null,
      totalBudget: parsed.data.totalBudget,
      budgetAllocations: parsed.data.budgetAllocations.filter(
        (allocation) => allocation.amount > 0,
      ),
    });

    if (!result.ok) {
      setSubmitting(false);
      setFormError(result.error.message);
      return;
    }

    setSubmitting(false);
    router.replace(`/(app)/weddings/${result.data.id}/success` as Href);
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header
        title="Create Your Celebration"
        subtitle="Start planning your event in a few simple steps."
        showBack
        onBack={goBack}
      />
      <StepIndicator steps={STEPS} activeIndex={step} />

      {step === 0 ? (
        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionLabel}>
            What are you celebrating?
          </AppText>
          <View style={styles.celebrationGrid}>
            {CELEBRATIONS.map((option) => {
              const selected = celebrationKind === option.kind;
              return (
                <Pressable
                  key={option.kind}
                  onPress={() => onSelectCelebration(option.kind)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label}. ${option.shortDescription}`}
                  accessibilityState={{ checked: selected }}
                  style={[
                    styles.celebrationCard,
                    selected && styles.styleCardSelected,
                  ]}>
                  <Image source={option.image} style={styles.celebrationImage} resizeMode="cover" />
                  <View style={styles.celebrationCopy}>
                    <AppText variant="bodyMedium">{option.label}</AppText>
                    <AppText variant="caption" color="textMuted">
                      {option.shortDescription}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Button label="Next" onPress={onNextFromEvent} disabled={submitting} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.section}>
          {celebrationKind === 'wedding' ? (
            <>
              <AppText variant="label" style={styles.sectionLabel}>
                Partner names
              </AppText>
              <View style={styles.nameRow}>
                <View style={styles.nameField}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="flower-outline" size={14} color={colors.primary} />
                    <AppText variant="caption" color="textMuted">Partner one</AppText>
                  </View>
                  <TextField
                    placeholder="Hana"
                    value={partnerOneName}
                    onChangeText={setPartnerOneName}
                    autoCapitalize="words"
                    error={fieldErrors.partnerOneName}
                    editable={!submitting}
                  />
                </View>
                <View style={styles.nameField}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="leaf-outline" size={14} color={colors.success} />
                    <AppText variant="caption" color="textMuted">Partner two</AppText>
                  </View>
                  <TextField
                    placeholder="Daniel"
                    value={partnerTwoName}
                    onChangeText={setPartnerTwoName}
                    autoCapitalize="words"
                    error={fieldErrors.partnerTwoName}
                    editable={!submitting}
                  />
                </View>
              </View>
            </>
          ) : null}
          <TextField
            label={celebration.titleLabel}
            placeholder={celebration.titlePlaceholder}
            value={title}
            onChangeText={setTitle}
            helperText={
              celebrationKind === 'other'
                ? 'Required — describe the type of event'
                : `Defaults to “${getDefaultCelebrationTitle(
                    celebrationKind,
                    partnerOneName,
                    partnerTwoName,
                  )}”`
            }
            error={fieldErrors.title}
            editable={!submitting}
          />
          <AppDatePicker
            label={celebration.dateLabel}
            value={weddingDate}
            onChange={setWeddingDate}
            onClear={() => setWeddingDate('')}
            helperText={
              weddingDate && isPastIsoDate(weddingDate)
                ? 'Past dates are allowed for already-held celebrations.'
                : 'Optional'
            }
            error={fieldErrors.weddingDate}
            disabled={submitting}
            placeholder="Select date"
          />
          <TextField
            label={celebration.locationLabel}
            placeholder="Addis Ababa"
            value={city}
            onChangeText={setCity}
            helperText="Optional"
            error={fieldErrors.city}
            editable={!submitting}
          />
          <TextField
            label="Estimated guest count"
            placeholder="e.g. 250"
            value={estimatedGuestCount}
            onChangeText={setEstimatedGuestCount}
            keyboardType="numeric"
            helperText="Optional"
            error={fieldErrors.estimatedGuestCount}
            editable={!submitting}
          />
          <Button label="Next" onPress={onNextFromDetails} disabled={submitting} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionLabel}>
            Event aesthetic
          </AppText>
          <AppText variant="caption" color="textMuted">
            Choose the visual direction for your celebration. You can change it later.
          </AppText>
          <View style={styles.styleList} accessibilityRole="radiogroup">
            {STYLE_OPTIONS.map((option) => (
              <ThemePreviewCard
                key={option.id}
                styleId={option.id}
                selected={style === option.id}
                onPress={() => setStyle(option.id)}
              />
            ))}
          </View>
          <Button label="Next" onPress={onNextFromStyle} disabled={submitting} />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionLabel}>
            Budget
          </AppText>
          <TextField
            label="Total budget (ETB)"
            placeholder="e.g. 250000"
            value={totalBudget}
            onChangeText={setTotalBudget}
            keyboardType="numeric"
            helperText="Enter 0 or leave blank if you are not ready to set a budget."
            error={fieldErrors.totalBudget}
            editable={!submitting}
          />
          <View style={styles.budgetSummary} accessibilityLiveRegion="polite">
            <ReviewRow label="Allocated" value={`ETB ${allocatedTotal.toLocaleString()}`} />
            <ReviewRow label="Remaining" value={`ETB ${remainingBudget.toLocaleString()}`} />
          </View>
          {budgetCategories.data?.length ? (
            <View style={styles.allocationList}>
              <AppText variant="label">Optional allocations</AppText>
              {budgetCategories.data.map((category) => (
                <TextField
                  key={category.id}
                  label={category.name_en}
                  placeholder="0"
                  value={allocationValues[category.slug] ?? ''}
                  onChangeText={(value) =>
                    setAllocationValues((current) => ({
                      ...current,
                      [category.slug]: value,
                    }))
                  }
                  keyboardType="numeric"
                  editable={!submitting}
                />
              ))}
            </View>
          ) : budgetCategories.isPending ? (
            <AppText variant="caption" color="textMuted">
              Loading budget categories…
            </AppText>
          ) : (
            <AppText variant="caption" color="textMuted">
              Budget categories are unavailable. You can still set the total now and allocate it
              later.
            </AppText>
          )}
          {fieldErrors.budgetAllocations ? (
            <AppText
              variant="caption"
              style={styles.errorText}
              accessibilityLiveRegion="polite">
              {fieldErrors.budgetAllocations}
            </AppText>
          ) : null}
          <Button label="Next" onPress={onNextFromBudget} disabled={submitting} />
        </View>
      ) : null}

      {step === 4 ? (
        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionLabel}>
            Review and confirm
          </AppText>
          <View style={styles.reviewCard}>
            <ReviewRow label="Event type" value={celebration.label} />
            <ReviewRow label="Title" value={resolvedTitle} />
            {celebrationKind === 'wedding' ? (
              <ReviewRow
                label="Partners"
                value={`${partnerOneName.trim()} & ${partnerTwoName.trim()}`}
              />
            ) : null}
            <ReviewRow
              label="Date"
              value={formatWeddingDateLabel(weddingDate) ?? 'Not set'}
            />
            <ReviewRow label="Location" value={city.trim() || 'Not set'} />
            <ReviewRow
              label="Estimated guests"
              value={estimatedGuestCount.trim() || 'Not set'}
            />
            <ReviewRow
              label="Total budget"
              value={`ETB ${parsedBudget.totalBudget.toLocaleString()}`}
            />
            <ReviewRow label="Allocated" value={`ETB ${allocatedTotal.toLocaleString()}`} />
            <ReviewRow
              label="Aesthetic"
              value={STYLE_OPTIONS.find((option) => option.id === style)?.label ?? 'Not set'}
            />
          </View>
          <AuthFormError message={formError} />
          <Button
            label="Create celebration"
            loading={submitting}
            onPress={() => void onConfirm()}
          />
          <Button
            label="Edit details"
            variant="secondary"
            disabled={submitting}
            onPress={() => setStep(0)}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.reviewRow}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="bodyMedium">{value}</AppText>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  section: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    color: colors.text,
  },
  celebrationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  celebrationCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  styleCardSelected: {
    borderColor: colors.primary,
  },
  celebrationImage: {
    width: '100%',
    height: 76,
    backgroundColor: colors.surfaceMuted,
  },
  celebrationCopy: {
    gap: spacing.xxs,
    padding: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nameField: {
    flex: 1,
    gap: spacing.sm,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  styleList: {
    gap: spacing.md,
  },
  budgetSummary: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
  },
  allocationList: {
    gap: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  reviewCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  reviewRow: {
    gap: spacing.xxs,
  },
  });
}
