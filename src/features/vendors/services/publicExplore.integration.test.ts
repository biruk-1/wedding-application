import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  fetchPublishedVendors,
  fetchPublicServices,
  fetchVendorCategories,
  fetchVendorCities,
  fetchVendorPage,
  fetchVendorProfile,
} from '@/features/vendors/services/vendorQueries';
import type { VendorServerFilters } from '@/features/vendors/types';
import type { Database } from '@/types/database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/** Never signs in: every request runs as the `anon` role, like a guest on Explore. */
const guest = createClient<Database>(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const noFilters: VendorServerFilters = {
  query: '',
  categoryId: null,
  city: null,
  minPrice: null,
  maxPrice: null,
  queryCategoryIds: [],
};

let ready = false;

describe('public Explore as a signed-out guest (local Supabase)', () => {
  beforeAll(async () => {
    try {
      const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } });
      ready = response.ok;
    } catch {
      ready = false;
    }
    if (!ready) console.warn(`[skip] Local Supabase unreachable at ${url}`);
  });

  it('pages published vendors with categories and prices, using only public columns', async () => {
    if (!ready) return;
    const page = await fetchVendorPage(guest, noFilters, 0);
    expect(page.error).toBeNull();
    const items = page.data!.items;
    for (const vendor of items) {
      expect(vendor).not.toHaveProperty('phone');
      expect(vendor).not.toHaveProperty('email');
      expect(vendor).not.toHaveProperty('address');
      expect(vendor).not.toHaveProperty('owner_user_id');
    }
  });

  it('applies search, category, city and price filters in the database', async () => {
    if (!ready) return;
    const all = await fetchVendorPage(guest, noFilters, 0);
    const first = all.data?.items[0];
    if (!first) return;

    const byName = await fetchVendorPage(
      guest,
      { ...noFilters, query: first.business_name.split(' ')[0]! },
      0,
    );
    expect(byName.error).toBeNull();
    expect(byName.data!.items.some((v) => v.id === first.id)).toBe(true);

    const category = first.categories[0];
    if (category) {
      const byCategory = await fetchVendorPage(guest, { ...noFilters, categoryId: category.id }, 0);
      expect(byCategory.error).toBeNull();
      expect(
        byCategory.data!.items.every((v) => v.categories.some((c) => c.id === category.id)),
      ).toBe(true);
    }

    if (first.city) {
      const byCity = await fetchVendorPage(guest, { ...noFilters, city: first.city }, 0);
      expect(byCity.data!.items.every((v) => v.city === first.city)).toBe(true);
    }

    const none = await fetchVendorPage(guest, { ...noFilters, query: 'zzzz-no-such-vendor' }, 0);
    expect(none.error).toBeNull();
    expect(none.data!.items).toEqual([]);

    const priced = await fetchVendorPage(guest, { ...noFilters, minPrice: 1, maxPrice: 10 ** 9 }, 0);
    expect(priced.error).toBeNull();
  });

  it('loads categories, cities, services and a full profile', async () => {
    if (!ready) return;
    const [categories, cities, services] = await Promise.all([
      fetchVendorCategories(guest),
      fetchVendorCities(guest),
      fetchPublicServices(guest, { categoryId: null }),
    ]);
    expect(categories.error).toBeNull();
    expect(cities.error).toBeNull();
    expect(services.error).toBeNull();

    const page = await fetchVendorPage(guest, noFilters, 0);
    const vendor = page.data?.items[0];
    if (!vendor) return;
    const profile = await fetchVendorProfile(guest, vendor.id);
    expect(profile.error).toBeNull();
    expect(profile.data?.id).toBe(vendor.id);
    for (const slot of profile.data?.availability ?? []) expect(slot).not.toHaveProperty('notes');
    for (const review of profile.data?.reviews ?? []) {
      expect(review).not.toHaveProperty('reviewer_id');
      expect(review).not.toHaveProperty('wedding_id');
    }
  });

  it('refuses private vendor, schedule and reviewer columns', async () => {
    if (!ready) return;
    for (const column of ['phone', 'email', 'address', 'owner_user_id']) {
      const { error } = await guest.from('vendors').select(column).limit(1);
      expect(error?.code).toBe('42501');
    }
    const notes = await guest.from('vendor_availability').select('notes').limit(1);
    expect(notes.error?.code).toBe('42501');
    const reviewer = await guest.from('vendor_reviews').select('reviewer_id, wedding_id').limit(1);
    expect(reviewer.error?.code).toBe('42501');
  });

  it('shows no unpublished or unverified vendors', async () => {
    if (!ready) return;
    const { data, error } = await guest
      .from('vendors')
      .select('id, listing_status, verification_status')
      .limit(100);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row.listing_status).toBe('published');
      expect(row.verification_status).toBe('verified');
    }
  });

  it('serves the same reads to signed-in couples (shared in-app marketplace path)', async () => {
    if (!ready) return;
    const member = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedUp = await member.auth.signUp({
      email: `explore.member.${Date.now()}@example.com`,
      password: 'TestPass1',
    });
    if (signedUp.error || !signedUp.data.session) return;

    const [list, page] = await Promise.all([
      fetchPublishedVendors(member),
      fetchVendorPage(guest, noFilters, 0),
    ]);
    expect(list.error).toBeNull();
    const guestIds = page.data!.items.map((v) => v.id).sort();
    if (page.data!.nextOffset == null) {
      expect(list.data!.map((v) => v.id).sort()).toEqual(guestIds);
    }
    const vendorId = guestIds[0];
    if (vendorId) {
      const profile = await fetchVendorProfile(member, vendorId);
      expect(profile.error).toBeNull();
      expect(profile.data?.id).toBe(vendorId);
    }
    await member.auth.signOut();
  });

  it('cannot save vendors, send inquiries, or read inquiries without signing in', async () => {
    if (!ready) return;
    const page = await fetchVendorPage(guest, noFilters, 0);
    const vendorId = page.data?.items[0]?.id;
    if (!vendorId) return;
    const fakeWedding = '00000000-0000-4000-8000-000000000099';

    const save = await guest
      .from('wedding_vendors')
      .insert({ wedding_id: fakeWedding, vendor_id: vendorId, status: 'shortlisted' });
    expect(save.error).toBeTruthy();

    const inquiry = await guest.from('vendor_inquiries').insert({
      wedding_id: fakeWedding,
      vendor_id: vendorId,
      message: 'guest should not be able to send this',
      created_by: fakeWedding,
      status: 'new',
    });
    expect(inquiry.error).toBeTruthy();

    const read = await guest.from('vendor_inquiries').select('id').limit(1);
    expect(read.data ?? []).toEqual([]);
  });
});
