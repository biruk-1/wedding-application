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

export function exploreVendorHref(vendorId: string): Href {
  return `/explore-vendors/${vendorId}` as Href;
}

/** Public marketplace: browse verified vendors without an account. */
export function ExploreVendorsScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const router = useRouter();
  const { session } = useAuth();
  const [filters, setFilters] = useState<VendorFilters>(emptyFilters);
  const [sort, setSort] = useState<VendorSort>('name');

  const categories = usePublicVendorCategories();
  const cities = usePublicVendorCities();
  const services = usePublicServices(filters.categoryId);
  const search = usePublicVendorSearch(filters, sort);

  const hasActiveFilters = Boolean(
    filters.query.trim() ||
      filters.categoryId ||
      filters.city ||
      filters.minPrice != null ||
      filters.maxPrice != null,
  );
  const resetFilters = useCallback(() => setFilters(emptyFilters()), []);

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
      <VendorCard vendor={item} onPress={() => openVendor(item.id)} />
    ),
    [openVendor],
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

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={goBack}
          style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color={colors.success} />
        </Pressable>
        <View style={styles.brand}>
          <BrandMark size={22} color={colors.primary} />
          <AppText variant="label" color="heading">
            Kiburan
          </AppText>
        </View>
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
        Browse verified vendors on Kiburan. No account needed.
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
      />

      {showServices ? (
        <View style={styles.servicesBlock}>
          <AppText variant="label" color="heading">
            Services
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
          Verified vendors
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
        data={search.vendors}
        keyExtractor={(vendor) => vendor.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        ListFooterComponent={footer ?? undefined}
        ItemSeparatorComponent={Separator}
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
      paddingTop: spacing.md,
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
      marginBottom: spacing.sm,
    },
    iconButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
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
      marginVertical: spacing.sm,
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
      gap: spacing.sm,
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
  });
}
