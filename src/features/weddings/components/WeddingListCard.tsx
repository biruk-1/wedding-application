import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import type { WeddingMembership } from '@/features/weddings/types';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export function WeddingListCard({
  membership,
  onPress,
}: {
  membership: WeddingMembership;
  onPress: () => void;
}) {
  const { wedding, role } = membership;
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
        <AppText variant="body" color="textMuted">
          {wedding.partner_one_name} & {wedding.partner_two_name}
        </AppText>
        <AppText variant="caption" color="textSubtle">
          {[dateLabel, wedding.city].filter(Boolean).join(' · ') || 'Date and city not set yet'}
        </AppText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
