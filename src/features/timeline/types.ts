import type { Database } from '@/types/database.types';

export type WeddingEvent = Database['public']['Tables']['wedding_events']['Row'];
export type TimelineItem = Database['public']['Tables']['timeline_items']['Row'];

/** Suggested event types for the UI. The DB column is unconstrained text. */
export const EVENT_TYPES = [
  'ceremony',
  'reception',
  'engagement',
  'rehearsal',
  'photography',
  'venue_visit',
  'other',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EventInput = {
  name: string;
  eventType: string;
  startsAt?: string | null;
  endsAt?: string | null;
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  sortOrder?: number;
};

export type TimelineItemInput = {
  title: string;
  startsAt?: string | null;
  endsAt?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  sortOrder?: number;
};

export type TimelineItemWithAssignee = TimelineItem & {
  assignee: { id: string; display_name: string } | null;
};

export type RelatedTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
};

export type RelatedBooking = {
  id: string;
  status: string;
  booking_date: string | null;
  start_at: string | null;
  end_at: string | null;
  notes: string | null;
  vendorName: string;
  weddingVendorId: string;
};

export type EventFilter = 'all' | 'upcoming' | 'past';

export type CalendarDay = {
  /** YYYY-MM-DD in the wedding timezone */
  dateKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  hasEvents: boolean;
};
