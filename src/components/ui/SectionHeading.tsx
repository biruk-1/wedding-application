import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { useColors, useDecorations } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type SectionHeadingProps = ViewProps & {
  title: string;
  subtitle?: string;
};

export function SectionHeading({ title, subtitle, style, ...rest }: SectionHeadingProps) {
  const colors = useColors();
  const decorations = useDecorations();
  return (
    <View style={[styles.container, style]} {...rest}>
      <Text style={[styles.title, { color: colors.heading }]}>{title}</Text>
      {decorations.sectionGoldLine ? (
        <View
          accessibilityElementsHidden
          style={[styles.goldLine, { backgroundColor: colors.primary }]}
        />
      ) : null}
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  title: {
    ...typography.title,
  },
  goldLine: {
    width: 44,
    height: 2,
    borderRadius: 1,
  },
  subtitle: {
    ...typography.body,
  },
});
