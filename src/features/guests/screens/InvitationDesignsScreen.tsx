import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { Chip } from '@/features/guests/components/Chip';
import { InvitationPreviewCard } from '@/features/guests/components/InvitationPreviewCard';
import { useInvitationDesigns, useSaveInvitationDesign } from '@/features/guests/queries';
import type { DesignData, DesignLayout, InvitationDesign } from '@/features/guests/types';
import { DEFAULT_ACCENT, isHexColor, parseDesignData } from '@/features/guests/utils/guestHelpers';
import {
  designFormSchema,
  designLayouts,
  fieldErrorsFromZod,
} from '@/features/guests/validation/guestSchemas';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

const ACCENT_PRESETS = ['#C5A36A', '#2D4F36', '#C45B4A', '#4A7A9B', '#8B5E83'];

const LAYOUT_LABELS: Record<DesignLayout, string> = {
  classic: 'Classic',
  floral: 'Floral',
  modern: 'Modern',
};

export function InvitationDesignsScreen() {
  const styles = useThemedStyles(createStyles);

  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/guests`);
  const { canWrite } = useWeddingRole(weddingId);
  const wedding = useWedding(weddingId);
  const designsQuery = useInvitationDesigns(weddingId);
  const save = useSaveInvitationDesign(weddingId ?? '');

  const [selected, setSelected] = useState<InvitationDesign | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [layout, setLayout] = useState<DesignLayout>('classic');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const coupleNames = wedding.data
    ? `${wedding.data.partner_one_name} & ${wedding.data.partner_two_name}`
    : 'Your names';
  const dateLabel = formatWeddingDateLabel(wedding.data?.wedding_date) ?? null;
  const location = [wedding.data?.city, wedding.data?.country_code].filter(Boolean).join(', ') || null;

  const draft = useMemo<DesignData>(
    () => ({
      title: title.trim() || undefined,
      message: message.trim() || undefined,
      accent: isHexColor(accent) ? accent.trim() : undefined,
      layout,
    }),
    [title, message, accent, layout],
  );

  function resetForm() {
    setSelected(null);
    setName('');
    setTitle('');
    setMessage('');
    setAccent(DEFAULT_ACCENT);
    setLayout('classic');
    setFieldErrors({});
  }

  function pick(design: InvitationDesign) {
    const data = parseDesignData(design.design_data);
    setSelected(design);
    setName(design.name);
    setTitle(data.title ?? '');
    setMessage(data.message ?? '');
    setAccent(data.accent ?? DEFAULT_ACCENT);
    setLayout(data.layout ?? 'classic');
    setFieldErrors({});
    setFormError(null);
  }

  function onSubmit() {

    if (save.isPending) return;
    setFormError(null);
    const parsed = designFormSchema.safeParse({ name, title, message, accent, layout });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    const values = {
      name: parsed.data.name,
      designData: {
        title: parsed.data.title,
        message: parsed.data.message,
        accent: parsed.data.accent,
        layout: parsed.data.layout,
      },
    };
    save.mutate(
      selected ? { mode: 'edit', designId: selected.id, values } : { mode: 'create', values },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: (saved) => pick(saved),
      },
    );
  }

  const header = <Header title="Invitation designs" showBack onBack={goBack} />;

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (designsQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton fields={3} />
      </Screen>
    );
  }

  if (designsQuery.isError && !designsQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.stack}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(designsQuery.error)}
          </AppText>
          <Button label="Retry" loading={designsQuery.isFetching} onPress={() => void designsQuery.refetch()} />
        </View>
      </Screen>
    );
  }

  const designs = designsQuery.data ?? [];
  const previewData = canWrite ? draft : parseDesignData(selected?.design_data);

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      {header}
      <RefreshNotice
        error={designsQuery.isRefetchError ? designsQuery.error : null}
        onRetry={() => void designsQuery.refetch()}
      />

      <View style={styles.stack}>
        <InvitationPreviewCard
          design={previewData}
          coupleNames={coupleNames}
          dateLabel={dateLabel}
          locationLabel={location}
        />

        {canWrite ? (
          <Card style={styles.card}>
            <AppText variant="label">{selected ? 'Edit design' : 'Create a design'}</AppText>
            <TextField
              label="Design name"
              placeholder="Gold classic"
              value={name}
              onChangeText={setName}
              error={fieldErrors.name}
              editable={!save.isPending}
            />
            <AppText variant="label">Layout</AppText>
            <View style={styles.chips}>
              {designLayouts.map((value) => (
                <Chip
                  key={value}
                  label={LAYOUT_LABELS[value]}
                  selected={layout === value}
                  onPress={() => setLayout(value)}
                />
              ))}
            </View>
            <TextField
              label="Headline"
              placeholder="You are invited"
              value={title}
              onChangeText={setTitle}
              helperText="Optional"
              error={fieldErrors.title}
              editable={!save.isPending}
            />
            <TextField
              label="Message"
              value={message}
              onChangeText={setMessage}
              helperText="Optional"
              error={fieldErrors.message}
              editable={!save.isPending}
              multiline
              style={styles.multiline}
            />
            <AppText variant="label">Accent colour</AppText>
            <View style={styles.swatches}>
              {ACCENT_PRESETS.map((hex) => (
                <Pressable
                  key={hex}
                  onPress={() => setAccent(hex)}
                  accessibilityRole="button"
                  accessibilityLabel={`Accent ${hex}`}
                  accessibilityState={{ selected: accent.toLowerCase() === hex.toLowerCase() }}
                  style={[
                    styles.swatch,
                    { backgroundColor: hex },
                    accent.toLowerCase() === hex.toLowerCase() && styles.swatchSelected,
                  ]}
                />
              ))}
            </View>
            <TextField
              label="Hex colour"
              value={accent}
              onChangeText={setAccent}
              error={fieldErrors.accent}
              editable={!save.isPending}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <AuthFormError message={formError} />
            <Button label={selected ? 'Save design' : 'Create design'} loading={save.isPending} onPress={onSubmit} />
            {selected ? <Button label="Start a new design" variant="secondary" onPress={resetForm} /> : null}
          </Card>
        ) : null}

        <AppText variant="label">Your designs</AppText>
        {designs.length === 0 ? (
          <Card style={styles.card}>
            <AppText variant="subtitle" style={styles.center}>
              No designs yet
            </AppText>
            <AppText color="textMuted" style={styles.center}>
              {canWrite
                ? 'Pick a layout above and create your first invitation design.'
                : 'Writers can create invitation designs for this wedding.'}
            </AppText>
          </Card>
        ) : (
          designs.map((design) => {
            const data = parseDesignData(design.design_data);
            const active = selected?.id === design.id;
            return (
              <Pressable
                key={design.id}
                onPress={() => pick(design)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.designRow, active && styles.designRowActive]}>
                <View style={[styles.dot, { backgroundColor: data.accent ?? DEFAULT_ACCENT }]} />
                <View style={styles.designText}>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {design.name}
                  </AppText>
                  {data.title ? (
                    <AppText variant="caption" color="textMuted" numberOfLines={1}>
                      {data.title}
                    </AppText>
                  ) : null}
                </View>
                <Badge label={LAYOUT_LABELS[data.layout ?? 'classic']} tone="neutral" />
              </Pressable>
            );
          })
        )}
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  card: {
    gap: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  swatches: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  swatchSelected: {
    borderColor: colors.text,
  },
  designRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  designRowActive: {
    borderColor: colors.success,
    borderWidth: 1.5,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  designText: {
    flex: 1,
    gap: spacing.xxs,
  },
  center: {
    textAlign: 'center',
  },
  });
}
