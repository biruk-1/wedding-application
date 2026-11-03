import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { getCelebrationCopy } from '@/features/weddings/celebrationCopy';
import type { WeddingMembership } from '@/features/weddings/types';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function WeddingListCard({
  membership,
  onPress,
}: {
  membership: WeddingMembership;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { wedding, role } = membership;
  const copy = getCelebrationCopy(wedding.celebration_kind);
  const dateLabel = formatWeddingDateLabel(wedding.wedding_date);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${wedding.title}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <AppText variant="subtitle" style={styles.title}>
            {wedding.title}
          </AppText>
          <AppText variant="caption" color="primary" style={styles.role}>
            {role}
          </AppText>
        </View>
        {copy.kind === 'wedding' ? (
          <AppText variant="body" color="textMuted">
            {wedding.partner_one_name} & {wedding.partner_two_name}
          </AppText>
        ) : null}
        <AppText variant="caption" color="textSubtle">
          {[dateLabel, wedding.city].filter(Boolean).join(' · ') ||
            (copy.kind === 'wedding'
              ? 'Date and city not set yet'
              : `${copy.label} date and location not set yet`)}
        </AppText>
      </Card>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
  },
  role: {
    textTransform: 'capitalize',
  },
  });
}
