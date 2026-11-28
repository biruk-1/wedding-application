import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { ExpenseListSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { useWeddingQuotes } from '@/features/bookings/queries';
import type { QuoteListItem } from '@/features/bookings/types';
import { quoteStatusLabel } from '@/features/bookings/utils/paymentHelpers';
import { formatMoney } from '@/features/budget/utils/money';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function QuotesScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/vendors`);
  const quotesQuery = useWeddingQuotes(weddingId);

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <Header title="Vendor quotes" showBack onBack={goBack} />
      <AppText variant="caption" color="textMuted" style={styles.hint}>
        Review vendor offers, then accept to create a booking you can pay with Chapa.
      </AppText>

      {quotesQuery.isPending ? (
        <ExpenseListSkeleton rows={4} />
      ) : quotesQuery.error ? (
        <AppText color="danger">{errorMessage(quotesQuery.error)}</AppText>
      ) : (
        <FlatList
          data={quotesQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={quotesQuery.isRefetching}
              onRefresh={() => void quotesQuery.refetch()}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="No quotes yet"
              description="When a vendor replies to your inquiry with a quote, it will show up here."
            />
          }
          renderItem={({ item }) => (
            <QuoteRow
              quote={item}
              onPress={() =>
                router.push(`/(app)/weddings/${weddingId}/quotes/${item.id}` as Href)
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

function QuoteRow({ quote, onPress }: { quote: QuoteListItem; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  const vendorName = quote.inquiry?.vendor?.business_name ?? 'Vendor';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <AppText variant="body" color="heading" numberOfLines={1}>
          {vendorName}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {quoteStatusLabel(quote.status)}
        </AppText>
      </View>
      <AppText variant="body" color="heading" style={styles.amount}>
        {formatMoney(quote.amount, quote.currency_code)}
      </AppText>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    hint: {
      marginBottom: spacing.md,
    },
    list: {
      paddingBottom: spacing['2xl'],
      gap: spacing.sm,
      flexGrow: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    pressed: {
      opacity: 0.92,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    amount: {
      fontWeight: '600',
    },
  });
}
