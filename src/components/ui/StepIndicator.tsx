import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useColors } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';
import { fontFamilies, typography } from '@/theme/typography';

export type StepIndicatorProps = {
  steps: string[];
  activeIndex: number;
};

export function StepIndicator({ steps, activeIndex }: StepIndicatorProps) {
  const colors = useColors();
  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {steps.map((label, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;
        const filled = isActive || isComplete;

        return (
          <View key={label} style={[styles.step, { zIndex: steps.length - index }]}>
            {index > 0 ? (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: filled ? colors.primaryMuted : colors.border },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.circle,
                filled
                  ? { backgroundColor: colors.primary }
                  : {
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
              ]}>
              <AppText
                variant="label"
                style={[styles.number, { color: filled ? colors.onPrimary : colors.textSubtle }]}>
                {index + 1}
              </AppText>
            </View>
            <AppText
              variant="caption"
              style={[
                styles.label,
                { color: isActive ? colors.text : colors.textSubtle },
                isActive && styles.labelActive,
              ]}
              numberOfLines={1}>
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  step: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    top: 15,
    right: '50%',
    width: '100%',
    height: 2,
    zIndex: 0,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  number: {
    ...typography.label,
    fontFamily: fontFamilies.bodyBold,
  },
  label: {
    textAlign: 'center',
  },
  labelActive: {
    fontFamily: fontFamilies.bodyMedium,
  },
});

