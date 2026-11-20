import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import type { VendorFilters } from '@/features/vendors/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Any price', min: null, max: null },
  { label: 'Under 25k', min: null, max: 25000 },
  { label: '25k–75k', min: 25000, max: 75000 },
  { label: '75k+', min: 75000, max: null },
];

export type SheetFilterValues = Pick<VendorFilters, 'city' | 'minPrice' | 'maxPrice'>;

/** Location + price filters in a polished bottom sheet (Apply / Reset). */
export function VendorFiltersSheet({
  visible,
  cities,
  values,
  onClose,
  onApply,
  onReset,
}: {
  visible: boolean;
  cities: string[];
  values: SheetFilterValues;
  onClose: () => void;
  onApply: (next: SheetFilterValues) => void;
  onReset: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState<SheetFilterValues>(values);

  useEffect(() => {
    if (visible) setDraft(values);
  }, [visible, values]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss filters"
          style={styles.backdrop}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: Math.min(height * 0.82, 560),
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}>
          <View style={styles.handle} accessibilityElementsHidden />
          <View style={styles.header}>
            <AppText variant="subtitle" color="heading">
              Filters
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}>
            <AppText variant="caption" color="textMuted">
              Location
            </AppText>
            <View style={styles.chipWrap}>
              <FilterChip
                label="Any city"
                selected={!draft.city}
                onPress={() => setDraft((current) => ({ ...current, city: null }))}
              />
              {cities.map((city) => {
                const selected = draft.city === city;
                return (
                  <FilterChip
                    key={city}
                    label={city}
                    selected={selected}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        city: selected ? null : city,
                      }))
                    }
                  />
                );
              })}
            </View>

            <AppText variant="caption" color="textMuted">
              Price range
            </AppText>
            <View style={styles.chipWrap}>
              {PRICE_PRESETS.map((preset) => {
                const selected =
                  draft.minPrice === preset.min && draft.maxPrice === preset.max;
                return (
                  <FilterChip
                    key={preset.label}
                    label={preset.label}
                    selected={selected}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        minPrice: preset.min,
                        maxPrice: preset.max,
                      }))
                    }
                  />
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Button
              label="Reset"
              variant="secondary"
              fullWidth={false}
              style={styles.actionBtn}
              onPress={() => {
                const cleared = { city: null, minPrice: null, maxPrice: null };
                setDraft(cleared);
                onReset();
              }}
            />
            <Button
              label="Apply"
              fullWidth={false}
              style={styles.actionBtn}
              onPress={() => onApply(draft)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <AppText variant="caption" style={{ color: selected ? colors.success : colors.textMuted }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function sheetFilterCount(values: SheetFilterValues): number {
  let count = 0;
  if (values.city) count += 1;
  if (values.minPrice != null || values.maxPrice != null) count += 1;
  return count;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.overlayStrong,
    },
    sheet: {
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      marginBottom: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    body: {
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    chip: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipSelected: {
      backgroundColor: colors.successMuted,
      borderColor: colors.success,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
    },
    actionBtn: {
      flex: 1,
    },
  });
}
