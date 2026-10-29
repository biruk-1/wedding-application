import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import type { VendorCategory, VendorFilters } from '@/features/vendors/types';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Any price', min: null, max: null },
  { label: 'Under 25k', min: null, max: 25000 },
  { label: '25k–75k', min: 25000, max: 75000 },
  { label: '75k+', min: 75000, max: null },
];

export function VendorFilterBar({
  filters,
  onChange,
  categories,
  cities,
  onReset,
  hasActiveFilters,
}: {
  filters: VendorFilters;
  onChange: (next: VendorFilters) => void;
  categories: VendorCategory[];
  cities: string[];
  onReset: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <TextInput
        value={filters.query}
        onChangeText={(query) => onChange({ ...filters, query })}
        placeholder="Search vendors…"
        placeholderTextColor={colors.textSubtle}
        style={styles.search}
        accessibilityLabel="Search vendors"
      />

      <AppText variant="caption" color="textMuted">
        Categories
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={() => onChange({ ...filters, categoryId: null })}
          style={[styles.chip, !filters.categoryId && styles.chipSelected]}
          accessibilityRole="button"
          accessibilityState={{ selected: !filters.categoryId }}>
          <AppText
            variant="caption"
            style={{ color: !filters.categoryId ? colors.onPrimary : colors.textMuted }}>
            All
          </AppText>
        </Pressable>
        {categories.map((category) => {
          const selected = filters.categoryId === category.id;
          return (
            <Pressable
              key={category.id}
              onPress={() =>
                onChange({
                  ...filters,
                  categoryId: selected ? null : category.id,
                })
              }
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}>
              <AppText
                variant="caption"
                style={{ color: selected ? colors.onPrimary : colors.textMuted }}>
                {category.name_en}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {cities.length > 0 ? (
        <>
          <AppText variant="caption" color="textMuted">
            Location
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable
              onPress={() => onChange({ ...filters, city: null })}
              style={[styles.chipAlt, !filters.city && styles.chipSelectedAlt]}
              accessibilityRole="button">
              <AppText
                variant="caption"
                style={{ color: !filters.city ? colors.success : colors.textMuted }}>
                Any city
              </AppText>
            </Pressable>
            {cities.map((city) => {
              const selected = filters.city === city;
              return (
                <Pressable
                  key={city}
                  onPress={() => onChange({ ...filters, city: selected ? null : city })}
                  style={[styles.chipAlt, selected && styles.chipSelectedAlt]}
                  accessibilityRole="button">
                  <AppText
                    variant="caption"
                    style={{ color: selected ? colors.success : colors.textMuted }}>
                    {city}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <AppText variant="caption" color="textMuted">
        Starting price
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {PRICE_PRESETS.map((preset) => {
          const selected =
            filters.minPrice === preset.min && filters.maxPrice === preset.max;
          return (
            <Pressable
              key={preset.label}
              onPress={() =>
                onChange({
                  ...filters,
                  minPrice: preset.min,
                  maxPrice: preset.max,
                })
              }
              style={[styles.chipAlt, selected && styles.chipSelectedAlt]}
              accessibilityRole="button">
              <AppText
                variant="caption"
                style={{ color: selected ? colors.success : colors.textMuted }}>
                {preset.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {hasActiveFilters ? (
        <Button label="Reset filters" variant="ghost" onPress={onReset} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  search: {
    ...typography.body,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.success,
  },
  chipAlt: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelectedAlt: {
    backgroundColor: colors.successMuted,
    borderColor: colors.success,
  },
});
