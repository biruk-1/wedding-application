import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useColors } from '@/theme/WeddingThemeContext';

export type BrandMarkProps = ViewProps & {
  size?: number;
  color?: string;
};

/**
 * Approximates the gold interlaced monogram from the Kiburan reference sheet.
 * Replace with the official SVG asset when available.
 */
export function BrandMark({ size = 56, color, style, ...rest }: BrandMarkProps) {
  const colors = useColors();
  const markColor = color ?? colors.primary;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Kiburan mark"
      style={[styles.wrap, { width: size, height: size }, style]}
      {...rest}>
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <Circle cx="32" cy="32" r="30" stroke={markColor} strokeWidth="1.5" opacity={0.55} />
        <Path
          d="M22 18c0 10 6 14 10 18-4 4-10 8-10 18"
          stroke={markColor}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <Path
          d="M42 18c0 10-6 14-10 18 4 4 10 8 10 18"
          stroke={markColor}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <Path
          d="M26 32h12"
          stroke={markColor}
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.85}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
