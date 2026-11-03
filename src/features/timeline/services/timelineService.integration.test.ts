import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/types/database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

vi.mock('@/lib/supabase', async () => {
  const { createClient: create } = await import('@supabase/supabase-js');
  return {
    supabase: create(
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  };
});

/* eslint-disable import/first -- vitest hoists vi.mock */
import { supabase } from '@/lib/supabase';
import {
  createTimelineItem,
  createWeddingEvent,
  deleteWeddingEvent,
  listTimelineItems,
  listWeddingEvents,
  reorderTimelineItems,
  updateWeddingEvent,
} from '@/features/timeline/services/timelineService';
/* eslint-enable import/first */

const stamp = Date.now();
const password = 'TestPass1';
const emailA = `timeline.a.${stamp}@example.com`;
const emailB = `timeline.b.${stamp}@example.com`;

let ready = false;
let weddingId: string | null = null;
let eventId: string | null = null;

async function reachable(): Promise<boolean> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } });
    return response.ok;
  } catch {
    return false;
  }
}

describe('timeline against local Supabase', () => {
  beforeAll(async () => {
    ready = await reachable();
    if (!ready) {
      console.warn(`[skip] Local Supabase unreachable at ${url}`);
      return;
    }

    const signedUp = await supabase.auth.signUp({
      email: emailA,
      password,
      options: { data: { display_name: 'Timeline A' } },
    });
    if (signedUp.error) {
      ready = false;
      return;
    }

    const wedding = await supabase.rpc('create_wedding', {
      p_title: 'Timeline Couple',
      p_partner_one_name: 'A',
      p_partner_two_name: 'B',
      p_timezone: 'Africa/Addis_Ababa',
    });
    if (wedding.error || !wedding.data?.id) {
      ready = false;
      return;
    }
    weddingId = wedding.data.id;
  });

  afterAll(async () => {
    await supabase.auth.signOut();
  });

  it('creates, lists, and updates an event', async ({ skip }) => {
    if (!ready || !weddingId) skip();

    const empty = await listWeddingEvents(weddingId!);
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.data).toHaveLength(0);

    const created = await createWeddingEvent(weddingId!, {
      name: 'Ceremony',
      eventType: 'ceremony',
      startsAt: '2026-08-15T07:00:00.000Z',
      endsAt: '2026-08-15T09:00:00.000Z',
      venueName: 'St. Mary',
      city: 'Addis Ababa',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    eventId = created.data.id;

    const updated = await updateWeddingEvent(weddingId!, eventId, {
      name: 'Wedding ceremony',
      eventType: 'ceremony',
      startsAt: '2026-08-15T07:00:00.000Z',
      endsAt: '2026-08-15T09:30:00.000Z',
      venueName: 'St. Mary',
      city: 'Addis Ababa',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.data.name).toBe('Wedding ceremony');
  });

  it('manages timeline items and reorder', async ({ skip }) => {
    if (!ready || !eventId) skip();

    const first = await createTimelineItem(eventId!, {
      title: 'Guest arrival',
      startsAt: '2026-08-15T06:30:00.000Z',
      endsAt: '2026-08-15T07:00:00.000Z',
    });
    const second = await createTimelineItem(eventId!, {
      title: 'Ceremony',
      startsAt: '2026-08-15T07:00:00.000Z',
      endsAt: '2026-08-15T09:00:00.000Z',
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const listed = await listTimelineItems(eventId!);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data.map((row) => row.title)).toEqual(['Guest arrival', 'Ceremony']);

    const reordered = await reorderTimelineItems(eventId!, [second.data.id, first.data.id]);
    expect(reordered.ok).toBe(true);
  });

  it('rejects end before start', async ({ skip }) => {
    if (!ready || !weddingId) skip();
    const bad = await createWeddingEvent(weddingId!, {
      name: 'Bad',
      eventType: 'other',
      startsAt: '2026-08-15T10:00:00.000Z',
      endsAt: '2026-08-15T09:00:00.000Z',
    });
    expect(bad.ok).toBe(false);
  });

  it('isolates events across weddings', async ({ skip }) => {
    if (!ready || !eventId) skip();

    const outsider: SupabaseClient<Database> = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedUp = await outsider.auth.signUp({
      email: emailB,
      password,
      options: { data: { display_name: 'Timeline B' } },
    });
    expect(signedUp.error).toBeNull();
    const other = await outsider.rpc('create_wedding', {
      p_title: 'Other',
      p_partner_one_name: 'X',
      p_partner_two_name: 'Y',
    });
    expect(other.error).toBeNull();

    const leak = await outsider.from('wedding_events').select('id').eq('id', eventId!);
    expect(leak.error).toBeNull();
    expect(leak.data ?? []).toHaveLength(0);
    await outsider.auth.signOut();
  });

  it('deletes an event and cascades timeline items', async ({ skip }) => {
    if (!ready || !weddingId || !eventId) skip();
    const removed = await deleteWeddingEvent(weddingId!, eventId!);
    expect(removed.ok).toBe(true);
    const leftover = await supabase.from('timeline_items').select('id').eq('event_id', eventId!);
    expect(leftover.data ?? []).toHaveLength(0);
  });
});
