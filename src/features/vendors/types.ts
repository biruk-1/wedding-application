import type { Database } from '@/types/database.types';

export type Vendor = Database['public']['Tables']['vendors']['Row'];
export type VendorCategory = Database['public']['Tables']['vendor_categories']['Row'];
export type VendorService = Database['public']['Tables']['vendor_services']['Row'];
export type VendorPackage = Database['public']['Tables']['vendor_packages']['Row'];
export type VendorMedia = Database['public']['Tables']['vendor_media']['Row'];
export type VendorAvailability = Database['public']['Tables']['vendor_availability']['Row'];
export type WeddingVendor = Database['public']['Tables']['wedding_vendors']['Row'];
export type VendorInquiry = Database['public']['Tables']['vendor_inquiries']['Row'];
export type VendorReview = Database['public']['Tables']['vendor_reviews']['Row'];

/**
 * Marketplace-safe vendor columns. Signed-out clients are only granted these columns
 * (migration 20261108160000), so every marketplace select uses exactly this list.
 */
export type PublicVendor = Pick<
  Vendor,
  | 'id'
  | 'slug'
  | 'business_name'
  | 'description'
  | 'city'
  | 'country_code'
  | 'website_url'
  | 'instagram_url'
  | 'logo_url'
  | 'cover_url'
>;

export type CategoryRef = Pick<VendorCategory, 'id' | 'slug' | 'name_en'>;

export type StartingPrice = { amount: number; currencyCode: string; priceUnit: string };

export type RatingSummary = { average: number; count: number };

export type VendorListItem = PublicVendor & {
  categories: CategoryRef[];
  startingPrice: StartingPrice | null;
  /** Only present when published reviews exist. */
  rating?: RatingSummary | null;
};

export type PublicVendorPackage = Pick<
  VendorPackage,
  'id' | 'service_id' | 'name' | 'description' | 'inclusions' | 'price' | 'currency_code'
>;

export type PublicVendorService = Pick<
  VendorService,
  | 'id'
  | 'vendor_id'
  | 'category_id'
  | 'title'
  | 'description'
  | 'base_price'
  | 'currency_code'
  | 'price_unit'
>;

export type PublicVendorMedia = Pick<
  VendorMedia,
  'id' | 'service_id' | 'storage_path' | 'media_type' | 'caption' | 'sort_order'
>;

export type PublicAvailability = Pick<
  VendorAvailability,
  'id' | 'service_id' | 'starts_at' | 'ends_at' | 'status'
>;

export type PublicReview = Pick<VendorReview, 'id' | 'rating' | 'comment' | 'created_at'>;

export type VendorProfile = PublicVendor & {
  categories: CategoryRef[];
  services: (PublicVendorService & { packages: PublicVendorPackage[] })[];
  media: PublicVendorMedia[];
  availability: PublicAvailability[];
  reviews: PublicReview[];
  rating: RatingSummary | null;
};

/** An active service of a public vendor, for the Explore services rail. */
export type PublicServiceListItem = PublicVendorService & {
  category: Pick<VendorCategory, 'id' | 'name_en'> | null;
  vendor: Pick<PublicVendor, 'id' | 'business_name' | 'city' | 'cover_url' | 'logo_url'>;
};

export type VendorFilters = {
  query: string;
  categoryId: string | null;
  city: string | null;
  minPrice: number | null;
  maxPrice: number | null;
};

export type VendorSort = 'name' | 'newest';

/** Server-side filter shape for paged vendor search (`vendorQueries.fetchVendorPage`). */
export type VendorServerFilters = VendorFilters & {
  /** Categories whose names match the free-text query, so "photo" finds photographers. */
  queryCategoryIds: string[];
  sort?: VendorSort;
};

export type VendorPage = {
  items: VendorListItem[];
  nextOffset: number | null;
};

export type SavedVendorLink = WeddingVendor;

export type CreateInquiryInput = {
  weddingId: string;
  vendorId: string;
  serviceId?: string | null;
  message: string;
  proposedBudget?: number | null;
};
