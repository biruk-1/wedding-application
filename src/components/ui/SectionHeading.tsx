import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type SectionHeadingProps = ViewProps & {
  title: string;
  subtitle?: string;
};

export function SectionHeading({ title, subtitle, style, ...rest }: SectionHeadingProps) {
  const { colors, decorations } = useWeddingTheme();
  const env = decorations.environment;

  return (
    <View style={[styles.container, style]} {...rest}>
      <Text style={[styles.title, { color: colors.heading }]} accessibilityRole="header">
        {title}
      </Text>
      <View accessibilityElementsHidden style={styles.accentRow}>
        {env === 'traditional' ? (
          <>
            <Svg width={10} height={10}>
              <Polygon points="5,0.5 9.5,5 5,9.5 0.5,5" fill={colors.success} />
              <Polygon points="5,3 7,5 5,7 3,5" fill={colors.primary} />
            </Svg>
            <View style={[styles.line, styles.lineLong, { backgroundColor: colors.primary }]} />
            <View style={[styles.line, styles.lineShort, { backgroundColor: colors.accent }]} />
          </>
        ) : env === 'fusion' ? (
          <>
            <View style={[styles.line, styles.lineLong, { backgroundColor: colors.primary }]} />
            <Svg width={7} height={7}>
              <Polygon points="3.5,0 7,3.5 3.5,7 0,3.5" fill={colors.accent} />
            </Svg>
          </>
        ) : (
          <View style={[styles.line, styles.lineModern, { backgroundColor: colors.primaryMuted }]} />
        )}
      </View>
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
  accentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  line: {
    height: 2,
    borderRadius: 1,
  },
  lineLong: {
    width: 36,
  },
  lineShort: {
    width: 10,
  },
  lineModern: {
    width: 28,
    height: 1.5,
  },
  subtitle: {
    ...typography.body,
  },
});
