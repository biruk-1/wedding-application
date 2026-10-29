import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { createWedding } from '@/features/weddings/services/weddingService';
import {
  createWeddingBasicsSchema,
  createWeddingDetailsSchema,
  createWeddingSchema,
  defaultWeddingTitle,
  fieldErrorsFromZod,
  isPastIsoDate,
} from '@/features/weddings/validation/weddingSchemas';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { fontFamilies } from '@/theme/typography';


const STEPS = ['Basics', 'Details', 'Review'];

type WeddingStyle = 'traditional' | 'modern' | 'blend';

const STYLE_OPTIONS: { id: WeddingStyle; label: string; image: number }[] = [
  {
    id: 'traditional',
    label: 'Traditional',
    image: require('../../../../assets/images/style-traditional.jpg'),
  },
  {
    id: 'modern',
    label: 'Modern',
    image: require('../../../../assets/images/style-modern.jpg'),
  },
  {
    id: 'blend',
    label: 'Blend',
    image: require('../../../../assets/images/style-blend.jpg'),
  },
];

export function CreateWeddingFlowScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [partnerOneName, setPartnerOneName] = useState('');
  const [partnerTwoName, setPartnerTwoName] = useState('');
  const [title, setTitle] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [city, setCity] = useState('');
  const [style, setStyle] = useState<WeddingStyle | undefined>('traditional');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resolvedTitle = useMemo(() => {
    const trimmed = title.trim();
    return trimmed.length > 0 ? trimmed : defaultWeddingTitle(partnerOneName, partnerTwoName);
  }, [title, partnerOneName, partnerTwoName]);

  function goBack() {
    if (step === 0) {
      router.back();
      return;
    }
    setFormError(null);
    setFieldErrors({});
    setStep((value) => value - 1);
  }

  function onNextFromBasics() {
    setFormError(null);
    const parsed = createWeddingBasicsSchema.safeParse({
      partnerOneName,
      partnerTwoName,
      title: resolvedTitle,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    if (!title.trim()) setTitle(resolvedTitle);
    setStep(1);
  }

  function onNextFromDetails() {
    setFormError(null);
    const parsed = createWeddingDetailsSchema.safeParse({
      weddingDate: weddingDate || undefined,
      city: city || undefined,
      style,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setStep(2);
  }

  async function onConfirm() {
    if (submitting) return;
    setFormError(null);
    const parsed = createWeddingSchema.safeParse({
      title: resolvedTitle,
      partnerOneName,
      partnerTwoName,
      weddingDate: weddingDate || undefined,
      city: city || undefined,
      style,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      setStep(0);
      return;
    }

    setSubmitting(true);
    const result = await createWedding({
      title: parsed.data.title,
      partnerOneName: parsed.data.partnerOneName,
      partnerTwoName: parsed.data.partnerTwoName,
      weddingDate: parsed.data.weddingDate ?? null,
      city: parsed.data.city ?? null,
      style: parsed.data.style ?? null,
    });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }

    router.replace(`/(app)/weddings/${result.data.id}/success` as Href);
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header
        title="Create Your Wedding"
        subtitle="Start planning your special day in a few simple steps."
        showBack
        onBack={goBack}
      />
      <StepIndicator steps={STEPS} activeIndex={step} />

      {step === 0 ? (
        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionLabel}>
            Partner names
          </AppText>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <View style={styles.fieldLabelRow}>
                <Ionicons name="flower-outline" size={14} color={colors.primary} />
                <AppText variant="caption" color="textMuted">
                  Partner one
                </AppText>
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
                <AppText variant="caption" color="textMuted">
                  Partner two
                </AppText>
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
          <TextField
            label="Wedding title"
            placeholder={resolvedTitle || 'Hana & Daniel'}
            value={title}
            onChangeText={setTitle}
            helperText="Optional — defaults to Partner one & Partner two"
            error={fieldErrors.title}
            editable={!submitting}
          />
          <Button label="Next" onPress={onNextFromBasics} disabled={submitting} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.section}>
          <TextField
            label="Wedding date"
            placeholder="YYYY-MM-DD"
            value={weddingDate}
            onChangeText={setWeddingDate}
            autoCapitalize="none"
            helperText={
              weddingDate && isPastIsoDate(weddingDate)
                ? 'Past dates are allowed for already-held celebrations.'
                : 'Optional — use YYYY-MM-DD'
            }
            error={fieldErrors.weddingDate}
            editable={!submitting}
          />
          <TextField
            label="City"
            placeholder="Addis Ababa"
            value={city}
            onChangeText={setCity}
            helperText="Optional"
            error={fieldErrors.city}
            editable={!submitting}
          />
          <AppText variant="label" style={styles.sectionLabel}>
            Wedding style <AppText variant="caption" color="textSubtle">(Optional)</AppText>
          </AppText>
          <View style={styles.styleRow}>
            {STYLE_OPTIONS.map((option) => {
              const selected = style === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setStyle(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.styleCard, selected && styles.styleCardSelected]}>
                  <Image source={option.image} style={styles.styleImage} resizeMode="cover" />
                  <AppText
                    variant="caption"
                    style={[styles.styleLabel, selected && styles.styleLabelSelected]}>
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <Button label="Next" onPress={onNextFromDetails} disabled={submitting} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionLabel}>
            Review and confirm
          </AppText>
          <View style={styles.reviewCard}>
            <ReviewRow label="Title" value={resolvedTitle} />
            <ReviewRow label="Partners" value={`${partnerOneName.trim()} & ${partnerTwoName.trim()}`} />
            <ReviewRow
              label="Date"
              value={formatWeddingDateLabel(weddingDate) ?? 'Not set'}
            />
            <ReviewRow label="City" value={city.trim() || 'Not set'} />
            <ReviewRow
              label="Style"
              value={style ? style.charAt(0).toUpperCase() + style.slice(1) : 'Not set'}
            />
          </View>
          <AuthFormError message={formError} />
          <Button label="Create wedding" loading={submitting} onPress={() => void onConfirm()} />
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
  return (
    <View style={styles.reviewRow}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="bodyMedium">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    color: colors.text,
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
  styleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  styleCard: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  styleCardSelected: {
    borderColor: colors.primary,
  },
  styleImage: {
    width: '100%',
    height: 72,
    backgroundColor: colors.surfaceMuted,
  },
  styleLabel: {
    textAlign: 'center',
    paddingVertical: spacing.sm,
    color: colors.textMuted,
  },
  styleLabelSelected: {
    color: colors.text,
    fontFamily: fontFamilies.bodyMedium,
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
