import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import type { CalendarDay } from '@/features/timeline/types';
import { formatMonthLabel } from '@/features/timeline/utils/datetime';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarMonth({
  monthKey,
  days,
  selectedDateKey,
  timeZone,
  onPrev,
  onNext,
  onSelectDate,
}: {
  monthKey: string;
  days: CalendarDay[];
  selectedDateKey: string | null;
  timeZone: string;
  onPrev: () => void;
  onNext: () => void;
  onSelectDate: (dateKey: string) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Button label="Prev" variant="secondary" fullWidth={false} onPress={onPrev} />
        <AppText variant="subtitle" style={styles.month}>
          {formatMonthLabel(monthKey, timeZone)}
        </AppText>
        <Button label="Next" variant="secondary" fullWidth={false} onPress={onNext} />
      </View>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((day) => (
          <AppText key={day} variant="caption" color="textMuted" style={styles.weekday}>
            {day}
          </AppText>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day) => {
          const selected = selectedDateKey === day.dateKey;
          return (
            <Pressable
              key={day.dateKey}
              onPress={() => onSelectDate(day.dateKey)}
              style={[
                styles.cell,
                !day.inCurrentMonth && styles.outside,
                selected && styles.selected,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}>
              <AppText
                variant="caption"
                color={selected ? 'onSuccess' : day.inCurrentMonth ? 'text' : 'textSubtle'}>
                {day.dayOfMonth}
              </AppText>
              {day.hasEvents ? <View style={[styles.dot, selected && styles.dotOnSelected]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  month: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
  },
  weekdays: {
    flexDirection: 'row',
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    gap: 2,
  },
  outside: {
    opacity: 0.45,
  },
  selected: {
    backgroundColor: colors.success,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  dotOnSelected: {
    backgroundColor: colors.onSuccess,
  },
  });
}
