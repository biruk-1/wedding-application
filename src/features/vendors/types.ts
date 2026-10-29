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

export type VendorListItem = Vendor & {
  categories: Pick<VendorCategory, 'id' | 'slug' | 'name_en'>[];
  startingPrice: { amount: number; currencyCode: string; priceUnit: string } | null;
};

export type VendorProfile = Vendor & {
  categories: Pick<VendorCategory, 'id' | 'slug' | 'name_en'>[];
  services: (VendorService & { packages: VendorPackage[] })[];
  media: VendorMedia[];
  availability: VendorAvailability[];
  reviews: (VendorReview & { reviewer: { display_name: string } | null })[];
};

export type VendorFilters = {
  query: string;
  categoryId: string | null;
  city: string | null;
  minPrice: number | null;
  maxPrice: number | null;
};

export type CreateInquiryInput = {
  weddingId: string;
  vendorId: string;
  serviceId?: string | null;
  message: string;
  proposedBudget?: number | null;
};
