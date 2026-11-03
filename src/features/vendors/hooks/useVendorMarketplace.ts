import { useEffect, useMemo, useState } from 'react';

import {
  getVendorPersonalization,
  rankVendorsForCelebration,
  resolveRecommendedCategories,
} from '@/features/vendors/config/vendorPersonalization';
import type { VendorUserMessage } from '@/features/vendors/services/vendorErrors';
import {
  listPublishedVendors,
  listVendorCategories,
} from '@/features/vendors/services/vendorService';
import type { VendorCategory, VendorFilters, VendorListItem } from '@/features/vendors/types';
import {
  emptyFilters,
  filterVendors,
  uniqueCities,
} from '@/features/vendors/utils/vendorHelpers';

export function useVendorMarketplace(celebrationKind?: string | null) {
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [filters, setFilters] = useState<VendorFilters>(emptyFilters);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<VendorUserMessage | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(filters.query), 250);
    return () => clearTimeout(handle);
  }, [filters.query]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      const [vendorsResult, categoriesResult] = await Promise.all([
        listPublishedVendors(),
        listVendorCategories(),
      ]);
      if (cancelled) return;

      if (!vendorsResult.ok) {
        setError(vendorsResult.error);
        setVendors([]);
      } else {
        setVendors(vendorsResult.data);
        setError(null);
      }

      if (categoriesResult.ok) {
        setCategories(categoriesResult.data);
      } else if (vendorsResult.ok) {
        setError(categoriesResult.error);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const activeFilters = useMemo(
    () => ({ ...filters, query: debouncedQuery }),
    [filters, debouncedQuery],
  );

  const filtered = useMemo(
    () =>
      rankVendorsForCelebration(
        filterVendors(vendors, activeFilters),
        celebrationKind,
      ),
    [vendors, activeFilters, celebrationKind],
  );

  const cities = useMemo(() => uniqueCities(vendors), [vendors]);
  const personalization = useMemo(
    () => getVendorPersonalization(celebrationKind),
    [celebrationKind],
  );
  const recommendedCategories = useMemo(
    () => resolveRecommendedCategories(celebrationKind, categories),
    [categories, celebrationKind],
  );

  return {
    vendors,
    filtered,
    categories,
    personalization,
    recommendedCategories,
    cities,
    filters,
    setFilters,
    isLoading,
    error,
    refresh: () => setReloadToken((value) => value + 1),
    resetFilters: () => setFilters(emptyFilters()),
    hasActiveFilters: Boolean(
      filters.query.trim() ||
        filters.categoryId ||
        filters.city ||
        filters.minPrice != null ||
        filters.maxPrice != null,
    ),
  };
}
