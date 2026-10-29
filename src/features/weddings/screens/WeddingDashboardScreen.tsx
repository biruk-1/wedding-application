import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AuthScreenSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { CountdownStrip } from '@/features/weddings/components/CountdownStrip';
import { getWeddingById } from '@/features/weddings/services/weddingService';
import type { Wedding } from '@/features/weddings/types';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export function WeddingDashboardScreen() {
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const { signOut } = useAuth();
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!weddingId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await getWeddingById(weddingId);
      if (cancelled) return;
      if (!result.ok) {
        setWedding(null);
        setError(result.error.message);
      } else {
        setWedding(result.data);
        setError(null);
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [weddingId, reloadToken]);

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Wedding" showBack onBack={() => router.replace('/(app)' as Href)} />
        <AppText variant="body" color="danger" style={styles.center}>
          Missing wedding id.
        </AppText>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AuthScreenSkeleton />
      </Screen>
    );
  }

  if (error || !wedding) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Wedding" showBack onBack={() => router.replace('/(app)' as Href)} />
        <View style={styles.centerBlock}>
          <AppText variant="body" color="danger" style={styles.center}>
            {error ?? 'Wedding unavailable.'}
          </AppText>
          <Button label="Retry" onPress={() => setReloadToken((value) => value + 1)} />
          <Button
            label="Back to home"
            variant="secondary"
            onPress={() => router.replace('/(app)' as Href)}
          />
        </View>
      </Screen>
    );
  }

  const dateLabel = formatWeddingDateLabel(wedding.wedding_date);
  const location = [wedding.city, wedding.country_code].filter(Boolean).join(', ');

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header
        title={wedding.title}
        subtitle={[dateLabel, location].filter(Boolean).join(' · ') || 'Add date and city anytime'}
        showBack
        onBack={() => router.replace('/(app)' as Href)}
      />

      <View style={styles.stack}>
        <Card style={styles.heroCard}>
          <AppText variant="caption" color="textMuted">
            Partners
          </AppText>
          <AppText variant="subtitle" style={styles.partners}>
            {wedding.partner_one_name} & {wedding.partner_two_name}
          </AppText>
          {wedding.style ? (
            <AppText variant="caption" color="primary" style={styles.styleTag}>
              {wedding.style}
            </AppText>
          ) : null}
        </Card>

        {wedding.wedding_date ? <CountdownStrip weddingDate={wedding.wedding_date} /> : null}

        <Card style={styles.nextCard}>
          <AppText variant="label">Checklist</AppText>
          <AppText variant="body" color="textMuted">
            Build your checklist — venue, catering, attire, and more.
          </AppText>
          <Button
            label="Open checklist"
            onPress={() => router.push(`/(app)/weddings/${wedding.id}/checklist` as Href)}
          />
        </Card>

        <Card style={styles.nextCard}>
          <AppText variant="label">Marketplace</AppText>
          <AppText variant="body" color="textMuted">
            Discover photographers, venues, caterers, and more for your day.
          </AppText>
          <Button
            label="Browse vendors"
            variant="success"
            onPress={() => router.push(`/(app)/weddings/${wedding.id}/vendors` as Href)}
          />
        </Card>

        <Button
          label="Switch wedding"
          variant="secondary"
          onPress={() => router.push('/(app)/weddings' as Href)}
        />
        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => {
            void signOut().then((result) => {
              if (result.ok) router.replace('/');
            });
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  heroCard: {
    gap: spacing.sm,
  },
  partners: {
    color: colors.text,
  },
  styleTag: {
    textTransform: 'capitalize',
  },
  nextCard: {
    gap: spacing.md,
  },
  centerBlock: {
    gap: spacing.lg,
    marginTop: spacing['2xl'],
  },
  center: {
    textAlign: 'center',
  },
});
