import { mapVendorError, type VendorUserMessage } from '@/features/vendors/services/vendorErrors';
import type {
  CreateInquiryInput,
  Vendor,
  VendorCategory,
  VendorInquiry,
  VendorListItem,
  VendorPackage,
  VendorProfile,
  VendorService,
  WeddingVendor,
} from '@/features/vendors/types';
import { supabase } from '@/lib/supabase';

export type VendorResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: VendorUserMessage };

function fail(error: { message?: string; code?: string } | Error | null): VendorResult<never> {
  return { ok: false, error: mapVendorError(error) };
}

type ServicePriceRow = Pick<
  VendorService,
  'vendor_id' | 'base_price' | 'currency_code' | 'price_unit' | 'is_active'
>;

function computeStartingPrices(
  services: ServicePriceRow[],
): Map<string, NonNullable<VendorListItem['startingPrice']>> {
  const map = new Map<string, NonNullable<VendorListItem['startingPrice']>>();
  for (const service of services) {
    if (!service.is_active || service.base_price == null) continue;
    const current = map.get(service.vendor_id);
    if (!current || service.base_price < current.amount) {
      map.set(service.vendor_id, {
        amount: Number(service.base_price),
        currencyCode: service.currency_code,
        priceUnit: service.price_unit,
      });
    }
  }
  return map;
}

export async function listVendorCategories(): Promise<VendorResult<VendorCategory[]>> {
  const { data, error } = await supabase
    .from('vendor_categories')
    .select('*')
    .order('name_en', { ascending: true });
  if (error) return fail(error);
  return { ok: true, data: data ?? [] };
}

export async function listPublishedVendors(): Promise<VendorResult<VendorListItem[]>> {
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select(
      `
      *,
      memberships:vendor_category_memberships (
        category:vendor_categories ( id, slug, name_en )
      )
    `,
    )
    .eq('listing_status', 'published')
    .eq('verification_status', 'verified')
    .order('business_name', { ascending: true });

  if (error) return fail(error);

  const vendorIds = (vendors ?? []).map((row) => row.id);
  let services: ServicePriceRow[] = [];
  if (vendorIds.length > 0) {
    const { data: serviceRows, error: serviceError } = await supabase
      .from('vendor_services')
      .select('vendor_id, base_price, currency_code, price_unit, is_active')
      .in('vendor_id', vendorIds)
      .eq('is_active', true);
    if (serviceError) return fail(serviceError);
    services = serviceRows ?? [];
  }

  const starting = computeStartingPrices(services);

  const items: VendorListItem[] = (vendors ?? []).map((row) => {
    const memberships = (row.memberships ?? []) as {
      category: Pick<VendorCategory, 'id' | 'slug' | 'name_en'> | Pick<VendorCategory, 'id' | 'slug' | 'name_en'>[] | null;
    }[];
    const categories = memberships
      .map((m) => (Array.isArray(m.category) ? m.category[0] ?? null : m.category))
      .filter((c): c is Pick<VendorCategory, 'id' | 'slug' | 'name_en'> => Boolean(c));

    const { memberships: _drop, ...vendor } = row as Vendor & { memberships: unknown };
    void _drop;
    return {
      ...(vendor as Vendor),
      categories,
      startingPrice: starting.get(row.id) ?? null,
    };
  });

  return { ok: true, data: items };
}

export async function getVendorProfile(vendorId: string): Promise<VendorResult<VendorProfile>> {
  const { data: vendor, error } = await supabase
    .from('vendors')
    .select(
      `
      *,
      memberships:vendor_category_memberships (
        category:vendor_categories ( id, slug, name_en )
      )
    `,
    )
    .eq('id', vendorId)
    .maybeSingle();

  if (error) return fail(error);
  if (!vendor) {
    return fail(new Error('Vendor not found or not available.'));
  }

  const [servicesResult, mediaResult, availabilityResult, reviewsResult] = await Promise.all([
    supabase
      .from('vendor_services')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('vendor_media')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('vendor_availability')
      .select('*')
      .eq('vendor_id', vendorId)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(12),
    supabase
      .from('vendor_reviews')
      .select('*, reviewer:profiles ( display_name )')
      .eq('vendor_id', vendorId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (servicesResult.error) return fail(servicesResult.error);
  if (mediaResult.error) return fail(mediaResult.error);
  if (availabilityResult.error) return fail(availabilityResult.error);
  if (reviewsResult.error) return fail(reviewsResult.error);

  const serviceIds = (servicesResult.data ?? []).map((s) => s.id);
  let packages: VendorPackage[] = [];
  if (serviceIds.length > 0) {
    const { data: packageRows, error: packageError } = await supabase
      .from('vendor_packages')
      .select('*')
      .in('service_id', serviceIds)
      .eq('is_active', true);
    if (packageError) return fail(packageError);
    packages = packageRows ?? [];
  }

  const memberships = (vendor.memberships ?? []) as {
    category: Pick<VendorCategory, 'id' | 'slug' | 'name_en'> | Pick<VendorCategory, 'id' | 'slug' | 'name_en'>[] | null;
  }[];
  const categories = memberships
    .map((m) => (Array.isArray(m.category) ? m.category[0] ?? null : m.category))
    .filter((c): c is Pick<VendorCategory, 'id' | 'slug' | 'name_en'> => Boolean(c));

  const { memberships: _drop, ...vendorRow } = vendor as Vendor & { memberships: unknown };
  void _drop;

  const services = (servicesResult.data ?? []).map((service) => ({
    ...service,
    packages: packages.filter((pkg) => pkg.service_id === service.id),
  }));

  const reviews = (reviewsResult.data ?? []).map((row) => {
    const reviewer = row.reviewer as { display_name: string } | { display_name: string }[] | null;
    return {
      ...(row as unknown as VendorProfile['reviews'][number]),
      reviewer: Array.isArray(reviewer) ? reviewer[0] ?? null : reviewer,
    };
  });

  return {
    ok: true,
    data: {
      ...(vendorRow as Vendor),
      categories,
      services,
      media: mediaResult.data ?? [],
      availability: availabilityResult.data ?? [],
      reviews,
    },
  };
}

export async function getWeddingVendorLink(
  weddingId: string,
  vendorId: string,
): Promise<VendorResult<WeddingVendor | null>> {
  const { data, error } = await supabase
    .from('wedding_vendors')
    .select('*')
    .eq('wedding_id', weddingId)
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (error) return fail(error);
  return { ok: true, data: data ?? null };
}

export async function saveVendorToWedding(input: {
  weddingId: string;
  vendorId: string;
  categoryId?: string | null;
}): Promise<VendorResult<WeddingVendor>> {
  const existing = await getWeddingVendorLink(input.weddingId, input.vendorId);
  if (!existing.ok) return existing;
  if (existing.data) {
    return { ok: true, data: existing.data };
  }

  const { data, error } = await supabase
    .from('wedding_vendors')
    .insert({
      wedding_id: input.weddingId,
      vendor_id: input.vendorId,
      category_id: input.categoryId ?? null,
      status: 'shortlisted',
    })
    .select('*')
    .single();

  if (error) return fail(error);
  return { ok: true, data };
}

export async function removeVendorFromWedding(
  weddingVendorId: string,
): Promise<VendorResult<true>> {
  const { error } = await supabase.from('wedding_vendors').delete().eq('id', weddingVendorId);
  if (error) return fail(error);
  return { ok: true, data: true };
}

export async function createVendorInquiry(
  input: CreateInquiryInput,
): Promise<VendorResult<VendorInquiry>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return fail(new Error('authentication required'));
  }

  const { data, error } = await supabase
    .from('vendor_inquiries')
    .insert({
      wedding_id: input.weddingId,
      vendor_id: input.vendorId,
      service_id: input.serviceId ?? null,
      message: input.message.trim(),
      proposed_budget: input.proposedBudget ?? null,
      created_by: user.id,
      status: 'new',
    })
    .select('*')
    .single();

  if (error) return fail(error);
  return { ok: true, data };
}

export async function canWriteWedding(weddingId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return false;
  const { data } = await supabase
    .from('wedding_members')
    .select('role')
    .eq('wedding_id', weddingId)
    .eq('user_id', user.id)
    .maybeSingle();
  const role = data?.role;
  return Boolean(role && role !== 'viewer');
}
