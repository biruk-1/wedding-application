import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/layout/Screen';
import { WeddingTabBar, weddingTabBarInset } from '@/components/navigation/WeddingTabBar';
import { MarketplaceSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { ThemeDiscoverBanner } from '@/components/theme/ThemeDiscoverBanner';
import { AppText } from '@/components/ui/AppText';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { VendorCard } from '@/features/vendors/components/VendorCard';
import { VendorFilterBar } from '@/features/vendors/components/VendorFilterBar';
import { useVendorMarketplace } from '@/features/vendors/hooks/useVendorMarketplace';
import type { VendorListItem } from '@/features/vendors/types';
import { useWedding } from '@/features/weddings/queries';
import { spacing } from '@/theme/spacing';
import { useColors } from '@/theme/WeddingThemeContext';

export function MarketplaceScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabInset = weddingTabBarInset(insets.bottom);
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const wedding = useWedding(weddingId);
  const marketplace = useVendorMarketplace(wedding.data?.celebration_kind);

  const vendors = marketplace.filtered;

  const renderItem = useCallback(
    ({ item }: { item: VendorListItem }) => (
      <VendorCard
        vendor={item}
        onPress={() =>
          router.push(`/(app)/weddings/${weddingId}/vendors/${item.id}` as Href)
        }
      />
    ),
    [router, weddingId],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <SectionHeading title="Marketplace" />
        <AppText variant="caption" color="textMuted" style={styles.subtitle}>
          {wedding.data?.title
            ? `Vendors for ${wedding.data.title}`
            : 'Discover wedding vendors'}
        </AppText>
        <ThemeDiscoverBanner
          title="Discover vendors"
          subtitle={
            marketplace.personalization?.context ??
            'Photography, venues and planners matched to your celebration'
          }
          ctaLabel="Explore all"
          onPress={() => marketplace.setFilters({ ...marketplace.filters, categoryId: null })}
        />
        {marketplace.personalization ? (
          <View style={styles.recommendations}>
            <AppText variant="caption" color="textMuted">
              {marketplace.personalization.context}. Recommended matches appear first.
            </AppText>
            {marketplace.recommendedCategories.length > 0 ? (
              <View style={styles.recommendationButtons}>
                {marketplace.recommendedCategories.map((category) => (
                  <Button
                    key={category.id}
                    label={category.name_en}
                    size="compact"
                    fullWidth={false}
                    variant={
                      marketplace.filters.categoryId === category.id
                        ? 'success'
                        : 'secondary'
                    }
                    onPress={() =>
                      marketplace.setFilters({
                        ...marketplace.filters,
                        categoryId:
                          marketplace.filters.categoryId === category.id
                            ? null
                            : category.id,
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {marketplace.error ? (
          <View style={styles.errorBlock}>
            <AppText variant="caption" color="danger">
              {marketplace.error.message}
            </AppText>
            <Button label="Retry" size="compact" variant="secondary" onPress={marketplace.refresh} />
          </View>
        ) : null}
        <SearchField
          value={marketplace.filters.query}
          onChangeText={(query) => marketplace.setFilters({ ...marketplace.filters, query })}
          placeholder="Search vendors..."
          accessibilityLabel="Search vendors"
          containerStyle={styles.search}
        />
        <VendorFilterBar
          filters={marketplace.filters}
          onChange={marketplace.setFilters}
          categories={marketplace.categories}
          cities={marketplace.cities}
          onReset={marketplace.resetFilters}
          hasActiveFilters={marketplace.hasActiveFilters}
          hideSearch
        />
        {vendors.length > 0 ? (
          <AppText variant="caption" color="textMuted" style={styles.count}>
            {vendors.length} vendor{vendors.length === 1 ? '' : 's'}
          </AppText>
        ) : null}
      </View>
    ),
    [wedding.data?.title, marketplace, vendors.length],
  );

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
      <Screen scroll>
        <StatusBar style="dark" />
        <AppText variant="title" color="heading" style={styles.loadingTitle}>
          Marketplace
        </AppText>
        <MarketplaceSkeleton />
      </Screen>
    );
  }

  const empty =
    marketplace.vendors.length === 0 && !marketplace.error ? (
      <EmptyState
        icon="storefront-outline"
        title="No vendors published yet"
        description="Published, verified vendors will appear here once listings go live."
      />
    ) : (
      <EmptyState
        icon="search-outline"
        title="No matching vendors"
        description="Try another category, city, or price range."
        action={<Button label="Reset filters" variant="secondary" onPress={marketplace.resetFilters} />}
      />
    );

  return (
    <View style={styles.root}>
      <Screen padded={false}>
        <StatusBar style="dark" />
        <FlatList
          data={vendors}
          keyExtractor={(vendor) => vendor.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={empty}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={[styles.content, { paddingBottom: tabInset }]}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={marketplace.refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      </Screen>
      <View style={styles.tabBar}>
        <WeddingTabBar weddingId={weddingId} />
      </View>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerBlock: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  recommendations: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  recommendationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  errorBlock: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  search: {
    marginBottom: spacing.sm,
  },
  count: {
    marginTop: spacing.sm,
  },
  loadingTitle: {
    marginBottom: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
});
