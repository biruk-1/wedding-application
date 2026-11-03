import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { PaymentStatusBadge } from '@/features/budget/components/PaymentStatusBadge';
import type { BudgetItemListItem } from '@/features/budget/types';
import { formatMoney } from '@/features/budget/utils/money';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

type Props = {
  item: BudgetItemListItem;
  currencyCode: string;
  onOpen: (itemId: string) => void;
};

function ExpenseRowComponent({ item, currencyCode, onOpen }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable onPress={() => onOpen(item.id)} accessibilityRole="button">
      <Card style={styles.card}>
        <View style={styles.header}>
          <AppText variant="subtitle" style={styles.title} numberOfLines={1}>
            {item.label}
          </AppText>
          <PaymentStatusBadge status={item.payment_status} />
        </View>
        <AppText variant="caption" color="textMuted">
          {item.category?.name_en ?? 'Uncategorized'}
        </AppText>
        <View style={styles.amounts}>
          <AppText variant="body" style={styles.amount}>
            {formatMoney(item.due_amount, currencyCode)}
          </AppText>
          <AppText variant="caption" color="textMuted">
            Paid {formatMoney(item.paid_total, currencyCode)}
            {item.outstanding > 0 ? ` · Due ${formatMoney(item.outstanding, currencyCode)}` : ''}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
}

export const ExpenseRow = memo(ExpenseRowComponent);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.text,
  },
  amounts: {
    gap: spacing.xxs,
  },
  amount: {
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  });
}
