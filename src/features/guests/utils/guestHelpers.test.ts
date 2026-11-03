import { describe, expect, it } from 'vitest';

import type { GuestRsvp, SeatingTable } from '@/features/guests/types';
import {
  buildGuestSearchFilter,
  buildRsvpStatusMap,
  computeGuestStats,
  filterGuests,
  filterInvitations,
  guestRsvpStatus,
  hasSeatAvailable,
  overallRsvpStatus,
  parseDesignData,
  sanitizeSearchTerm,
  summarizeInvitations,
  tableOccupancy,
} from './guestHelpers';

function guest(id: string, extra: Partial<{ full_name: string; group_id: string | null; plus_one_allowed: boolean; email: string | null }> = {}) {
  return { id, full_name: `Guest ${id}`, group_id: null, plus_one_allowed: false, email: null, phone: null, ...extra };
}

function rsvp(guest_id: string, event_id: string, response: GuestRsvp['response']) {
  return { guest_id, event_id, response };
}

const guests = [
  guest('a', { full_name: 'Abebe Kebede', group_id: 'g1', plus_one_allowed: true }),
  guest('b', { full_name: 'Bethlehem Tadesse', group_id: 'g1' }),
  guest('c', { full_name: 'Chaltu Ali', group_id: 'g2', email: 'chaltu@example.com' }),
  guest('d', { full_name: 'Dawit Haile' }),
];

const rsvps = [
  rsvp('a', 'e1', 'yes'),
  rsvp('b', 'e1', 'no'),
  rsvp('c', 'e1', 'maybe'),
  rsvp('a', 'e2', 'no'),
  rsvp('d', 'e2', 'pending'),
];

describe('computeGuestStats', () => {
  it('counts a single event, treating a missing rsvp as pending', () => {
    expect(computeGuestStats({ guests, rsvps, eventId: 'e1' })).toEqual({
      total: 4,
      yes: 1,
      no: 1,
      maybe: 1,
      pending: 1,
      plusOnesAllowed: 1,
    });
  });

  it('counts each guest once across events when no event is chosen', () => {
    const stats = computeGuestStats({ guests, rsvps, eventId: null });
    expect(stats.total).toBe(4);
    // a: yes (beats no), b: no, c: maybe, d: pending
    expect(stats).toMatchObject({ yes: 1, no: 1, maybe: 1, pending: 1 });
    expect(stats.yes + stats.no + stats.maybe + stats.pending).toBe(stats.total);
  });

  it('ignores rsvps for guests outside the list', () => {
    const stats = computeGuestStats({
      guests: [guest('a')],
      rsvps: [rsvp('zzz', 'e1', 'yes')],
      eventId: 'e1',
    });
    expect(stats).toMatchObject({ total: 1, yes: 0, pending: 1 });
  });

  it('handles an empty guest list', () => {
    expect(computeGuestStats({ guests: [], rsvps: [], eventId: null })).toEqual({
      total: 0,
      yes: 0,
      no: 0,
      maybe: 0,
      pending: 0,
      plusOnesAllowed: 0,
    });
  });
});

describe('filterGuests', () => {
  it('returns everyone for rsvp "all"', () => {
    expect(filterGuests(guests, rsvps, { rsvp: 'all' })).toHaveLength(4);
  });

  it('filters by rsvp status for an event', () => {
    expect(filterGuests(guests, rsvps, { rsvp: 'yes', eventId: 'e1' }).map((g) => g.id)).toEqual(['a']);
    expect(filterGuests(guests, rsvps, { rsvp: 'pending', eventId: 'e1' }).map((g) => g.id)).toEqual(['d']);
  });

  it('filters by overall status when no event is selected', () => {
    expect(filterGuests(guests, rsvps, { rsvp: 'no' }).map((g) => g.id)).toEqual(['b']);
  });

  it('combines group and query filters', () => {
    expect(filterGuests(guests, rsvps, { groupId: 'g1' }).map((g) => g.id)).toEqual(['a', 'b']);
    expect(filterGuests(guests, rsvps, { query: 'CHALTU@' }).map((g) => g.id)).toEqual(['c']);
    expect(filterGuests(guests, rsvps, { groupId: 'g1', rsvp: 'yes', eventId: 'e1' }).map((g) => g.id)).toEqual([
      'a',
    ]);
  });
});

describe('rsvp helpers', () => {
  it('prefers yes, then maybe, then no', () => {
    expect(overallRsvpStatus(['no', 'yes'])).toBe('yes');
    expect(overallRsvpStatus(['no', 'maybe'])).toBe('maybe');
    expect(overallRsvpStatus(['no'])).toBe('no');
    expect(overallRsvpStatus([])).toBe('pending');
  });

  it('reads one guest status', () => {
    expect(guestRsvpStatus('a', rsvps, 'e2')).toBe('no');
    expect(guestRsvpStatus('a', rsvps, 'missing-event')).toBe('pending');
  });
});

describe('buildRsvpStatusMap', () => {
  it('maps every guest, defaulting to pending', () => {
    const map = buildRsvpStatusMap(guests, rsvps, 'e1');
    expect(map.get('a')).toBe('yes');
    expect(map.get('b')).toBe('no');
    expect(map.get('d')).toBe('pending');
    expect(map.size).toBe(4);
  });
});

describe('search helpers', () => {
  it('strips wildcards and quotes', () => {
    expect(sanitizeSearchTerm('  ab%c*"d\\  e ')).toBe('abcd e');
  });

  it('builds an or filter, or null when empty', () => {
    expect(buildGuestSearchFilter('   ')).toBeNull();
    expect(buildGuestSearchFilter('%%')).toBeNull();
    expect(buildGuestSearchFilter('abe')).toBe(
      'full_name.ilike."*abe*",email.ilike."*abe*",phone.ilike."*abe*"',
    );
  });
});

describe('invitation helpers', () => {
  const invitations = [
    { id: '1', status: 'ready' },
    { id: '2', status: 'sent' },
    { id: '3', status: 'opened' },
    { id: '4', status: 'opened' },
    { id: '5', status: 'cancelled' },
  ];

  it('summarizes by status', () => {
    expect(summarizeInvitations(invitations)).toEqual({
      total: 5,
      draft: 0,
      ready: 1,
      sent: 1,
      delivered: 0,
      opened: 2,
      cancelled: 1,
    });
  });

  it('filters by status', () => {
    expect(filterInvitations(invitations, 'opened')).toHaveLength(2);
    expect(filterInvitations(invitations, 'all')).toHaveLength(5);
  });
});

describe('parseDesignData', () => {
  it('keeps only valid, known keys', () => {
    expect(
      parseDesignData({
        title: ' Our day ',
        message: 'Join us',
        accent: '#C5A36A',
        layout: 'floral',
        evil: '<script>',
      }),
    ).toEqual({ title: 'Our day', message: 'Join us', accent: '#C5A36A', layout: 'floral' });
  });

  it('rejects bad accents and layouts', () => {
    expect(parseDesignData({ accent: 'red', layout: 'neon' })).toEqual({});
    expect(parseDesignData(null)).toEqual({});
    expect(parseDesignData([])).toEqual({});
  });
});

describe('seating helpers', () => {
  const tables: SeatingTable[] = [
    { id: 't1', event_id: 'e1', name: 'One', capacity: 2, sort_order: 0 },
    { id: 't2', event_id: 'e1', name: 'Two', capacity: null, sort_order: 1 },
  ];

  it('computes occupancy and flags full tables', () => {
    const result = tableOccupancy(tables, [
      { table_id: 't1' },
      { table_id: 't1' },
      { table_id: 't2' },
    ]);
    expect(result[0]).toMatchObject({ assigned: 2, remaining: 0, isFull: true, isOverCapacity: false });
    expect(result[1]).toMatchObject({ assigned: 1, remaining: null, isFull: false });
  });

  it('flags over-capacity tables', () => {
    const [first] = tableOccupancy(tables, [{ table_id: 't1' }, { table_id: 't1' }, { table_id: 't1' }]);
    expect(first.isOverCapacity).toBe(true);
  });

  it('checks seat availability', () => {
    expect(hasSeatAvailable(2, 1)).toBe(true);
    expect(hasSeatAvailable(2, 2)).toBe(false);
    expect(hasSeatAvailable(null, 500)).toBe(true);
  });
});
