import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import {
  clearPendingVendorAction,
  loadPendingVendorAction,
  peekPendingVendorAction,
  type PendingVendorAction,
} from '@/features/vendors/services/pendingVendorAction';
import { getCelebrationCopy } from '@/features/weddings/celebrationCopy';
import { useWedding } from '@/features/weddings/queries';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function WeddingCreatedScreen() {
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const wedding = useWedding(weddingId).data;
  const copy = getCelebrationCopy(wedding?.celebration_kind);
  const styles = useThemedStyles(createStyles);
  const [vendorAction, setVendorAction] = useState<PendingVendorAction | null>(
    peekPendingVendorAction(),
  );

  useEffect(() => {
    let cancelled = false;
    void loadPendingVendorAction().then((action) => {
      if (!cancelled) setVendorAction(action);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <AppText variant="title" style={styles.title}>
          {copy.successTitle}
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.body}>
          {copy.successBody}
        </AppText>
        {vendorAction && weddingId ? (
          <Button
            label={`Continue with ${vendorAction.vendorName || 'your vendor'}`}
            onPress={() =>
              router.replace(`/(app)/vendor-action?weddingId=${weddingId}` as Href)
            }
          />
        ) : null}
        <Button
          label="Go to dashboard"
          variant={vendorAction ? 'secondary' : 'primary'}
          onPress={() => {
            if (vendorAction) void clearPendingVendorAction();
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

function createStyles(colors: AppColors) {
  return StyleSheet.create({
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
}
