import type {
  InvitationStatus,
  PublicInviteEvent,
  PublicInviteGuest,
  PublicInvitePreview,
  PublicInviteRsvp,
  RsvpResponse,
} from '@/features/guests/types';
import { parseDesignData } from '@/features/guests/utils/guestHelpers';

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function response(value: unknown): RsvpResponse {
  return value === 'yes' || value === 'no' || value === 'maybe' ? value : 'pending';
}

function parseEvent(value: unknown): PublicInviteEvent | null {
  if (!isObj(value) || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    name: str(value.name) ?? 'Event',
    event_type: str(value.event_type) ?? 'other',
    starts_at: str(value.starts_at),
    venue_name: str(value.venue_name),
    city: str(value.city),
  };
}

function parseRsvp(value: unknown): PublicInviteRsvp | null {
  if (!isObj(value) || typeof value.event_id !== 'string') return null;
  return {
    event_id: value.event_id,
    response: response(value.response),
    responded_at: str(value.responded_at),
  };
}

function parseGuest(value: unknown): PublicInviteGuest | null {
  if (!isObj(value) || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    full_name: str(value.full_name) ?? 'Guest',
    plus_one_allowed: value.plus_one_allowed === true,
    rsvps: (Array.isArray(value.rsvps) ? value.rsvps : [])
      .map(parseRsvp)
      .filter((item): item is PublicInviteRsvp => item !== null),
  };
}

/**
 * Validates the jsonb returned by `get_guest_invitation_by_token`. Anything unexpected is dropped
 * rather than trusted; returns null when the payload is not an invitation at all.
 */
export function parsePublicInvitePreview(value: unknown): PublicInvitePreview | null {
  if (!isObj(value) || typeof value.invitation_id !== 'string' || !isObj(value.wedding)) return null;
  const wedding = value.wedding;
  const design = isObj(value.design) && typeof value.design.id === 'string' ? value.design : null;

  return {
    invitation_id: value.invitation_id,
    status: (str(value.status) ?? 'ready') as InvitationStatus,
    opened_at: str(value.opened_at),
    wedding: {
      title: str(wedding.title) ?? '',
      partner_one_name: str(wedding.partner_one_name) ?? '',
      partner_two_name: str(wedding.partner_two_name) ?? '',
      wedding_date: str(wedding.wedding_date),
      city: str(wedding.city),
      country_code: str(wedding.country_code),
    },
    design: design
      ? {
          id: design.id as string,
          name: str(design.name) ?? 'Invitation',
          design_data: parseDesignData(design.design_data),
        }
      : null,
    events: (Array.isArray(value.events) ? value.events : [])
      .map(parseEvent)
      .filter((item): item is PublicInviteEvent => item !== null),
    guests: (Array.isArray(value.guests) ? value.guests : [])
      .map(parseGuest)
      .filter((item): item is PublicInviteGuest => item !== null),
  };
}

/** Returns a copy of the preview with one RSVP applied (used after a successful submit). */
export function applyRsvpToPreview(
  preview: PublicInvitePreview,
  rsvp: { guest_id: string; event_id: string; response: RsvpResponse; responded_at: string | null },
): PublicInvitePreview {
  return {
    ...preview,
    guests: preview.guests.map((guest) => {
      if (guest.id !== rsvp.guest_id) return guest;
      const others = guest.rsvps.filter((item) => item.event_id !== rsvp.event_id);
      return {
        ...guest,
        rsvps: [
          ...others,
          { event_id: rsvp.event_id, response: rsvp.response, responded_at: rsvp.responded_at },
        ],
      };
    }),
  };
}
