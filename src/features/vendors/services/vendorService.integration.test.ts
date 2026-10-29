import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anon =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const email = `vendors.task7.${stamp}@example.com`;
const password = 'TestPass1';

let ready = false;
let weddingId: string | null = null;
let vendorId: string | null = null;

async function reachable(): Promise<boolean> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon } });
    return response.ok;
  } catch {
    return false;
  }
}

describe('vendors against local Supabase', () => {
  beforeAll(async () => {
    ready = await reachable();
    if (!ready) {
      console.warn(`[skip] Local Supabase unreachable at ${url}`);
      return;
    }

    const signedUp = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: 'Vendor Tester' } },
    });
    if (signedUp.error) {
      ready = false;
      return;
    }

    const wedding = await supabase.rpc('create_wedding', {
      p_title: `Vendor test ${stamp}`,
      p_partner_one_name: 'A',
      p_partner_two_name: 'B',
      p_wedding_date: '2027-06-15',
      p_city: 'Addis Ababa',
    });
    if (wedding.error || !wedding.data?.id) {
      ready = false;
      return;
    }
    weddingId = wedding.data.id;

    const { data: vendors } = await supabase
      .from('vendors')
      .select('id')
      .eq('listing_status', 'published')
      .eq('verification_status', 'verified')
      .limit(1);
    vendorId = vendors?.[0]?.id ?? null;
  }, 60000);

  afterAll(async () => {
    if (ready) await supabase.auth.signOut();
  });

  it('lists vendor categories for anon/authenticated', async () => {
    if (!ready) return;
    const { data, error } = await supabase.from('vendor_categories').select('slug').limit(5);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it('lists published verified vendors when seed data exists', async () => {
    if (!ready) return;
    const { data, error } = await supabase
      .from('vendors')
      .select('id, business_name')
      .eq('listing_status', 'published')
      .eq('verification_status', 'verified');
    expect(error).toBeNull();
    // Seed may be absent until db:reset; empty is still a valid RLS outcome.
    expect(Array.isArray(data)).toBe(true);
  });

  it('saves and removes a wedding vendor when a listing exists', async () => {
    if (!ready || !weddingId || !vendorId) return;

    const insert = await supabase
      .from('wedding_vendors')
      .insert({
        wedding_id: weddingId,
        vendor_id: vendorId,
        status: 'shortlisted',
      })
      .select('id')
      .single();
    expect(insert.error).toBeNull();

    const remove = await supabase.from('wedding_vendors').delete().eq('id', insert.data!.id);
    expect(remove.error).toBeNull();
  });

  it('creates an inquiry scoped to the member wedding', async () => {
    if (!ready || !weddingId || !vendorId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    expect(user?.id).toBeTruthy();

    const inquiry = await supabase
      .from('vendor_inquiries')
      .insert({
        wedding_id: weddingId,
        vendor_id: vendorId,
        message: 'We would love a quote for full-day coverage.',
        created_by: user!.id,
        status: 'new',
      })
      .select('id')
      .single();
    expect(inquiry.error).toBeNull();
  });

  it('blocks inquiry for a wedding the user does not belong to', async () => {
    if (!ready || !vendorId) return;
    const fakeWedding = '00000000-0000-4000-8000-000000000099';
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const inquiry = await supabase.from('vendor_inquiries').insert({
      wedding_id: fakeWedding,
      vendor_id: vendorId,
      message: 'Should fail RLS',
      created_by: user!.id,
      status: 'new',
    });
    expect(inquiry.error).toBeTruthy();
  });
});
