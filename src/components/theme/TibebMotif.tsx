import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@/theme/WeddingThemeContext';

type TibebMotifProps = {
  style?: StyleProp<ViewStyle>;
  /** 0–1 opacity multiplier on top of theme backdrop opacity. */
  intensity?: number;
};

/**
 * Lightweight geometric motif inspired by Tibeb embroidery lines — used as a subtle backdrop only.
 */
export function TibebMotif({ style, intensity = 1 }: TibebMotifProps) {
  const colors = useColors();
  const line = colors.primary;
  const accent = colors.success;
  const alpha = 0.35 * intensity;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} accessibilityElementsHidden>
      <View style={[styles.hLine, { backgroundColor: line, opacity: alpha * 0.5, top: '12%' }]} />
      <View style={[styles.hLine, { backgroundColor: line, opacity: alpha * 0.35, top: '88%' }]} />
      <View style={[styles.vLine, { backgroundColor: accent, opacity: alpha * 0.4, left: '8%' }]} />
      <View style={[styles.vLine, { backgroundColor: accent, opacity: alpha * 0.4, right: '8%' }]} />
      <View style={[styles.diamond, { borderColor: line, opacity: alpha * 0.55, top: '18%', left: '14%' }]} />
      <View style={[styles.diamond, { borderColor: accent, opacity: alpha * 0.45, bottom: '22%', right: '12%' }]} />
      <View style={[styles.step, { borderColor: line, opacity: alpha * 0.4, top: '42%', right: '20%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hLine: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    height: StyleSheet.hairlineWidth,
  },
  vLine: {
    position: 'absolute',
    top: '10%',
    bottom: '10%',
    width: StyleSheet.hairlineWidth,
  },
  diamond: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '45deg' }],
  },
  step: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
});
