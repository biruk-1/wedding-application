import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { BudgetSummary } from '@/features/budget/types';
import { formatMoney, formatPercent } from '@/features/budget/utils/money';
import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function BudgetSummaryCard({ summary }: { summary: BudgetSummary }) {
  const themeColors = useColors();
  const currency = summary.currencyCode;
  const fill = Math.max(0, Math.min(1, summary.utilization));

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="caption" color="textMuted">
          Total budget
        </AppText>
        {summary.overBudget ? <Badge label="Over budget" tone="danger" /> : null}
      </View>
      <AppText variant="title" style={{ color: themeColors.text }}>
        {formatMoney(summary.totalBudget, currency)}
      </AppText>

      <View
        style={[styles.track, { backgroundColor: themeColors.surfaceMuted }]}
        accessibilityLabel={`Budget used ${formatPercent(fill)}`}>
        <View
          style={[
            styles.fill,
            {
              width: `${fill * 100}%`,
              backgroundColor: summary.overBudget ? themeColors.danger : themeColors.success,
            },
          ]}
        />
      </View>
      <AppText variant="caption" color="textMuted">
        {formatPercent(fill)} used · {formatMoney(summary.remaining, currency)} remaining
      </AppText>

      <View style={styles.grid}>
        <Metric label="Allocated" value={formatMoney(summary.allocated, currency)} hint="Planned" />
        <Metric label="Actual" value={formatMoney(summary.actual, currency)} hint="Committed" />
        <Metric label="Paid" value={formatMoney(summary.paid, currency)} hint="Recorded" />
        <Metric
          label="Outstanding"
          value={formatMoney(summary.outstanding, currency)}
          hint="Still due"
          emphasize
        />
      </View>
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
}) {

  return (
    <View style={styles.metric}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="subtitle" color={emphasize ? 'warning' : 'text'} style={styles.metricValue}>
        {value}
      </AppText>
      <AppText variant="caption" color="textSubtle">
        {hint}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  track: {
    height: 10,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metric: {
    width: '47%',
    gap: spacing.xxs,
  },
  metricValue: {
    fontVariant: ['tabular-nums'],
  },
  });
