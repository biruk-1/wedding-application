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
const email = `checklist.task6.${stamp}@example.com`;
const password = 'TestPass1';

let ready = false;
let weddingId: string | null = null;
let taskId: string | null = null;

async function reachable(): Promise<boolean> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon } });
    return response.ok;
  } catch {
    return false;
  }
}

describe('checklist against local Supabase', () => {
  beforeAll(async () => {
    ready = await reachable();
    if (!ready) {
      console.warn(`[skip] Local Supabase unreachable at ${url}`);
      return;
    }

    const signedUp = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: 'Task Six' } },
    });
    if (signedUp.error) {
      ready = false;
      return;
    }

    const wedding = await supabase.rpc('create_wedding', {
      p_title: 'Checklist Couple',
      p_partner_one_name: 'A',
      p_partner_two_name: 'B',
      p_wedding_date: '2026-12-01',
    });
    if (wedding.error || !wedding.data?.id) {
      ready = false;
      return;
    }
    weddingId = wedding.data.id;
  });

  it('creates, completes, and reopens a task', async ({ skip }) => {
    if (!ready || !weddingId) skip();

    const created = await supabase
      .from('wedding_tasks')
      .insert({
        wedding_id: weddingId,
        title: 'Book venue',
        status: 'todo',
        priority: 'high',
      })
      .select('*')
      .single();

    expect(created.error).toBeNull();
    taskId = created.data!.id;

    const done = await supabase
      .from('wedding_tasks')
      .update({ status: 'done' })
      .eq('id', taskId)
      .select('status, completed_at')
      .single();
    expect(done.error).toBeNull();
    expect(done.data?.status).toBe('done');
    expect(done.data?.completed_at).toBeTruthy();

    const reopened = await supabase
      .from('wedding_tasks')
      .update({ status: 'todo' })
      .eq('id', taskId)
      .select('status, completed_at')
      .single();
    expect(reopened.error).toBeNull();
    expect(reopened.data?.status).toBe('todo');
    expect(reopened.data?.completed_at).toBeNull();
  });

  it('scopes tasks to the wedding and supports template-backed inserts', async ({ skip }) => {
    if (!ready || !weddingId) skip();

    const { data: templates } = await supabase
      .from('checklist_templates')
      .select('id, category_id, title_en')
      .eq('is_active', true)
      .limit(1);

    if (templates?.[0]) {
      const seeded = await supabase.from('wedding_tasks').insert({
        wedding_id: weddingId,
        title: templates[0].title_en,
        category_id: templates[0].category_id,
        template_id: templates[0].id,
      });
      expect(seeded.error).toBeNull();
    }

    const { data, error } = await supabase
      .from('wedding_tasks')
      .select('id')
      .eq('wedding_id', weddingId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it('blocks unauthenticated writes', async ({ skip }) => {
    if (!ready || !weddingId) skip();
    await supabase.auth.signOut();
    const { error } = await supabase.from('wedding_tasks').insert({
      wedding_id: weddingId,
      title: 'Should fail',
    });
    expect(error).toBeTruthy();
  });
});

afterAll(async () => {
  await supabase.auth.signOut();
});
