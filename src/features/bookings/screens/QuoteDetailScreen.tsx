import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useAcceptQuote, useWeddingQuote } from '@/features/bookings/queries';
import { quoteStatusLabel } from '@/features/bookings/utils/paymentHelpers';
import { formatMoney } from '@/features/budget/utils/money';
import { useWeddingAccess } from '@/features/team/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function QuoteDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { weddingId, quoteId } = useLocalSearchParams<{ weddingId: string; quoteId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/quotes`);
  const quoteQuery = useWeddingQuote(weddingId, quoteId);
  const accept = useAcceptQuote(weddingId ?? '');
  const { can } = useWeddingAccess(weddingId);
  const [formError, setFormError] = useState<string | null>(null);

  const canAccept = can('vendors.manage');

  async function onAccept() {
    if (!quoteId || accept.isPending) return;
    setFormError(null);
    try {
      const result = await accept.mutateAsync(quoteId);
      router.replace(
        `/(app)/weddings/${weddingId}/bookings/${result.booking_id}` as Href,
      );
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  if (!weddingId || !quoteId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing quote.</AppText>
      </Screen>
    );
  }

  if (quoteQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title="Quote" showBack onBack={goBack} />
        <FormSkeleton fields={5} />
      </Screen>
    );
  }

  if (!quoteQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Quote" showBack onBack={goBack} />
        <AppText color="danger">{errorMessage(quoteQuery.error) || 'Quote not found.'}</AppText>
      </Screen>
    );
  }

  const quote = quoteQuery.data;
  const vendorName = quote.inquiry?.vendor?.business_name ?? 'Vendor';
  const open = quote.status === 'sent';

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header title="Quote details" showBack onBack={goBack} />

      <View style={styles.card}>
        <AppText variant="caption" color="textMuted">
          From
        </AppText>
        <AppText variant="subtitle" color="heading">
          {vendorName}
        </AppText>
        <AppText variant="caption" color="textMuted" style={styles.meta}>
          {quoteStatusLabel(quote.status)}
          {quote.valid_until ? ` · Valid until ${quote.valid_until}` : ''}
        </AppText>
      </View>

      <View style={styles.card}>
        <AppText variant="caption" color="textMuted">
          Amount
        </AppText>
        <AppText variant="title" color="heading">
          {formatMoney(quote.amount, quote.currency_code)}
        </AppText>
        {quote.description ? (
          <AppText variant="body" color="text" style={styles.description}>
            {quote.description}
          </AppText>
        ) : null}
      </View>

      {formError ? (
        <AppText color="danger" style={styles.error}>
          {formError}
        </AppText>
      ) : null}

      {open && canAccept ? (
        <Button
          label="Accept quote & create booking"
          loading={accept.isPending}
          onPress={() => void onAccept()}
        />
      ) : null}

      {open && !canAccept ? (
        <AppText variant="caption" color="textMuted">
          You need vendor manage permission to accept quotes.
        </AppText>
      ) : null}

      {!open && quote.status === 'accepted' ? (
        <Button
          label="View bookings"
          variant="secondary"
          onPress={() => router.push(`/(app)/weddings/${weddingId}/bookings` as Href)}
        />
      ) : null}
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      gap: spacing.xs,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    meta: {
      marginTop: spacing.xs,
    },
    description: {
      marginTop: spacing.sm,
    },
    error: {
      marginBottom: spacing.md,
    },
  });
}
