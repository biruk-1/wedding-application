import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { WeddingEvent } from '@/features/timeline/types';
import { formatEventWhen } from '@/features/timeline/utils/datetime';
import { eventTypeLabel, locationLabel } from '@/features/timeline/utils/timelineHelpers';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

function EventRowComponent({
  event,
  timeZone,
  onOpen,
}: {
  event: WeddingEvent;
  timeZone: string;
  onOpen: (eventId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const location = locationLabel(event);
  return (
    <Pressable onPress={() => onOpen(event.id)} accessibilityRole="button">
      <Card style={styles.card}>
        <View style={styles.header}>
          <AppText variant="subtitle" style={styles.title} numberOfLines={1}>
            {event.name}
          </AppText>
          <Badge label={eventTypeLabel(event.event_type)} tone="primary" />
        </View>
        <AppText variant="caption" color="textMuted">
          {formatEventWhen(event.starts_at, event.ends_at, timeZone)}
        </AppText>
        {location ? (
          <AppText variant="caption" color="textSubtle" numberOfLines={1}>
            {location}
          </AppText>
        ) : null}
      </Card>
    </Pressable>
  );
}

export const EventRow = memo(EventRowComponent);

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
  });
}
