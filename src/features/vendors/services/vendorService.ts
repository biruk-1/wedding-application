import { getMyWeddingAccess } from '@/features/team/services/teamService';
import { legacyCanWrite } from '@/features/team/utils/teamAccess';
import { mapVendorError, type VendorUserMessage } from '@/features/vendors/services/vendorErrors';
import {
  fetchPublishedVendors,
  fetchVendorCategories,
  fetchVendorProfile,
} from '@/features/vendors/services/vendorQueries';
import type {
  CreateInquiryInput,
  VendorCategory,
  VendorInquiry,
  VendorListItem,
  VendorProfile,
  WeddingVendor,
} from '@/features/vendors/types';
import { supabase } from '@/lib/supabase';

export type VendorResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: VendorUserMessage };

function fail(error: { message?: string; code?: string } | Error | null): VendorResult<never> {
  return { ok: false, error: mapVendorError(error) };
}

export async function listVendorCategories(): Promise<VendorResult<VendorCategory[]>> {
  const { data, error } = await fetchVendorCategories(supabase);
  if (error) return fail(error);
  return { ok: true, data };
}

export async function listPublishedVendors(): Promise<VendorResult<VendorListItem[]>> {
  const { data, error } = await fetchPublishedVendors(supabase);
  if (error) return fail(error);
  return { ok: true, data };
}

export async function getVendorProfile(vendorId: string): Promise<VendorResult<VendorProfile>> {
  const { data, error } = await fetchVendorProfile(supabase, vendorId);
  if (error) return fail(error);
  if (!data) return fail(new Error('Vendor not found or not available.'));
  return { ok: true, data };
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
  const access = await getMyWeddingAccess(weddingId);
  if (!access.ok) return false;
  return legacyCanWrite(access.data);
}
