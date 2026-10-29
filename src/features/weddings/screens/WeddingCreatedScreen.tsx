import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export function WeddingCreatedScreen() {
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <AppText variant="title" style={styles.title}>
          Wedding created
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.body}>
          Your wedding space is ready. You are the owner and can invite partners later.
        </AppText>
        <Button
          label="Go to dashboard"
          onPress={() => {
            if (!weddingId) {
              router.replace('/(app)' as Href);
              return;
            }
            router.replace(`/(app)/weddings/${weddingId}` as Href);
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: {
    textAlign: 'center',
    color: colors.text,
  },
  body: {
    textAlign: 'center',
  },
});
