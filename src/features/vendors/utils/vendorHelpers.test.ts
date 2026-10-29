import { describe, expect, it } from 'vitest';

import type { VendorListItem } from '@/features/vendors/types';
import {
  emptyFilters,
  filterVendors,
  formatMoney,
  formatStartingPrice,
  parseInclusions,
  resolveMediaUrl,
  uniqueCities,
} from '@/features/vendors/utils/vendorHelpers';

function vendor(partial: Partial<VendorListItem> & Pick<VendorListItem, 'id' | 'business_name'>): VendorListItem {
  return {
    owner_user_id: 'o',
    slug: partial.business_name.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    phone: null,
    email: null,
    website_url: null,
    instagram_url: null,
    city: null,
    country_code: 'ET',
    address: null,
    logo_url: null,
    cover_url: null,
    verification_status: 'verified',
    listing_status: 'published',
    created_at: '',
    updated_at: '',
    categories: [],
    startingPrice: null,
    ...partial,
  };
}

describe('vendorHelpers', () => {
  it('formats money and starting prices', () => {
    expect(formatMoney(null)).toBeNull();
    expect(formatMoney(45000, 'ETB')).toContain('45');
    expect(
      formatStartingPrice({ amount: 45000, currencyCode: 'ETB', priceUnit: 'package' }),
    ).toMatch(/^From /);
    expect(
      formatStartingPrice({ amount: 850, currencyCode: 'ETB', priceUnit: 'person' }),
    ).toContain('person');
  });

  it('only resolves http(s) media paths', () => {
    expect(resolveMediaUrl('https://cdn.example/a.jpg')).toBe('https://cdn.example/a.jpg');
    expect(resolveMediaUrl('vendors/a/cover.jpg')).toBeNull();
    expect(resolveMediaUrl(null)).toBeNull();
  });

  it('parses package inclusions', () => {
    expect(parseInclusions(['Arch', 'Bouquet'])).toEqual(['Arch', 'Bouquet']);
    expect(parseInclusions([{ label: 'Suite' }])).toEqual(['Suite']);
    expect(parseInclusions(null)).toEqual([]);
  });

  it('filters by query, category, city, and price', () => {
    const list = [
      vendor({
        id: '1',
        business_name: 'Lumen Studio',
        city: 'Addis Ababa',
        categories: [{ id: 'photo', slug: 'photographer', name_en: 'Photographer' }],
        startingPrice: { amount: 45000, currencyCode: 'ETB', priceUnit: 'package' },
      }),
      vendor({
        id: '2',
        business_name: 'Garden Court',
        city: 'Bahir Dar',
        categories: [{ id: 'venue', slug: 'venue', name_en: 'Venue' }],
        startingPrice: { amount: 120000, currencyCode: 'ETB', priceUnit: 'day' },
      }),
    ];

    expect(filterVendors(list, { ...emptyFilters(), query: 'lumen' })).toHaveLength(1);
    expect(filterVendors(list, { ...emptyFilters(), categoryId: 'venue' })).toHaveLength(1);
    expect(filterVendors(list, { ...emptyFilters(), city: 'Addis Ababa' })).toHaveLength(1);
    expect(filterVendors(list, { ...emptyFilters(), maxPrice: 50000 })).toHaveLength(1);
    expect(filterVendors(list, { ...emptyFilters(), minPrice: 100000 })).toHaveLength(1);
    expect(filterVendors(list, { ...emptyFilters(), query: 'zzz' })).toHaveLength(0);
    expect(uniqueCities(list)).toEqual(['Addis Ababa', 'Bahir Dar']);
  });
});
