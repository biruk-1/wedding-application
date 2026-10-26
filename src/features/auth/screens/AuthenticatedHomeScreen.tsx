import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme/spacing';

/**
 * Minimal authenticated landing for Task 4.
 * Wedding dashboard / create-wedding workflow ships in a later milestone.
 */
export function AuthenticatedHomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState<string>('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled) {
        setDisplayName(data?.display_name?.trim() || user.email || 'there');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  async function onSignOut() {
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    if (result.ok) {
      router.replace('/');
    }
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <AppText variant="title" style={styles.title}>
          You are signed in
        </AppText>


        <AppText variant="body" color="textMuted" style={styles.subtitle}>
          Welcome{displayName ? `, ${displayName}` : ''}. Wedding planning tools arrive in the next
          milestone.
        </AppText>
        <Card style={styles.card}>
          <AppText variant="label" color="textMuted">
            Signed in as
          </AppText>
          <AppText variant="bodyMedium">{user?.email}</AppText>
        </Card>
        <Button label="Sign out" variant="secondary" loading={signingOut} onPress={() => void onSignOut()} />
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
  },
  subtitle: {
    textAlign: 'center',
  },
  card: {
    gap: spacing.sm,
  },
});
