import { describe, expect, it } from 'vitest';

import {
  VENDOR_PERSONALIZATION,
  rankVendorsByCategorySlugs,
  rankVendorsForCelebration,
  resolvePreferredCategoryIds,
  resolveRecommendedCategories,
  type ExistingVendorCategorySlug,
} from '@/features/vendors/config/vendorPersonalization';
import type { CategoryRef, VendorListItem } from '@/features/vendors/types';
import type { CelebrationKind } from '@/features/weddings/types';

const CELEBRATION_KINDS: CelebrationKind[] = [
  'wedding',
  'shemgelena',
  'qelekel',
  'baby_shower',
  'birthday',
  'anniversary',
  'graduation',
  'other',
];

const EXISTING_CATEGORY_SLUGS = new Set<ExistingVendorCategorySlug>([
  'photographer',
  'videographer',
  'florist',
  'caterer',
  'venue',
  'dj',
  'makeup',
  'planner',
  'cake',
  'transport',
]);

function category(id: string, slug = id): CategoryRef {
  return { id, slug, name_en: slug };
}

function vendor(id: string, categorySlugs: string[]): VendorListItem {
  return {
    id,
    business_name: id,
    slug: id,
    description: null,
    website_url: null,
    instagram_url: null,
    city: null,
    country_code: 'ET',
    logo_url: null,
    cover_url: null,
    categories: categorySlugs.map((slug) => category(slug)),
    startingPrice: null,
  };
}

describe('vendor personalization', () => {
  it('configures every celebration kind with existing category slugs', () => {
    expect(Object.keys(VENDOR_PERSONALIZATION).sort()).toEqual(
      [...CELEBRATION_KINDS].sort(),
    );

    for (const kind of CELEBRATION_KINDS) {
      expect(VENDOR_PERSONALIZATION[kind].preferredCategorySlugs.length).toBeGreaterThan(0);
      for (const slug of VENDOR_PERSONALIZATION[kind].preferredCategorySlugs) {
        expect(EXISTING_CATEGORY_SLUGS.has(slug)).toBe(true);
      }
    }
  });

  it('resolves configured slugs to available category IDs in preference order', () => {
    const categories = [
      category('unknown-id', 'new-db-category'),
      category('photo-id', 'photographer'),
      category('venue-id', 'venue'),
      category('planner-id', 'planner'),
    ];

    expect(resolvePreferredCategoryIds('wedding', categories)).toEqual([
      'planner-id',
      'venue-id',
      'photo-id',
    ]);
    expect(resolveRecommendedCategories('wedding', categories)).not.toContainEqual(
      categories[0],
    );
  });

  it('ranks preferred categories first while preserving stable order within ranks', () => {
    const vendors = [
      vendor('unknown-a', ['new-db-category']),
      vendor('caterer-a', ['caterer']),
      vendor('photographer', ['photographer']),
      vendor('caterer-b', ['caterer']),
      vendor('unknown-b', []),
    ];

    expect(
      rankVendorsByCategorySlugs(vendors, ['photographer', 'caterer']).map(
        (item) => item.id,
      ),
    ).toEqual([
      'photographer',
      'caterer-a',
      'caterer-b',
      'unknown-a',
      'unknown-b',
    ]);
  });

  it('tolerates unknown DB slugs and never loses vendors', () => {
    const vendors = [
      vendor('known', ['venue']),
      vendor('unknown', ['category-added-later']),
      vendor('uncategorized', []),
    ];

    const ranked = rankVendorsForCelebration(vendors, 'wedding');
    expect(ranked).toHaveLength(vendors.length);
    expect(new Set(ranked.map((item) => item.id))).toEqual(
      new Set(vendors.map((item) => item.id)),
    );
    expect(rankVendorsForCelebration(vendors, 'unexpected-kind')).toEqual(vendors);
  });
});
