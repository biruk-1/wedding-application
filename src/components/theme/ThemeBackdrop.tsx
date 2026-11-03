import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { TibebMotif } from '@/components/theme/TibebMotif';
import { useColors, useDecorations } from '@/theme/WeddingThemeContext';

type ThemeBackdropProps = {
  style?: StyleProp<ViewStyle>;
  variant?: 'screen' | 'plain';
};

/** Subtle themed backdrop — never placed behind form fields directly (wrap Screen instead). */
export function ThemeBackdrop({ style, variant = 'screen' }: ThemeBackdropProps) {
  const colors = useColors();
  const decorations = useDecorations();

  if (variant === 'plain' || decorations.backdropPatternOpacity <= 0) {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }, style]}
      />
    );
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient
        colors={[colors.surface, colors.surfaceMuted, colors.surface]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <TibebMotif intensity={decorations.backdropPatternOpacity * 12} />
    </View>
  );
}
