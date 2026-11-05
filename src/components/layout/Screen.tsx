import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedBackground } from '@/components/theme/ThemedBackground';
import { useColors } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';

export type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  backgroundColor?: string;
  themedBackdrop?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'right', 'bottom', 'left'],
  backgroundColor,
  themedBackdrop = true,
  style,
  contentStyle,
  keyboardAvoiding = true,
}: ScreenProps) {
  const colors = useColors();
  const surface = backgroundColor ?? colors.surface;

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.grow, padded && styles.padded, contentStyle]}
      style={styles.flex}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, contentStyle]}>{children}</View>
  );

  const content = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: surface }, style]}>
      {themedBackdrop ? <ThemedBackground /> : null}
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  padded: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
});
