import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { BrandMark } from '@/components/brand/BrandMark';
import { Screen } from '@/components/layout/Screen';
import { VendorCardSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { VendorCard } from '@/features/vendors/components/VendorCard';
import { VendorFilterBar } from '@/features/vendors/components/VendorFilterBar';
import {
  sheetFilterCount,
  VendorFiltersSheet,
} from '@/features/vendors/components/VendorFiltersSheet';
import {
  usePublicServices,
  usePublicVendorCategories,
  usePublicVendorCities,
  usePublicVendorSearch,
} from '@/features/vendors/queries';
import type {
  PublicServiceListItem,
  VendorFilters,
  VendorListItem,
  VendorSort,
} from '@/features/vendors/types';
import {
  emptyFilters,
  formatMoney,
  priceUnitLabel,
  resolveMediaUrl,
} from '@/features/vendors/utils/vendorHelpers';
import { errorMessage } from '@/lib/query/queryError';
import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

const SORTS: { id: VendorSort; label: string }[] = [
  { id: 'name', label: 'A–Z' },
  { id: 'newest', label: 'Newest' },
];

const GRID_BREAKPOINT = 520;

export function exploreVendorHref(vendorId: string): Href {
  return `/explore-vendors/${vendorId}` as Href;
}

/** Public marketplace: browse verified vendors without an account. */
export function ExploreVendorsScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const [filters, setFilters] = useState<VendorFilters>(emptyFilters);
  const [sort, setSort] = useState<VendorSort>('name');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = usePublicVendorCategories();
  const cities = usePublicVendorCities();
  const services = usePublicServices(filters.categoryId);
  const search = usePublicVendorSearch(filters, sort);

  const numColumns = width >= GRID_BREAKPOINT ? 2 : 1;
  const cardLayout = numColumns > 1 ? 'grid' : 'row';
  const sheetCount = sheetFilterCount(filters);
  const hasActiveFilters = Boolean(
    filters.query.trim() ||
      filters.categoryId ||
      filters.city ||
      filters.minPrice != null ||
      filters.maxPrice != null,
  );
  const resetFilters = useCallback(() => setFilters(emptyFilters()), []);
  const resetSheetFilters = useCallback(() => {
    setFilters((current) => ({ ...current, city: null, minPrice: null, maxPrice: null }));
    setFiltersOpen(false);
  }, []);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const openVendor = useCallback(
    (vendorId: string) => router.push(exploreVendorHref(vendorId)),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: VendorListItem }) => (
      <View style={numColumns > 1 ? styles.gridItem : undefined}>
        <VendorCard vendor={item} layout={cardLayout} onPress={() => openVendor(item.id)} />
      </View>
    ),
    [openVendor, numColumns, cardLayout, styles.gridItem],
  );

  const onRefresh = useCallback(() => {
    search.refresh();
    void services.refetch();
    void categories.refetch();
    void cities.refetch();
  }, [search, services, categories, cities]);

  const serviceItems = services.data ?? [];
  const showServices =
    !filters.query.trim() &&
    !filters.city &&
    filters.minPrice == null &&
    filters.maxPrice == null &&
    serviceItems.length > 0;

  const resultLabel = useMemo(() => {
    const count = search.vendors.length;
    if (search.isLoading && count === 0) return 'Loading vendors…';
    if (count === 0) return 'No vendors';
    if (search.hasNextPage) return `Showing ${count}+ vendors`;
    return `${count} vendor${count === 1 ? '' : 's'}`;
  }, [search.vendors.length, search.isLoading, search.hasNextPage]);

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kiburan home"
          hitSlop={8}
          onPress={goBack}
          style={styles.brand}>
          <BrandMark size={22} color={colors.primary} />
          <AppText variant="label" color="heading">
            Kiburan
          </AppText>
        </Pressable>
        {session ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.replace('/(app)' as Href)}
            style={styles.authLink}>
            <AppText variant="label" color="success">
              My plans
            </AppText>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/login')}
            style={styles.authLink}>
            <AppText variant="label" color="success">
              Sign in
            </AppText>
          </Pressable>
        )}
      </View>

      <AppText variant="title" color="heading" accessibilityRole="header">
        Explore vendors
      </AppText>
      <AppText variant="caption" color="textMuted">
        Discover trusted vendors for your celebration. Browse freely — no account needed.
      </AppText>

      {!session ? (
        <View style={styles.planCard}>
          <View style={styles.planCopy}>
            <AppText variant="bodyMedium" color="heading">
              Planning a celebration?
            </AppText>
            <AppText variant="caption" color="textMuted">
              Save vendors and send inquiries from your plan.
            </AppText>
          </View>
          <Button
            label="Start Planning"
            size="compact"
            fullWidth={false}
            onPress={() => router.push('/register')}
          />
        </View>
      ) : null}

      <SearchField
        value={filters.query}
        onChangeText={(query) => setFilters((current) => ({ ...current, query }))}
        onClear={() => setFilters((current) => ({ ...current, query: '' }))}
        placeholder="Search vendors, services, cities…"
        accessibilityLabel="Search vendors"
        returnKeyType="search"
      />

      {categories.error ? (
        <AppText variant="caption" color="danger">
          {errorMessage(categories.error, 'Could not load categories.')}
        </AppText>
      ) : null}

      <VendorFilterBar
        filters={filters}
        onChange={setFilters}
        categories={categories.data ?? []}
        cities={cities.data ?? []}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        priceLabel="Price range"
        hideSearch
        categoriesOnly
        filterCount={sheetCount}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      {showServices ? (
        <View style={styles.servicesBlock}>
          <AppText variant="label" color="heading">
            Browse by service
          </AppText>
          <AppText variant="caption" color="textMuted">
            Opens the vendor behind each listing.
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.servicesRail}>
            {serviceItems.map((service) => (
              <ServiceTile
                key={service.id}
                service={service}
                onPress={() => openVendor(service.vendor.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.listTitleRow}>
        <AppText variant="label" color="heading">
          {resultLabel}
        </AppText>
        <View style={styles.sorts}>
          {SORTS.map((option) => {
            const selected = sort === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSort(option.id)}
                style={[styles.sortChip, selected && styles.sortChipSelected]}>
                <AppText variant="caption" color={selected ? 'success' : 'textMuted'}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      {search.isUpdating && search.vendors.length > 0 ? (
        <ActivityIndicator color={colors.primary} style={styles.updating} />
      ) : null}
      {search.refreshError ? (
        <AppText variant="caption" color="danger">
          {errorMessage(search.refreshError, 'Could not refresh vendors.')}
        </AppText>
      ) : null}
    </View>
  );

  const empty = search.isLoading ? (
    <View style={styles.skeletons} accessibilityLabel="Loading vendors">
      <VendorCardSkeleton />
      <VendorCardSkeleton />
      <VendorCardSkeleton />
    </View>
  ) : search.error ? (
    <EmptyState
      icon="cloud-offline-outline"
      title="Couldn't load vendors"
      description={errorMessage(search.error, 'Check your connection and try again.')}
      action={<Button label="Retry" variant="secondary" onPress={search.refresh} />}
    />
  ) : hasActiveFilters ? (
    <EmptyState
      icon="search-outline"
      title="No matching vendors"
      description="Try another search, category, city, or price range."
      action={<Button label="Reset filters" variant="secondary" onPress={resetFilters} />}
    />
  ) : (
    <EmptyState
      icon="storefront-outline"
      title="No vendors published yet"
      description="Verified vendors will appear here once their listings go live."
    />
  );

  const footer = useMemo(() => {
    if (search.isFetchingNextPage) {
      return <ActivityIndicator color={colors.primary} style={styles.footer} />;
    }
    if (search.nextPageError) {
      return (
        <View style={styles.footer}>
          <Button
            label="Load more"
            variant="secondary"
            size="compact"
            onPress={search.fetchNextPage}
          />
        </View>
      );
    }
    return null;
  }, [search.isFetchingNextPage, search.nextPageError, search.fetchNextPage, colors.primary, styles]);

  return (
    <Screen padded={false}>
      <StatusBar style="dark" />
      <FlatList
        key={`explore-${numColumns}`}
        data={search.vendors}
        keyExtractor={(vendor) => vendor.id}
        renderItem={renderItem}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        ListFooterComponent={footer ?? undefined}
        ItemSeparatorComponent={numColumns === 1 ? Separator : undefined}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={search.fetchNextPage}
        onEndReachedThreshold={0.5}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={search.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
      <VendorFiltersSheet
        visible={filtersOpen}
        cities={cities.data ?? []}
        values={{
          city: filters.city,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
        }}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters((current) => ({ ...current, ...next }));
          setFiltersOpen(false);
        }}
        onReset={resetSheetFilters}
      />
    </Screen>
  );
}

function ServiceTile({
  service,
  onPress,
}: {
  service: PublicServiceListItem;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const image = resolveMediaUrl(service.vendor.cover_url) ?? resolveMediaUrl(service.vendor.logo_url);
  const price = formatMoney(service.base_price, service.currency_code);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${service.title} by ${service.vendor.business_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.serviceTile, pressed && styles.pressed]}>
      {image ? (
        <Image
          source={{ uri: image }}
          style={styles.serviceImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={service.id}
        />
      ) : (
        <View style={[styles.serviceImage, styles.serviceImageFallback]}>
          <Ionicons name="pricetag-outline" size={20} color={colors.textSubtle} />
        </View>
      )}
      <View style={styles.serviceBody}>
        <AppText variant="bodyMedium" color="heading" numberOfLines={1}>
          {service.title}
        </AppText>
        <AppText variant="caption" color="primary" numberOfLines={1}>
          {service.vendor.business_name}
        </AppText>
        <AppText variant="caption" color={price ? 'text' : 'textSubtle'} numberOfLines={1}>
          {price ? `${price} · ${priceUnitLabel(service.price_unit)}` : 'Price on request'}
        </AppText>
      </View>
    </Pressable>
  );
}

function Separator() {
  return <View style={separatorStyle.separator} />;
}

const separatorStyle = StyleSheet.create({
  separator: { height: spacing.md },
});

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing['2xl'],
    },
    headerBlock: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
      minHeight: 40,
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    authLink: {
      minWidth: 40,
      alignItems: 'flex-end',
      paddingVertical: spacing.sm,
    },
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      marginVertical: spacing.xs,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.primaryMuted,
      backgroundColor: colors.surfaceElevated,
    },
    planCopy: {
      flex: 1,
      gap: 2,
    },
    servicesBlock: {
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    servicesRail: {
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    serviceTile: {
      width: 180,
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    pressed: {
      opacity: 0.92,
    },
    serviceImage: {
      width: '100%',
      height: 96,
      backgroundColor: colors.surfaceMuted,
    },
    serviceImageFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceBody: {
      gap: 2,
      padding: spacing.md,
    },
    listTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      gap: spacing.md,
    },
    sorts: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    sortChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    sortChipSelected: {
      borderColor: colors.success,
      backgroundColor: colors.successMuted,
    },
    updating: {
      alignSelf: 'center',
    },
    skeletons: {
      gap: spacing.md,
    },
    footer: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    gridRow: {
      gap: spacing.md,
    },
    gridItem: {
      flex: 1,
      marginBottom: spacing.md,
    },
  });
}
