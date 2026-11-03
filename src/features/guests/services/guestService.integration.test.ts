import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createGuest,
  createGuestGroup,
  deleteGuest,
  deleteGuestGroup,
  getGuest,
  listGuestGroups,
  listGuestSummaries,
  listGuests,
  updateGuest,
  GUEST_PAGE_SIZE,
} from '@/features/guests/services/guestService';
import { INVITATION_COLUMNS } from '@/features/guests/services/guestSelects';
import {
  cancelInvitation,
  createInvitation,
  createInvitationDesign,
  createWeddingEvent,
  getInvitationPreviewByToken,
  listInvitationDesigns,
  listInvitations,
  listRsvpsForWedding,
  markInvitationSent,
  parseInvitePreview,
  setGuestRsvp,
  submitRsvpByToken,
  updateInvitationDesign,
} from '@/features/guests/services/invitationService';
import {
  assignGuest,
  createTable,
  deleteTable,
  listAssignments,
  listTables,
  unassignGuest,
} from '@/features/guests/services/seatingService';
import type { Database } from '@/types/database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// The services import `supabase` from '@/lib/supabase' (which needs react-native). Swap in a plain
// Node client so the real service code runs against local Supabase.
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

/* eslint-disable import/first -- vitest hoists vi.mock; imports after mock stay intentional */
import { supabase } from '@/lib/supabase';
/* eslint-enable import/first */

const stamp = Date.now();
const password = 'TestPass1';
const emailA = `guests.a.${stamp}@example.com`;
const emailB = `guests.b.${stamp}@example.com`;

const anon: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let ready = false;
let weddingA: string | null = null;
let weddingB: string | null = null;

async function reachable(): Promise<boolean> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } });
    return response.ok;
  } catch {
    return false;
  }
}

async function signUpWithWedding(email: string, title: string): Promise<string | null> {
  const signedUp = await supabase.auth.signUp({ email, password, options: { data: { display_name: title } } });
  if (signedUp.error) return null;
  const wedding = await supabase.rpc('create_wedding', {
    p_title: title,
    p_partner_one_name: 'Selam',
    p_partner_two_name: 'Dawit',
    p_wedding_date: '2027-01-16',
  });
  if (wedding.error || !wedding.data?.id) return null;
  return wedding.data.id;
}

async function signInAs(email: string) {
  await supabase.auth.signOut();
  const result = await supabase.auth.signInWithPassword({ email, password });
  expect(result.error).toBeNull();
}

function must<T>(result: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(`Service failed: ${result.error.message}`);
  return result.data;
}

// State shared between the ordered tests below.
let groupId: string;
let guestId: string;
let guestTwoId: string;
let designId: string;
let eventOneId: string;
let eventTwoId: string;
let invitationId: string;
let rawToken: string;

describe('guest management and invitations against local Supabase', () => {
  beforeAll(async () => {
    ready = await reachable();
    if (!ready) {
      console.warn(`[skip] Local Supabase unreachable at ${url}`);
      return;
    }
    weddingA = await signUpWithWedding(emailA, 'Guests Couple A');
    await supabase.auth.signOut();
    weddingB = await signUpWithWedding(emailB, 'Guests Couple B');
    if (!weddingA || !weddingB) {
      ready = false;
      return;
    }
    await signInAs(emailA);
  });

  it('creates and lists groups', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const group = must(await createGuestGroup(weddingA!, { name: 'Family', side: 'partner_one' }));
    groupId = group.id;
    expect(group.side).toBe('partner_one');

    const groups = must(await listGuestGroups(weddingA!));
    expect(groups.map((g) => g.id)).toContain(groupId);
  });

  it('creates guests, searches, and rejects duplicates', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const guest = must(
      await createGuest(weddingA!, {
        fullName: 'Abebe Kebede',
        email: 'abebe@example.com',
        groupId,
        guestType: 'family',
        plusOneAllowed: true,
      }),
    );
    guestId = guest.id;
    expect(guest.group?.name).toBe('Family');
    expect(guest.plus_one_allowed).toBe(true);

    const second = must(await createGuest(weddingA!, { fullName: 'Chaltu Ali', groupId }));
    guestTwoId = second.id;

    const duplicate = await createGuest(weddingA!, { fullName: 'abebe kebede', email: 'ABEBE@example.com' });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe('duplicate_guest');

    const bySearch = must(await listGuests(weddingA!, { query: 'abeb', groupId: null }));
    expect(bySearch.items.map((g) => g.id)).toEqual([guestId]);
    const byEmail = must(await listGuests(weddingA!, { query: 'abebe@example', groupId: null }));
    expect(byEmail.items).toHaveLength(1);
    const byGroup = must(await listGuests(weddingA!, { query: '', groupId }));
    expect(byGroup.items).toHaveLength(2);
    // Characters that would break a PostgREST or(...) filter must not error.
    const nasty = await listGuests(weddingA!, { query: 'a,b)(c*%"', groupId: null });
    expect(nasty.ok).toBe(true);

    const updated = must(await updateGuest(weddingA!, guestId, { phone: '+251911000000', side: 'both' }));
    expect(updated.phone).toBe('+251911000000');
    expect(must(await getGuest(weddingA!, guestId)).side).toBe('both');
  });

  it('pages guests 40 at a time', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const rows = Array.from({ length: 42 }, (_, index) => ({
      wedding_id: weddingA!,
      full_name: `Page Guest ${String(index).padStart(2, '0')}`,
    }));
    const inserted = await supabase.from('guests').insert(rows);
    expect(inserted.error).toBeNull();

    const first = must(await listGuests(weddingA!, { query: 'Page Guest', groupId: null }, 0));
    expect(first.items).toHaveLength(GUEST_PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    const second = must(await listGuests(weddingA!, { query: 'Page Guest', groupId: null }, 1));
    expect(second.items).toHaveLength(2);
    expect(second.hasMore).toBe(false);
    expect(first.items[0].full_name <= first.items[1].full_name).toBe(true);

    const summaries = must(await listGuestSummaries(weddingA!));
    expect(summaries.length).toBe(44);
  });

  it("isolates one couple's guests from another user", async ({ skip }) => {
    if (!ready || !weddingA || !weddingB) skip();
    await signInAs(emailB);

    const peek = must(await listGuests(weddingA!, { query: '', groupId: null }));
    expect(peek.items).toHaveLength(0);
    const peekGuest = await getGuest(weddingA!, guestId);
    expect(peekGuest.ok).toBe(false);
    expect(must(await listInvitations(weddingA!))).toHaveLength(0);
    expect(must(await listRsvpsForWedding(weddingA!))).toHaveLength(0);

    const write = await createGuest(weddingA!, { fullName: 'Intruder' });
    expect(write.ok).toBe(false);
    const rename = await updateGuest(weddingA!, guestId, { fullName: 'Hacked' });
    expect(rename.ok).toBe(false);

    const own = must(await createGuest(weddingB!, { fullName: 'Own Guest' }));
    expect(own.wedding_id).toBe(weddingB);
    expect(must(await listGuests(weddingB!, { query: '', groupId: null })).items).toHaveLength(1);

    const invite = await createInvitation({ weddingId: weddingA!, guestId });
    expect(invite.ok).toBe(false);

    await signInAs(emailA);
  });

  it('creates designs and events', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const design = must(
      await createInvitationDesign(weddingA!, {
        name: 'Gold classic',
        designData: { title: 'Join us', accent: '#C5A36A', layout: 'floral' },
      }),
    );
    designId = design.id;
    expect(design.design_data).toEqual({ title: 'Join us', accent: '#C5A36A', layout: 'floral' });

    const renamed = must(
      await updateInvitationDesign(weddingA!, designId, {
        name: 'Gold floral',
        designData: { title: 'Join us', message: 'Celebrate', layout: 'floral' },
      }),
    );
    expect(renamed.name).toBe('Gold floral');
    expect(must(await listInvitationDesigns(weddingA!))).toHaveLength(1);

    eventOneId = must(await createWeddingEvent(weddingA!, { name: 'Ceremony' })).id;
    eventTwoId = must(await createWeddingEvent(weddingA!, { name: 'Reception', eventType: 'reception' })).id;
  });

  it('creates an invitation via RPC and exposes the raw token only once', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const created = must(
      await createInvitation({ weddingId: weddingA!, guestId, designId, eventIds: [eventOneId, eventTwoId] }),
    );
    invitationId = created.invitationId;
    rawToken = created.rawToken;
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);

    const list = must(await listInvitations(weddingA!));
    const item = list.find((row) => row.id === invitationId);
    expect(item).toBeDefined();
    expect(item!.status).toBe('ready');
    expect(item!.guest?.full_name).toBe('Abebe Kebede');
    expect(item!.design?.name).toBe('Gold floral');
    expect([...item!.event_ids].sort()).toEqual([eventOneId, eventTwoId].sort());
    // The app never selects the hash.
    expect(Object.keys(item!)).not.toContain('token_hash');
    expect(INVITATION_COLUMNS).not.toContain('token_hash');

    const neither = await createInvitation({ weddingId: weddingA! });
    expect(neither.ok).toBe(false);
  });

  it('serves the preview to an anonymous client and records the first open', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const { data, error } = await anon.rpc('get_guest_invitation_by_token', { p_raw_token: rawToken });
    expect(error).toBeNull();
    const preview = parseInvitePreview(data);
    expect(preview).not.toBeNull();
    expect(preview!.wedding.partner_one_name).toBe('Selam');
    expect(preview!.design?.design_data.layout).toBe('floral');
    expect(preview!.events.map((event) => event.id).sort()).toEqual([eventOneId, eventTwoId].sort());
    expect(preview!.guests.map((guest) => guest.id)).toEqual([guestId]);
    expect(JSON.stringify(data)).not.toContain('token_hash');

    const opened = must(await listInvitations(weddingA!)).find((row) => row.id === invitationId);
    expect(opened!.status).toBe('opened');
    expect(opened!.opened_at).toBeTruthy();

    const bad = await anon.rpc('get_guest_invitation_by_token', { p_raw_token: 'not-a-real-token' });
    expect(bad.error).toBeTruthy();

    // Anonymous users cannot read guests or create invitations directly.
    const guests = await anon.from('guests').select('id').eq('wedding_id', weddingA!);
    expect(guests.data ?? []).toHaveLength(0);
    const created = await anon.rpc('create_guest_invitation', { p_wedding_id: weddingA!, p_guest_id: guestId });
    expect(created.error).toBeTruthy();
  });

  it('maps token errors through the service', async ({ skip }) => {
    if (!ready) skip();
    const result = await getInvitationPreviewByToken('definitely-not-valid');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_token');
  });

  it('submits RSVPs by token and upserts duplicates', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const first = await anon.rpc('submit_guest_invitation_rsvp', {
      p_raw_token: rawToken,
      p_guest_id: guestId,
      p_event_id: eventOneId,
      p_response: 'yes',
    });
    expect(first.error).toBeNull();
    expect(first.data?.response).toBe('yes');
    expect(first.data?.responded_at).toBeTruthy();

    const again = await anon.rpc('submit_guest_invitation_rsvp', {
      p_raw_token: rawToken,
      p_guest_id: guestId,
      p_event_id: eventOneId,
      p_response: 'no',
    });
    expect(again.error).toBeNull();
    expect(again.data?.response).toBe('no');

    const rows = must(await listRsvpsForWedding(weddingA!)).filter(
      (row) => row.guest_id === guestId && row.event_id === eventOneId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].response).toBe('no');

    // A guest outside the invitation, a bad response and a bad token are all rejected.
    const outsider = await anon.rpc('submit_guest_invitation_rsvp', {
      p_raw_token: rawToken,
      p_guest_id: guestTwoId,
      p_event_id: eventOneId,
      p_response: 'yes',
    });
    expect(outsider.error).toBeTruthy();
    const badResponse = await submitRsvpByToken({
      rawToken,
      guestId,
      eventId: eventOneId,
      response: 'definitely' as never,
    });
    expect(badResponse.ok).toBe(false);
    const badToken = await submitRsvpByToken({
      rawToken: 'nope',
      guestId,
      eventId: eventOneId,
      response: 'yes',
    });
    expect(badToken.ok).toBe(false);
    if (!badToken.ok) expect(badToken.error.code).toBe('invalid_token');

    // The service path (signed in) also works and updates the same row.
    const viaService = must(
      await submitRsvpByToken({ rawToken, guestId, eventId: eventOneId, response: 'maybe' }),
    );
    expect(viaService.response).toBe('maybe');
  });

  it('lets the planner set an RSVP', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const saved = must(await setGuestRsvp(guestTwoId, eventTwoId, 'yes'));
    expect(saved.response).toBe('yes');
    const changed = must(await setGuestRsvp(guestTwoId, eventTwoId, 'pending'));
    expect(changed.response).toBe('pending');
    expect(changed.responded_at).toBeNull();
    const rows = must(await listRsvpsForWedding(weddingA!)).filter((row) => row.guest_id === guestTwoId);
    expect(rows).toHaveLength(1);
  });

  it('marks shared and cancels, and a cancelled link stops working', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const created = must(await createInvitation({ weddingId: weddingA!, guestId: guestTwoId, designId }));
    const sent = must(await markInvitationSent(created.invitationId));
    expect(sent.status).toBe('sent');
    expect(sent.sent_at).toBeTruthy();
    expect(Object.keys(sent)).not.toContain('token_hash');

    const cancelled = must(await cancelInvitation(weddingA!, created.invitationId));
    expect(cancelled.status).toBe('cancelled');

    const preview = await getInvitationPreviewByToken(created.rawToken);
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.error.code).toBe('cancelled');
    const cannotSend = await markInvitationSent(created.invitationId);
    expect(cannotSend.ok).toBe(false);
  });

  it('enforces seating capacity and moves guests between tables', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const small = must(await createTable(eventOneId, { name: 'Head table', capacity: 1 }));
    const roomy = must(await createTable(eventOneId, { name: 'Table 2' }));

    const dupName = await createTable(eventOneId, { name: 'Head table' });
    expect(dupName.ok).toBe(false);
    if (!dupName.ok) expect(dupName.error.code).toBe('duplicate');

    must(await assignGuest({ eventId: eventOneId, tableId: small.id, guestId }));
    const full = await assignGuest({ eventId: eventOneId, tableId: small.id, guestId: guestTwoId });
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.error.code).toBe('table_full');

    // Re-seating the same guest at their own table is not blocked by capacity.
    must(await assignGuest({ eventId: eventOneId, tableId: small.id, guestId }));

    // Moving to an unlimited table updates the single assignment row.
    must(await assignGuest({ eventId: eventOneId, tableId: roomy.id, guestId }));
    must(await assignGuest({ eventId: eventOneId, tableId: small.id, guestId: guestTwoId }));
    const assignments = must(await listAssignments(eventOneId));
    expect(assignments).toHaveLength(2);
    expect(assignments.find((a) => a.guest_id === guestId)?.table_id).toBe(roomy.id);

    must(await unassignGuest(eventOneId, guestId));
    expect(must(await listAssignments(eventOneId))).toHaveLength(1);

    expect(must(await listTables(eventOneId))).toHaveLength(2);
    must(await deleteTable(eventOneId, small.id));
    expect(must(await listAssignments(eventOneId))).toHaveLength(0);
  });

  it('cleans up invitations when deleting a guest or group', async ({ skip }) => {
    if (!ready || !weddingA) skip();
    const solo = must(await createGuest(weddingA!, { fullName: 'Solo Delete' }));
    const soloInvite = must(await createInvitation({ weddingId: weddingA!, guestId: solo.id }));
    must(await deleteGuest(weddingA!, solo.id));
    expect(must(await listInvitations(weddingA!)).some((row) => row.id === soloInvite.invitationId)).toBe(false);

    const group = must(await createGuestGroup(weddingA!, { name: 'Doomed group' }));
    const member = must(await createGuest(weddingA!, { fullName: 'Group Member', groupId: group.id }));
    const groupInvite = must(await createInvitation({ weddingId: weddingA!, groupId: group.id }));
    const preview = await getInvitationPreviewByToken(groupInvite.rawToken);
    expect(preview.ok && preview.data.guests.map((g) => g.id)).toEqual([member.id]);

    must(await deleteGuestGroup(weddingA!, group.id));
    expect(must(await listInvitations(weddingA!)).some((row) => row.id === groupInvite.invitationId)).toBe(false);
    const survivor = must(await getGuest(weddingA!, member.id));
    expect(survivor.group_id).toBeNull();

    // Deleting a guest who has both a personal and a group invitation keeps the group one.
    const grouped = must(await createGuest(weddingA!, { fullName: 'Grouped Delete', groupId }));
    const both = must(await createInvitation({ weddingId: weddingA!, guestId: grouped.id, groupId }));
    must(await deleteGuest(weddingA!, grouped.id));
    expect((await getGuest(weddingA!, grouped.id)).ok).toBe(false);
    const kept = must(await listInvitations(weddingA!)).find((row) => row.id === both.invitationId);
    expect(kept).toBeDefined();
    expect(kept!.guest_id).toBeNull();
    expect(kept!.group_id).toBe(groupId);
  });
});

afterAll(async () => {
  await supabase.auth.signOut();
});
