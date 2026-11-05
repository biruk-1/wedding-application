import { StyleSheet, View } from 'react-native';

import { ThemePreviewCard } from '@/components/theme/ThemePreviewCard';
import type { WeddingVisualStyle } from '@/theme/types';
import { spacing } from '@/theme/spacing';

const OPTIONS: WeddingVisualStyle[] = ['modern', 'traditional', 'blend'];

export function WeddingStylePicker({
  value,
  onChange,
  disabled,
}: {
  value: WeddingVisualStyle;
  onChange: (style: WeddingVisualStyle) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {OPTIONS.map((id) => (
        <ThemePreviewCard
          key={id}
          styleId={id}
          compact
          selected={value === id}
          disabled={disabled}
          onPress={() => onChange(id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
