import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AuthScreenSkeleton } from '@/components/ui/Skeleton';
import { VendorCard } from '@/features/vendors/components/VendorCard';
import { VendorFilterBar } from '@/features/vendors/components/VendorFilterBar';
import { useVendorMarketplace } from '@/features/vendors/hooks/useVendorMarketplace';
import { spacing } from '@/theme/spacing';

export function MarketplaceScreen() {
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const marketplace = useVendorMarketplace();

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (marketplace.isLoading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AuthScreenSkeleton />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header
        title="Marketplace"
        subtitle="Discover wedding vendors"
        showBack
        onBack={() => router.replace(`/(app)/weddings/${weddingId}` as Href)}
      />

      {marketplace.error ? (
        <View style={styles.block}>
          <AppText color="danger" style={styles.center}>
            {marketplace.error.message}
          </AppText>
          <Button label="Retry" onPress={marketplace.refresh} />
        </View>
      ) : null}

      <VendorFilterBar
        filters={marketplace.filters}
        onChange={marketplace.setFilters}
        categories={marketplace.categories}
        cities={marketplace.cities}
        onReset={marketplace.resetFilters}
        hasActiveFilters={marketplace.hasActiveFilters}
      />

      {marketplace.vendors.length === 0 && !marketplace.error ? (
        <View style={styles.empty}>
          <AppText variant="subtitle" style={styles.center}>
            No vendors published yet
          </AppText>
          <AppText variant="body" color="textMuted" style={styles.center}>
            Published, verified vendors will appear here. Categories are ready when listings go live.
          </AppText>
        </View>
      ) : marketplace.filtered.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="subtitle" style={styles.center}>
            No matching vendors
          </AppText>
          <AppText variant="body" color="textMuted" style={styles.center}>
            Try another category, city, or price range.
          </AppText>
          <Button label="Reset filters" variant="secondary" onPress={marketplace.resetFilters} />
        </View>
      ) : (
        <View style={styles.list}>
          <AppText variant="caption" color="textMuted">
            {marketplace.filtered.length} vendor
            {marketplace.filtered.length === 1 ? '' : 's'}
            {marketplace.filters.categoryId
              ? ` in ${
                  marketplace.categories.find((c) => c.id === marketplace.filters.categoryId)
                    ?.name_en ?? 'category'
                }`
              : ''}
          </AppText>
          {marketplace.filtered.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              onPress={() =>
                router.push(
                  `/(app)/weddings/${weddingId}/vendors/${vendor.id}` as Href,
                )
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  empty: {
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  list: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  center: {
    textAlign: 'center',
  },
});
