import type { VendorFilters, VendorListItem, VendorMedia } from '@/features/vendors/types';

export function formatMoney(
  amount: number | null | undefined,
  currencyCode = 'ETB',
): string | null {
  if (amount == null || Number.isNaN(amount)) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString()}`;
  }
}

export function formatStartingPrice(
  starting: VendorListItem['startingPrice'],
): string | null {
  if (!starting) return null;
  const money = formatMoney(starting.amount, starting.currencyCode);
  if (!money) return null;
  if (starting.priceUnit && starting.priceUnit !== 'package' && starting.priceUnit !== 'custom') {
    return `From ${money} / ${starting.priceUnit}`;
  }
  return `From ${money}`;
}

export function priceUnitLabel(unit: string): string {
  switch (unit) {
    case 'package':
      return 'per package';
    case 'hour':
      return 'per hour';
    case 'day':
      return 'per day';
    case 'person':
      return 'per person';
    case 'item':
      return 'per item';
    case 'custom':
      return 'custom pricing';
    default:
      return unit;
  }
}

/** Prefer https cover/logo URLs; treat storage_path as displayable only when already a URL. */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

export function vendorCoverUrl(vendor: {
  cover_url: string | null;
  logo_url: string | null;
  media?: VendorMedia[];
}): string | null {
  const cover = resolveMediaUrl(vendor.cover_url);
  if (cover) return cover;
  const logo = resolveMediaUrl(vendor.logo_url);
  if (logo) return logo;
  const firstImage = vendor.media
    ?.filter((item) => item.media_type === 'image')
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  return resolveMediaUrl(firstImage?.storage_path);
}

export function parseInclusions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'label' in item && typeof item.label === 'string') {
        return item.label.trim();
      }
      return '';
    })
    .filter(Boolean);
}

export function filterVendors(
  vendors: VendorListItem[],
  filters: VendorFilters,
): VendorListItem[] {
  const q = filters.query.trim().toLowerCase();
  return vendors.filter((vendor) => {
    if (filters.categoryId) {
      const inCategory = vendor.categories.some((c) => c.id === filters.categoryId);
      if (!inCategory) return false;
    }
    if (filters.city) {
      const city = vendor.city?.trim().toLowerCase() ?? '';
      if (city !== filters.city.trim().toLowerCase()) return false;
    }
    if (q) {
      const haystack = [
        vendor.business_name,
        vendor.description ?? '',
        vendor.city ?? '',
        ...vendor.categories.map((c) => c.name_en),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    const amount = vendor.startingPrice?.amount ?? null;
    if (filters.minPrice != null) {
      if (amount == null || amount < filters.minPrice) return false;
    }
    if (filters.maxPrice != null) {
      if (amount == null || amount > filters.maxPrice) return false;
    }
    return true;
  });
}

export function uniqueCities(vendors: VendorListItem[]): string[] {
  const set = new Set<string>();
  for (const vendor of vendors) {
    const city = vendor.city?.trim();
    if (city) set.add(city);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function emptyFilters(): VendorFilters {
  return {
    query: '',
    categoryId: null,
    city: null,
    minPrice: null,
    maxPrice: null,
  };
}
