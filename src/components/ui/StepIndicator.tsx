import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fontFamilies, typography } from '@/theme/typography';


export type StepIndicatorProps = {
  steps: string[];
  activeIndex: number;
};

export function StepIndicator({ steps, activeIndex }: StepIndicatorProps) {
  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {steps.map((label, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;
        const filled = isActive || isComplete;

        return (
          <View key={label} style={styles.step}>
            {index > 0 ? (
              <View style={[styles.connector, filled && styles.connectorFilled]} />
            ) : null}
            <View style={[styles.circle, filled ? styles.circleActive : styles.circleIdle]}>
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
    backgroundColor: colors.border,
    zIndex: 0,
  },
  connectorFilled: {
    backgroundColor: colors.primaryMuted,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleActive: {
    backgroundColor: colors.primary,
  },
  circleIdle: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
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

