import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { spacing } from '@/theme/spacing';

export function AuthFormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <AppText
      variant="caption"
      color="danger"
      accessibilityLiveRegion="polite"
      style={styles.text}>
      {message}
    </AppText>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
