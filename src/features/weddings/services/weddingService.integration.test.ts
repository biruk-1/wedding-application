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
const email = `wedding.task5.${stamp}@example.com`;
const password = 'TestPass1';

let ready = false;
let weddingId: string | null = null;

async function isLocalAuthReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon } });
    return response.ok;
  } catch {
    return false;
  }
}

describe('wedding creation against local Supabase', () => {
  beforeAll(async () => {
    ready = await isLocalAuthReachable();
    if (!ready) {
      console.warn(`[skip] Local Supabase unreachable at ${url}`);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: 'Task Five' } },
    });
    if (error) {
      ready = false;
      console.warn(`[skip] signUp failed: ${error.message}`);
    }
  });

  it('creates a wedding with owner membership atomically via RPC', async ({ skip }) => {
    if (!ready) skip();

    const { data, error } = await supabase.rpc('create_wedding', {
      p_title: 'Hana & Daniel',
      p_partner_one_name: 'Hana',
      p_partner_two_name: 'Daniel',
      p_wedding_date: '2026-08-15',
      p_city: 'Addis Ababa',
      p_style: 'traditional',
    });

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    weddingId = data!.id;

    const { data: userData } = await supabase.auth.getUser();
    const { data: member, error: memberError } = await supabase
      .from('wedding_members')
      .select('role')
      .eq('wedding_id', weddingId)
      .eq('user_id', userData.user!.id)
      .single();

    expect(memberError).toBeNull();
    expect(member?.role).toBe('owner');
  });

  it('lists only the authenticated user memberships', async ({ skip }) => {
    if (!ready || !weddingId) skip();

    const { data, error } = await supabase
      .from('wedding_members')
      .select('wedding_id, role, wedding:weddings(title)')
      .eq('user_id', (await supabase.auth.getUser()).data.user!.id);

    expect(error).toBeNull();
    expect((data ?? []).some((row) => row.wedding_id === weddingId)).toBe(true);
  });

  it('rejects unauthenticated create_wedding', async ({ skip }) => {
    if (!ready) skip();

    await supabase.auth.signOut();
    const { error } = await supabase.rpc('create_wedding', {
      p_title: 'Should Fail',
      p_partner_one_name: 'A',
      p_partner_two_name: 'B',
    });
    expect(error).toBeTruthy();
  });
});

afterAll(async () => {
  await supabase.auth.signOut();
});
