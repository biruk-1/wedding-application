import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import type { WeddingTheme } from '@/theme/types';

/**
 * Original geometric ornaments modelled on the structure of tibeb borders (parallel rules framing
 * stepped lozenges). Cross motifs, flags and non-Ethiopian textile patterns are intentionally excluded.
 */

type OrnamentProps = {
  /** Render for a specific theme (previews); defaults to the active wedding theme. */
  theme?: WeddingTheme;
  style?: StyleProp<ViewStyle>;
};

export function useOrnamentTheme(theme?: WeddingTheme): WeddingTheme {
  const active = useWeddingTheme().theme;
  return theme ?? active;
}

function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

function points(scale: number, ...coords: number[]): string {
  const pairs: string[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    pairs.push(`${coords[i] * scale},${coords[i + 1] * scale}`);
  }
  return pairs.join(' ');
}

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  pointerEvents: 'none',
} as const;

/** Traditional tibeb band: gold and green rules around repeating stepped lozenges. Unit 28×14. */
export function TibebBand({ theme, style, height = 14 }: OrnamentProps & { height?: number }) {
  const { colors } = useOrnamentTheme(theme);
  const id = useSvgId('tibeb');
  const s = height / 14;

  return (
    <View {...hidden} style={[{ height, alignSelf: 'stretch', overflow: 'hidden' }, style]}>
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" x={0} y={0} width={28 * s} height={height}>
            <Rect x={0} y={0} width={28 * s} height={1.4 * s} fill={colors.primary} />
            <Rect x={0} y={12.6 * s} width={28 * s} height={1.4 * s} fill={colors.primary} />
            <Rect x={0} y={2.4 * s} width={28 * s} height={0.6 * s} fill={colors.success} />
            <Rect x={0} y={11 * s} width={28 * s} height={0.6 * s} fill={colors.success} />
            <Polygon points={points(s, 14, 3.6, 19.4, 7, 14, 10.4, 8.6, 7)} fill={colors.success} />
            <Polygon points={points(s, 14, 5.2, 16.6, 7, 14, 8.8, 11.4, 7)} fill={colors.primary} />
            <Polygon points={points(s, 14, 6.2, 15.1, 7, 14, 7.8, 12.9, 7)} fill={colors.accent} />
            <Polygon points={points(s, 0, 4.2, 3.2, 7, 0, 9.8)} fill={colors.ornament} />
            <Polygon points={points(s, 28, 4.2, 24.8, 7, 28, 9.8)} fill={colors.ornament} />
            <Circle cx={5.8 * s} cy={7 * s} r={0.8 * s} fill={colors.accent} />
            <Circle cx={22.2 * s} cy={7 * s} r={0.8 * s} fill={colors.accent} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Fusion stripe: fine gold rules with sparse wine diamonds and bronze points. Unit 40×8. */
export function FusionStripe({ theme, style, height = 8 }: OrnamentProps & { height?: number }) {
  const { colors } = useOrnamentTheme(theme);
  const id = useSvgId('fusion');
  const s = height / 8;

  return (
    <View {...hidden} style={[{ height, alignSelf: 'stretch', overflow: 'hidden' }, style]}>
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" x={0} y={0} width={40 * s} height={height}>
            <Rect x={0} y={0} width={40 * s} height={0.8 * s} fill={colors.primary} />
            <Rect x={0} y={7.2 * s} width={40 * s} height={0.8 * s} fill={colors.primary} />
            <Polygon points={points(s, 20, 1.6, 24.4, 4, 20, 6.4, 15.6, 4)} fill={colors.accent} />
            <Polygon points={points(s, 20, 3, 21.8, 4, 20, 5, 18.2, 4)} fill={colors.surfaceElevated} />
            <Rect x={8 * s} y={3.7 * s} width={5 * s} height={0.6 * s} fill={colors.ornament} />
            <Rect x={27 * s} y={3.7 * s} width={5 * s} height={0.6 * s} fill={colors.ornament} />
            <Circle cx={3 * s} cy={4 * s} r={0.9 * s} fill={colors.ornament} />
            <Circle cx={37 * s} cy={4 * s} r={0.9 * s} fill={colors.ornament} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Modern: concentric champagne hairline arcs with a soft glow, anchored to one corner. */
export function ModernArcs({
  theme,
  style,
  size = 280,
  corner = 'topRight',
}: OrnamentProps & { size?: number; corner?: 'topRight' | 'bottomLeft' }) {
  const { colors } = useOrnamentTheme(theme);
  const glowId = useSvgId('glow');
  const top = corner === 'topRight';
  const cx = top ? size * 0.92 : size * 0.05;
  const cy = top ? size * 0.05 : size * 0.95;
  const stroke = top ? colors.primary : colors.success;
  const rings = top ? [0.42, 0.54, 0.66, 0.78] : [0.46, 0.6];

  return (
    <View
      {...hidden}
      style={[
        { position: 'absolute', width: size, height: size },
        top ? { top: 0, right: 0 } : { bottom: 0, left: 0 },
        style,
      ]}>
      <Svg width={size} height={size}>
        {top ? (
          <>
            <Defs>
              <RadialGradient id={glowId} cx={cx} cy={cy} r={size * 0.7} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.primaryMuted} stopOpacity={0.75} />
                <Stop offset="1" stopColor={colors.primaryMuted} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={size} height={size} fill={`url(#${glowId})`} />
          </>
        ) : null}
        {rings.map((ratio, index) => (
          <Circle
            key={ratio}
            cx={cx}
            cy={cy}
            r={size * ratio}
            stroke={stroke}
            strokeWidth={0.9}
            strokeOpacity={(top ? 0.42 : 0.16) - index * (top ? 0.08 : 0.05)}
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

/** Short ornament placed under screen titles; differs per environment. */
export function HeaderOrnament({ theme, style }: OrnamentProps) {
  const t = useOrnamentTheme(theme);
  const { colors } = t;

  if (t.decorations.environment === 'traditional') {
    return <TibebBand theme={t} height={8} style={[styles.headerTibeb, style]} />;
  }

  if (t.decorations.environment === 'fusion') {
    return (
      <View {...hidden} style={[styles.headerRow, style]}>
        <View style={[styles.rule, { width: 22, backgroundColor: colors.primary }]} />
        <Svg width={10} height={10}>
          <Polygon points="5,0.5 9.5,5 5,9.5 0.5,5" fill={colors.accent} />
        </Svg>
        <View style={[styles.rule, { width: 22, backgroundColor: colors.primary }]} />
      </View>
    );
  }

  return <View {...hidden} style={[styles.modernRule, { backgroundColor: colors.primary }, style]} />;
}

/** Top edge for bottom sheets / modals: grab handle plus the theme's band. */
export function SheetOrnament({ theme, style }: OrnamentProps) {
  const t = useOrnamentTheme(theme);
  const env = t.decorations.environment;

  return (
    <View {...hidden} style={[styles.sheetTop, style]}>
      {env === 'traditional' ? <TibebBand theme={t} height={7} /> : null}
      {env === 'fusion' ? <FusionStripe theme={t} height={5} style={styles.sheetStripe} /> : null}
      <View style={[styles.handle, { backgroundColor: t.colors.borderStrong }]} />
    </View>
  );
}

/** Section divider with a themed centre glyph. */
export function OrnamentDivider({ theme, style }: OrnamentProps) {
  const t = useOrnamentTheme(theme);
  const { colors } = t;
  const env = t.decorations.environment;
  const lineColor = env === 'modern' ? colors.border : colors.primaryMuted;

  return (
    <View {...hidden} style={[styles.dividerRow, style]}>
      <View style={[styles.dividerLine, { backgroundColor: lineColor }]} />
      {env === 'traditional' ? (
        <Svg width={44} height={12}>
          <Polygon points="6,1 11,6 6,11 1,6" fill={colors.success} />
          <Polygon points="22,0 28,6 22,12 16,6" fill={colors.primary} />
          <Polygon points="22,3.6 24.4,6 22,8.4 19.6,6" fill={colors.accent} />
          <Polygon points="38,1 43,6 38,11 33,6" fill={colors.success} />
        </Svg>
      ) : env === 'fusion' ? (
        <Svg width={14} height={14}>
          <Polygon points="7,0.8 13.2,7 7,13.2 0.8,7" fill="none" stroke={colors.primary} strokeWidth={1} />
          <Polygon points="7,4 10,7 7,10 4,7" fill={colors.accent} />
        </Svg>
      ) : (
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      )}
      <View style={[styles.dividerLine, { backgroundColor: lineColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheetTop: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  sheetStripe: {
    alignSelf: 'center',
    width: '36%',
    marginTop: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    opacity: 0.6,
  },
  headerTibeb: {
    width: 84,
    alignSelf: 'center',
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 2,
  },
  rule: {
    height: 1,
  },
  modernRule: {
    width: 28,
    height: 1.5,
    borderRadius: 1,
    alignSelf: 'center',
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
