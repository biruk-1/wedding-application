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
const email = `auth.task4.${stamp}@example.com`;
const password = 'TestPass1';

async function isLocalAuthReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anon },
    });
    return response.ok;
  } catch {
    return false;
  }
}

let ready = false;

describe('auth against local Supabase', () => {
  beforeAll(async () => {
    ready = await isLocalAuthReachable();
    if (!ready) {
      console.warn(
        `[skip] Local Supabase Auth unreachable at ${url}. Start Docker and run npm run db:start.`,
      );
    }
  });


  it('registers a user and provisions a profiles row via trigger', async ({ skip }) => {
    if (!ready) skip();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: 'Task Four' } },
    });
    expect(error).toBeNull();
    expect(data.user?.id).toBeTruthy();
    expect(data.session).toBeTruthy();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', data.user!.id)
      .single();

    expect(profileError).toBeNull();
    expect(profile?.display_name).toBe('Task Four');
  });

  it('rejects invalid login credentials', async ({ skip }) => {
    if (!ready) skip();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: 'wrong-password',
    });
    expect(error).toBeTruthy();
    expect(error?.message.toLowerCase()).toMatch(/invalid/i);
  });

  it('signs in with valid credentials', async ({ skip }) => {
    if (!ready) skip();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
  });

  it('requests password reset without leaking account existence', async ({ skip }) => {
    if (!ready) skip();

    const known = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'kiburan://reset-password',
    });
    const unknown = await supabase.auth.resetPasswordForEmail(`missing.${stamp}@example.com`, {
      redirectTo: 'kiburan://reset-password',
    });
    expect(known.error ?? null).toBeNull();
    expect(unknown.error ?? null).toBeNull();
  });

  it('signs out the current session', async ({ skip }) => {
    if (!ready) skip();

    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
  });
});

afterAll(async () => {
  if (ready) {
    await supabase.auth.signOut();
  }
});
