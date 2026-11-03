import type { CategoryRef, VendorListItem } from '@/features/vendors/types';
import type { CelebrationKind } from '@/features/weddings/types';

export type ExistingVendorCategorySlug =
  | 'photographer'
  | 'videographer'
  | 'florist'
  | 'caterer'
  | 'venue'
  | 'dj'
  | 'makeup'
  | 'planner'
  | 'cake'
  | 'transport';

export type VendorPersonalization = {
  context: string;
  preferredCategorySlugs: readonly ExistingVendorCategorySlug[];
};

export const VENDOR_PERSONALIZATION = {
  wedding: {
    context: 'Popular services for your wedding',
    preferredCategorySlugs: ['planner', 'venue', 'photographer', 'caterer', 'florist'],
  },
  shemgelena: {
    context: 'Helpful services for your Shemgelena',
    preferredCategorySlugs: ['venue', 'caterer', 'photographer', 'florist', 'transport'],
  },
  qelekel: {
    context: 'Popular services for your Qelekel',
    preferredCategorySlugs: ['caterer', 'venue', 'dj', 'photographer', 'cake'],
  },
  baby_shower: {
    context: 'Ideas for your baby shower',
    preferredCategorySlugs: ['cake', 'caterer', 'florist', 'photographer', 'venue'],
  },
  birthday: {
    context: 'Popular services for your birthday',
    preferredCategorySlugs: ['cake', 'caterer', 'dj', 'venue', 'photographer'],
  },
  anniversary: {
    context: 'Ideas for your anniversary',
    preferredCategorySlugs: ['venue', 'photographer', 'caterer', 'florist', 'cake'],
  },
  graduation: {
    context: 'Popular services for your graduation',
    preferredCategorySlugs: ['photographer', 'venue', 'caterer', 'cake', 'dj'],
  },
  other: {
    context: 'Services to help with your celebration',
    preferredCategorySlugs: ['venue', 'caterer', 'photographer', 'dj', 'cake'],
  },
} as const satisfies Record<CelebrationKind, VendorPersonalization>;

export function getVendorPersonalization(
  celebrationKind: string | null | undefined,
): VendorPersonalization | null {
  if (!celebrationKind || !(celebrationKind in VENDOR_PERSONALIZATION)) return null;
  return VENDOR_PERSONALIZATION[celebrationKind as CelebrationKind];
}

export function resolvePreferredCategorySlugs(
  celebrationKind: string | null | undefined,
): readonly ExistingVendorCategorySlug[] {
  return getVendorPersonalization(celebrationKind)?.preferredCategorySlugs ?? [];
}

export function resolveRecommendedCategories(
  celebrationKind: string | null | undefined,
  categories: readonly CategoryRef[],
): CategoryRef[] {
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));
  return resolvePreferredCategorySlugs(celebrationKind)
    .map((slug) => categoriesBySlug.get(slug))
    .filter((category): category is CategoryRef => Boolean(category));
}

export function resolvePreferredCategoryIds(
  celebrationKind: string | null | undefined,
  categories: readonly CategoryRef[],
): string[] {
  return resolveRecommendedCategories(celebrationKind, categories).map(
    (category) => category.id,
  );
}

export function rankVendorsByCategorySlugs(
  vendors: readonly VendorListItem[],
  preferredCategorySlugs: readonly string[],
): VendorListItem[] {
  const rankBySlug = new Map(
    preferredCategorySlugs.map((slug, index) => [slug, index]),
  );

  return vendors
    .map((vendor, originalIndex) => {
      const preferenceRank = vendor.categories.reduce((best, category) => {
        const rank = rankBySlug.get(category.slug);
        return rank == null ? best : Math.min(best, rank);
      }, Number.POSITIVE_INFINITY);
      return { vendor, originalIndex, preferenceRank };
    })
    .sort(
      (left, right) =>
        left.preferenceRank - right.preferenceRank ||
        left.originalIndex - right.originalIndex,
    )
    .map(({ vendor }) => vendor);
}

export function rankVendorsForCelebration(
  vendors: readonly VendorListItem[],
  celebrationKind: string | null | undefined,
): VendorListItem[] {
  return rankVendorsByCategorySlugs(
    vendors,
    resolvePreferredCategorySlugs(celebrationKind),
  );
}
