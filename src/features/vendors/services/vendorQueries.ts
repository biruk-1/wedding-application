import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CategoryRef,
  PublicReview,
  PublicServiceListItem,
  RatingSummary,
  StartingPrice,
  VendorCategory,
  VendorListItem,
  VendorPage,
  VendorProfile,
  VendorServerFilters,
} from '@/features/vendors/types';
import type { Database } from '@/types/database.types';

/**
 * Marketplace reads shared by the signed-in marketplace, the public Explore screens, and the
 * integration tests. Selects list columns explicitly: signed-out clients are granted only the
 * public vendor columns, so `select('*')` on `vendors` fails for them by design.
 */
type Client = SupabaseClient<Database>;
type DbError = { message?: string; code?: string };
export type QueryResult<T> = { data: T; error: null } | { data: null; error: DbError };

export const VENDOR_PAGE_SIZE = 20;
export const SERVICE_RAIL_SIZE = 12;
const MAX_MATCHED_VENDORS = 200;
const MAX_CITY_ROWS = 500;
const MAX_PAGE_REVIEWS = 1000;
const PROFILE_REVIEW_LIMIT = 50;

export const PUBLIC_VENDOR_COLUMNS =
  'id, slug, business_name, description, city, country_code, website_url, instagram_url, logo_url, cover_url';

const CATEGORY_EMBED =
  'categories:vendor_category_memberships ( category:vendor_categories ( id, slug, name_en ) )';

const LIST_SELECT = `${PUBLIC_VENDOR_COLUMNS},
  ${CATEGORY_EMBED},
  services:vendor_services ( title, base_price, currency_code, price_unit )`;

const SERVICE_COLUMNS =
  'id, vendor_id, category_id, title, description, base_price, currency_code, price_unit';

const PROFILE_SELECT = `${PUBLIC_VENDOR_COLUMNS},
  ${CATEGORY_EMBED},
  services:vendor_services ( ${SERVICE_COLUMNS}, created_at,
    packages:vendor_packages ( id, service_id, name, description, inclusions, price, currency_code ) )`;

type RawCategories = { category: CategoryRef | CategoryRef[] | null }[] | null;
type RawService = {
  title: string;
  base_price: number | null;
  currency_code: string;
  price_unit: string;
};

/** Up to three real service titles for list cards. */
export function serviceTitles(services: Pick<RawService, 'title'>[] | null): string[] {
  const titles: string[] = [];
  for (const service of services ?? []) {
    const title = service.title?.trim();
    if (!title || titles.includes(title)) continue;
    titles.push(title);
    if (titles.length >= 3) break;
  }
  return titles;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function flattenCategories(raw: RawCategories): CategoryRef[] {
  return (raw ?? [])
    .map((row) => one(row.category))
    .filter((category): category is CategoryRef => Boolean(category));
}

export function startingPrice(services: Pick<RawService, 'base_price' | 'currency_code' | 'price_unit'>[] | null): StartingPrice | null {
  let best: StartingPrice | null = null;
  for (const service of services ?? []) {
    if (service.base_price == null) continue;
    const amount = Number(service.base_price);
    if (!best || amount < best.amount) {
      best = { amount, currencyCode: service.currency_code, priceUnit: service.price_unit };
    }
  }
  return best;
}

export function summarizeRatings(ratings: number[]): RatingSummary | null {
  if (ratings.length === 0) return null;
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return { average: Math.round((total / ratings.length) * 10) / 10, count: ratings.length };
}

/**
 * Reduces free text to characters that are safe inside a PostgREST `or=(...)` filter
 * (no commas, parentheses, dots, quotes or wildcards) and turns word gaps into `%`, so
 * "lumen lace" still matches "Lumen & Lace".
 */
export function searchPattern(raw: string): string | null {
  const words = raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  if (words.length === 0) return null;
  return `%${words.join('%').slice(0, 80)}%`;
}

/** Category ids whose English or Amharic name contains the query. */
export function categoryIdsMatching(
  query: string,
  categories: readonly Pick<VendorCategory, 'id' | 'name_en' | 'name_am'>[],
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return categories
    .filter(
      (category) =>
        category.name_en.toLowerCase().includes(q) ||
        (category.name_am ?? '').toLowerCase().includes(q),
    )
    .map((category) => category.id);
}

function withSignal<T extends { abortSignal: (signal: AbortSignal) => T }>(
  query: T,
  signal?: AbortSignal,
): T {
  return signal ? query.abortSignal(signal) : query;
}

/** Vendors matched by category name or by an active service title, for free-text search. */
async function vendorIdsMatchingText(
  client: Client,
  pattern: string,
  categoryIds: string[],
  signal?: AbortSignal,
): Promise<QueryResult<string[]>> {
  const [byCategory, byService] = await Promise.all([
    categoryIds.length > 0
      ? withSignal(
          client
            .from('vendor_category_memberships')
            .select('vendor_id')
            .in('category_id', categoryIds)
            .limit(MAX_MATCHED_VENDORS),
          signal,
        )
      : Promise.resolve({ data: [] as { vendor_id: string }[], error: null }),
    withSignal(
      client
        .from('vendor_services')
        .select('vendor_id')
        .eq('is_active', true)
        .ilike('title', pattern)
        .limit(MAX_MATCHED_VENDORS),
      signal,
    ),
  ]);
  const error = byCategory.error ?? byService.error;
  if (error) return { data: null, error };
  const ids = new Set<string>();
  for (const row of [...(byCategory.data ?? []), ...(byService.data ?? [])]) ids.add(row.vendor_id);
  return { data: Array.from(ids), error: null };
}

async function ratingsForVendors(
  client: Client,
  vendorIds: string[],
  signal?: AbortSignal,
): Promise<QueryResult<Map<string, RatingSummary>>> {
  const map = new Map<string, RatingSummary>();
  if (vendorIds.length === 0) return { data: map, error: null };
  const { data, error } = await withSignal(
    client
      .from('vendor_reviews')
      .select('vendor_id, rating')
      .in('vendor_id', vendorIds)
      .eq('status', 'published')
      .limit(MAX_PAGE_REVIEWS),
    signal,
  );
  if (error) return { data: null, error };
  const byVendor = new Map<string, number[]>();
  for (const row of data ?? []) {
    const list = byVendor.get(row.vendor_id) ?? [];
    list.push(row.rating);
    byVendor.set(row.vendor_id, list);
  }
  for (const [vendorId, ratings] of byVendor) {
    const summary = summarizeRatings(ratings);
    if (summary) map.set(vendorId, summary);
  }
  return { data: map, error: null };
}

/**
 * One page of published, verified vendors with categories, starting prices and review ratings.
 * Search, category, city and price range are applied in the database. The price range keeps
 * vendors that offer at least one active service priced inside it.
 */
export async function fetchVendorPage(
  client: Client,
  filters: VendorServerFilters,
  offset: number,
  signal?: AbortSignal,
): Promise<QueryResult<VendorPage>> {
  const pattern = searchPattern(filters.query);
  let matchedVendorIds: string[] = [];
  if (pattern) {
    const matched = await vendorIdsMatchingText(client, pattern, filters.queryCategoryIds, signal);
    if (matched.error) return matched;
    matchedVendorIds = matched.data;
  }

  const filterByPrice = filters.minPrice != null || filters.maxPrice != null;
  const select = [
    LIST_SELECT,
    filters.categoryId ? 'category_match:vendor_category_memberships!inner ( category_id )' : null,
    filterByPrice ? 'price_match:vendor_services!inner ( base_price )' : null,
  ]
    .filter(Boolean)
    .join(',\n');

  let request = client
    .from('vendors')
    .select(select)
    .eq('listing_status', 'published')
    .eq('verification_status', 'verified')
    .eq('services.is_active', true);

  if (filters.categoryId) request = request.eq('category_match.category_id', filters.categoryId);
  if (filters.city) request = request.eq('city', filters.city);
  if (filterByPrice) {
    request = request.eq('price_match.is_active', true);
    if (filters.minPrice != null) request = request.gte('price_match.base_price', filters.minPrice);
    if (filters.maxPrice != null) request = request.lte('price_match.base_price', filters.maxPrice);
  }
  if (pattern) {
    const clauses = [
      `business_name.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `city.ilike.${pattern}`,
    ];
    if (matchedVendorIds.length > 0) clauses.push(`id.in.(${matchedVendorIds.join(',')})`);
    request = request.or(clauses.join(','));
  }

  const ordered =
    filters.sort === 'newest'
      ? request.order('created_at', { ascending: false })
      : request.order('business_name', { ascending: true });

  const { data, error } = await withSignal(
    ordered
      .order('id', { ascending: true })
      // One extra row tells us whether another page exists without a count query.
      .range(offset, offset + VENDOR_PAGE_SIZE),
    signal,
  );
  if (error) return { data: null, error };

  const rows = (data ?? []) as unknown as (Omit<
    VendorListItem,
    'categories' | 'startingPrice' | 'serviceTitles'
  > & {
    categories: RawCategories;
    services: RawService[] | null;
  })[];
  const pageRows = rows.slice(0, VENDOR_PAGE_SIZE);

  const ratings = await ratingsForVendors(
    client,
    pageRows.map((row) => row.id),
    signal,
  );
  if (ratings.error) return ratings;

  const items = pageRows.map(
    (row): VendorListItem => ({
      id: row.id,
      slug: row.slug,
      business_name: row.business_name,
      description: row.description,
      city: row.city,
      country_code: row.country_code,
      website_url: row.website_url,
      instagram_url: row.instagram_url,
      cover_url: row.cover_url,
      logo_url: row.logo_url,
      categories: flattenCategories(row.categories),
      startingPrice: startingPrice(row.services),
      serviceTitles: serviceTitles(row.services),
      rating: ratings.data.get(row.id) ?? null,
    }),
  );

  return {
    data: { items, nextOffset: rows.length > VENDOR_PAGE_SIZE ? offset + VENDOR_PAGE_SIZE : null },
    error: null,
  };
}

/**
 * All published vendors in one bounded request, for the signed-in marketplace that ranks and
 * filters on the device.
 */
export async function fetchPublishedVendors(
  client: Client,
  limit = MAX_MATCHED_VENDORS,
  signal?: AbortSignal,
): Promise<QueryResult<VendorListItem[]>> {
  const { data, error } = await withSignal(
    client
      .from('vendors')
      .select(LIST_SELECT)
      .eq('listing_status', 'published')
      .eq('verification_status', 'verified')
      .eq('services.is_active', true)
      .order('business_name', { ascending: true })
      .limit(limit),
    signal,
  );
  if (error) return { data: null, error };
  const rows = (data ?? []) as unknown as (Omit<
    VendorListItem,
    'categories' | 'startingPrice' | 'serviceTitles'
  > & {
    categories: RawCategories;
    services: RawService[] | null;
  })[];
  return {
    data: rows.map(({ categories, services, ...vendor }) => ({
      ...vendor,
      categories: flattenCategories(categories),
      startingPrice: startingPrice(services),
      serviceTitles: serviceTitles(services),
    })),
    error: null,
  };
}

export async function fetchVendorCategories(
  client: Client,
  signal?: AbortSignal,
): Promise<QueryResult<VendorCategory[]>> {
  const { data, error } = await withSignal(
    client
      .from('vendor_categories')
      .select('id, slug, name_en, name_am')
      .order('name_en', { ascending: true }),
    signal,
  );
  if (error) return { data: null, error };
  return { data: data ?? [], error: null };
}

export async function fetchVendorCities(
  client: Client,
  signal?: AbortSignal,
): Promise<QueryResult<string[]>> {
  const { data, error } = await withSignal(
    client
      .from('vendors')
      .select('city')
      .eq('listing_status', 'published')
      .eq('verification_status', 'verified')
      .not('city', 'is', null)
      .limit(MAX_CITY_ROWS),
    signal,
  );
  if (error) return { data: null, error };
  const cities = new Set<string>();
  for (const row of data ?? []) {
    const city = row.city?.trim();
    if (city) cities.add(city);
  }
  return { data: Array.from(cities).sort((a, b) => a.localeCompare(b)), error: null };
}

/** Newest active services of public vendors, optionally limited to one category. */
export async function fetchPublicServices(
  client: Client,
  options: { categoryId: string | null; limit?: number },
  signal?: AbortSignal,
): Promise<QueryResult<PublicServiceListItem[]>> {
  let request = client
    .from('vendor_services')
    .select(
      `${SERVICE_COLUMNS},
      category:vendor_categories ( id, name_en ),
      vendor:vendors!inner ( id, business_name, city, cover_url, logo_url )`,
    )
    .eq('is_active', true)
    .eq('vendor.listing_status', 'published')
    .eq('vendor.verification_status', 'verified');
  if (options.categoryId) request = request.eq('category_id', options.categoryId);

  const { data, error } = await withSignal(
    request
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(options.limit ?? SERVICE_RAIL_SIZE),
    signal,
  );
  if (error) return { data: null, error };

  const rows = (data ?? []) as unknown as (Omit<PublicServiceListItem, 'category' | 'vendor'> & {
    category: PublicServiceListItem['category'] | PublicServiceListItem['category'][];
    vendor: PublicServiceListItem['vendor'] | PublicServiceListItem['vendor'][];
  })[];
  const items: PublicServiceListItem[] = [];
  for (const row of rows) {
    const vendor = one(row.vendor);
    if (!vendor) continue;
    items.push({ ...row, category: one(row.category), vendor });
  }
  return { data: items, error: null };
}

/**
 * A published, verified vendor's profile in one parallel round. Returns `null` data when the
 * vendor does not exist or is not public.
 */
export async function fetchVendorProfile(
  client: Client,
  vendorId: string,
  signal?: AbortSignal,
): Promise<QueryResult<VendorProfile | null>> {
  const [vendorResult, mediaResult, availabilityResult, reviewsResult] = await Promise.all([
    withSignal(
      client
        .from('vendors')
        .select(PROFILE_SELECT)
        .eq('id', vendorId)
        .eq('listing_status', 'published')
        .eq('verification_status', 'verified')
        .eq('services.is_active', true)
        .eq('services.packages.is_active', true)
        .order('created_at', { referencedTable: 'services', ascending: true }),
      signal,
    ).maybeSingle(),
    withSignal(
      client
        .from('vendor_media')
        .select('id, service_id, storage_path, media_type, caption, sort_order')
        .eq('vendor_id', vendorId)
        .order('sort_order', { ascending: true }),
      signal,
    ),
    withSignal(
      client
        .from('vendor_availability')
        .select('id, service_id, starts_at, ends_at, status')
        .eq('vendor_id', vendorId)
        .gte('ends_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(12),
      signal,
    ),
    withSignal(
      client
        .from('vendor_reviews')
        .select('id, rating, comment, created_at')
        .eq('vendor_id', vendorId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(PROFILE_REVIEW_LIMIT),
      signal,
    ),
  ]);

  const firstError =
    vendorResult.error ?? mediaResult.error ?? availabilityResult.error ?? reviewsResult.error;
  if (firstError) return { data: null, error: firstError };
  if (!vendorResult.data) return { data: null, error: null };

  const raw = vendorResult.data as unknown as Omit<
    VendorProfile,
    'categories' | 'services' | 'media' | 'availability' | 'reviews' | 'rating'
  > & {
    categories: RawCategories;
    services: (VendorProfile['services'][number] & { created_at?: string })[] | null;
  };
  const reviews: PublicReview[] = reviewsResult.data ?? [];

  return {
    data: {
      id: raw.id,
      slug: raw.slug,
      business_name: raw.business_name,
      description: raw.description,
      city: raw.city,
      country_code: raw.country_code,
      website_url: raw.website_url,
      instagram_url: raw.instagram_url,
      cover_url: raw.cover_url,
      logo_url: raw.logo_url,
      categories: flattenCategories(raw.categories),
      services: (raw.services ?? []).map((service) => ({
        id: service.id,
        vendor_id: service.vendor_id,
        category_id: service.category_id,
        title: service.title,
        description: service.description,
        base_price: service.base_price,
        currency_code: service.currency_code,
        price_unit: service.price_unit,
        packages: service.packages ?? [],
      })),
      media: mediaResult.data ?? [],
      availability: availabilityResult.data ?? [],
      reviews,
      rating: summarizeRatings(reviews.map((review) => review.rating)),
    },
    error: null,
  };
}
