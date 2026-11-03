import { describe, expect, it } from 'vitest';

import {
  createInvitationSchema,
  designFormSchema,
  eventFormSchema,
  fieldErrorsFromZod,
  groupFormSchema,
  guestFormSchema,
  rsvpSchema,
  tableFormSchema,
} from './guestSchemas';

const UUID = '3f2b8c1e-5d4a-4c6b-9a1d-2e7f8a9b0c1d';

describe('guestFormSchema', () => {
  it('accepts a minimal guest and trims', () => {
    const parsed = guestFormSchema.parse({ fullName: '  Abebe Kebede ' });
    expect(parsed.fullName).toBe('Abebe Kebede');
    expect(parsed.plusOneAllowed).toBe(false);
    expect(parsed.email).toBeUndefined();
    expect(parsed.side).toBeUndefined();
  });

  it('normalizes optional fields', () => {
    const parsed = guestFormSchema.parse({
      fullName: 'Chaltu',
      email: ' Chaltu@Example.com ',
      phone: '+251 911 000 000',
      groupId: '',
      side: 'both',
      guestType: '',
      plusOneAllowed: true,
    });
    expect(parsed.email).toBe('chaltu@example.com');
    expect(parsed.groupId).toBeUndefined();
    expect(parsed.side).toBe('both');
    expect(parsed.guestType).toBeUndefined();
    expect(parsed.plusOneAllowed).toBe(true);
  });

  it('rejects empty name, bad email, bad phone and bad side', () => {
    const result = guestFormSchema.safeParse({
      fullName: ' ',
      email: 'nope',
      phone: 'abc',
      side: 'nobody',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrorsFromZod(result.error);
      expect(errors.fullName).toBeTruthy();
      expect(errors.email).toBeTruthy();
      expect(errors.phone).toBeTruthy();
      expect(errors.side).toBeTruthy();
    }
  });
});

describe('groupFormSchema', () => {
  it('requires a name', () => {
    expect(groupFormSchema.safeParse({ name: '' }).success).toBe(false);
    expect(groupFormSchema.parse({ name: 'Cousins', side: 'partner_one' }).side).toBe('partner_one');
  });
});

describe('designFormSchema', () => {
  it('defaults the layout and validates the accent', () => {
    expect(designFormSchema.parse({ name: 'Gold' }).layout).toBe('classic');
    expect(designFormSchema.safeParse({ name: 'Gold', accent: 'gold' }).success).toBe(false);
    expect(designFormSchema.parse({ name: 'Gold', accent: '#abc', layout: 'modern' }).accent).toBe('#abc');
  });

  it('rejects unknown layouts', () => {
    expect(designFormSchema.safeParse({ name: 'x', layout: 'neon' }).success).toBe(false);
  });
});

describe('eventFormSchema', () => {
  it('defaults to a ceremony', () => {
    expect(eventFormSchema.parse({ name: 'Wedding ceremony' }).eventType).toBe('ceremony');
    expect(eventFormSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('rsvpSchema', () => {
  it('accepts valid responses only', () => {
    expect(rsvpSchema.safeParse({ guestId: UUID, eventId: UUID, response: 'yes' }).success).toBe(true);
    expect(rsvpSchema.safeParse({ guestId: UUID, eventId: UUID, response: 'definitely' }).success).toBe(false);
    expect(rsvpSchema.safeParse({ guestId: 'x', eventId: UUID, response: 'no' }).success).toBe(false);
  });
});

describe('tableFormSchema', () => {
  it('parses capacity', () => {
    expect(tableFormSchema.parse({ name: 'Table 1', capacity: '8' }).capacity).toBe(8);
    expect(tableFormSchema.parse({ name: 'Table 1', capacity: '' }).capacity).toBeUndefined();
    expect(tableFormSchema.parse({ name: 'Table 1' }).capacity).toBeUndefined();
  });

  it('rejects zero, negative and non-numeric capacity', () => {
    expect(tableFormSchema.safeParse({ name: 'T', capacity: '0' }).success).toBe(false);
    expect(tableFormSchema.safeParse({ name: 'T', capacity: '-2' }).success).toBe(false);
    expect(tableFormSchema.safeParse({ name: 'T', capacity: 'ten' }).success).toBe(false);
    expect(tableFormSchema.safeParse({ name: '', capacity: '4' }).success).toBe(false);
  });
});

describe('createInvitationSchema', () => {
  it('needs exactly one of guest or group', () => {
    expect(createInvitationSchema.safeParse({ guestId: UUID }).success).toBe(true);
    expect(createInvitationSchema.safeParse({ groupId: UUID }).success).toBe(true);
    expect(createInvitationSchema.safeParse({}).success).toBe(false);
    expect(createInvitationSchema.safeParse({ guestId: UUID, groupId: UUID }).success).toBe(false);
  });
});
