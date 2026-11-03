import { useColors } from '@/theme/WeddingThemeContext';
import type { AppColors } from '@/theme/types';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { CategoryBreakdown } from '@/features/budget/types';
import { formatMoney } from '@/features/budget/utils/money';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function CategoryBreakdownList({
  rows,
  currencyCode,
  onPressCategory,
}: {
  rows: CategoryBreakdown[];
  currencyCode: string;
  onPressCategory?: (categoryId: string | null) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (rows.length === 0) {
    return (
      <Card style={styles.empty}>
        <AppText variant="body" color="textMuted">
          No spending by category yet. Add expenses to see a breakdown.
        </AppText>
      </Card>
    );
  }

  const max = Math.max(...rows.map((row) => Math.max(row.allocated, row.actual)), 1);

  return (
    <Card style={styles.card}>
      <AppText variant="label">By category</AppText>
      <View style={styles.list}>
        {rows.map((row) => {
          const plannedWidth = (row.allocated / max) * 100;
          const actualWidth = (row.actual / max) * 100;
          const content = (
            <View style={styles.row}>
              <View style={styles.rowHeader}>
                <AppText variant="body" style={styles.name} numberOfLines={1}>
                  {row.name}
                </AppText>
                {row.overAllocated ? <Badge label="Over" tone="danger" /> : null}
              </View>
              <View style={styles.bars}>
                <View style={styles.track}>
                  <View style={[styles.planned, { width: `${plannedWidth}%` }]} />
                </View>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.actual,
                      {
                        width: `${actualWidth}%`,
                        backgroundColor: row.overAllocated ? colors.danger : colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
              <AppText variant="caption" color="textMuted">
                Planned {formatMoney(row.allocated, currencyCode)} · Actual{' '}
                {formatMoney(row.actual, currencyCode)}
              </AppText>
            </View>
          );

          if (!onPressCategory) {
            return (
              <View key={row.categoryId ?? 'uncategorized'} style={styles.item}>
                {content}
              </View>
            );
          }

          return (
            <Pressable
              key={row.categoryId ?? 'uncategorized'}
              onPress={() => onPressCategory(row.categoryId)}
              style={styles.item}>
              {content}
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" color="textSubtle">
        Top bar = planned · bottom bar = actual (committed)
      </AppText>
    </Card>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  empty: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing.lg,
  },
  item: {
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    color: colors.text,
  },
  bars: {
    gap: spacing.xs,
  },
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  planned: {
    height: '100%',
    backgroundColor: colors.successMuted,
    borderRadius: radii.pill,
  },
  actual: {
    height: '100%',
    borderRadius: radii.pill,
  },
  });
}
