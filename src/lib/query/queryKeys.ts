import type { BudgetServerFilters } from '@/features/budget/types';
import type { GuestServerFilters } from '@/features/guests/types';
import type { VendorServerFilters } from '@/features/vendors/types';

/**
 * Every key starts with the signed-in user id, so cached rows from one account can never be
 * read by another account on the same device. The cache is also cleared on account change.
 */
export const queryKeys = {
  user: (userId: string) => ['u', userId] as const,
  memberships: (userId: string) => ['u', userId, 'memberships'] as const,
  /** Pending Planning Team invites addressed to this user (any wedding). */
  myPendingTeamInvites: (userId: string) =>
    ['u', userId, 'my-pending-team-invites'] as const,

  wedding: (userId: string, weddingId: string) => ['u', userId, 'wedding', weddingId] as const,
  tasks: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'tasks'] as const,
  task: (userId: string, weddingId: string, taskId: string) =>
    ['u', userId, 'wedding', weddingId, 'tasks', taskId] as const,
  taskComments: (userId: string, weddingId: string, taskId: string) =>
    ['u', userId, 'wedding', weddingId, 'task-comments', taskId] as const,
  weddingMembers: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'members'] as const,
  /** Effective access from `get_my_wedding_access` (display only). */
  myAccess: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'my-access'] as const,
  /** Planning Team roster from `list_team_members`. */
  teamMembers: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'team-members'] as const,
  teamInvites: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'team-invites'] as const,
  memberPermissions: (userId: string, weddingId: string, memberUserId: string) =>
    ['u', userId, 'wedding', weddingId, 'member-permissions', memberUserId] as const,
  groupCoordinators: (userId: string, weddingId: string, groupId?: string) =>
    groupId
      ? (['u', userId, 'wedding', weddingId, 'group-coordinators', groupId] as const)
      : (['u', userId, 'wedding', weddingId, 'group-coordinators'] as const),
  memberCoordinations: (userId: string, weddingId: string, memberUserId: string) =>
    ['u', userId, 'wedding', weddingId, 'member-coordinations', memberUserId] as const,
  roleTemplatePermissions: (userId: string, template: string) =>
    ['u', userId, 'ref', 'role-template', template] as const,
  teamActivity: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'team-activity'] as const,
  /**
   * Public Planning Team invite preview. Not under `['u', userId]` — join works signed out.
   */
  publicTeamInvite: (token: string) => ['team-invite', token] as const,
  weddingVendor: (userId: string, weddingId: string, vendorId: string) =>
    ['u', userId, 'wedding', weddingId, 'saved-vendor', vendorId] as const,
  weddingQuotes: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'quotes'] as const,
  weddingQuote: (userId: string, weddingId: string, quoteId: string) =>
    ['u', userId, 'wedding', weddingId, 'quotes', quoteId] as const,
  weddingBookings: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'bookings'] as const,
  weddingBooking: (userId: string, weddingId: string, bookingId: string) =>
    ['u', userId, 'wedding', weddingId, 'bookings', bookingId] as const,
  weddingFiles: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'files'] as const,
  profile: (userId: string) => ['u', userId, 'profile'] as const,

  guestGroups: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'guest-groups'] as const,
  /** Prefix for every guest query of a wedding (list pages, summaries, detail). */
  guestsRoot: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'guests'] as const,
  guests: (userId: string, weddingId: string, filters: GuestServerFilters) =>
    ['u', userId, 'wedding', weddingId, 'guests', 'list', filters] as const,
  guestSummaries: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'guests', 'summaries'] as const,
  guestStats: (userId: string, weddingId: string, eventId: string | null) =>
    ['u', userId, 'wedding', weddingId, 'guests', 'stats', eventId] as const,
  guest: (userId: string, weddingId: string, guestId: string) =>
    ['u', userId, 'wedding', weddingId, 'guests', 'detail', guestId] as const,
  invitationDesigns: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'invitation-designs'] as const,
  invitations: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'invitations'] as const,
  weddingEvents: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'events'] as const,
  weddingEvent: (userId: string, weddingId: string, eventId: string) =>
    ['u', userId, 'wedding', weddingId, 'events', eventId] as const,
  timelineItems: (userId: string, weddingId: string, eventId: string) =>
    ['u', userId, 'wedding', weddingId, 'events', eventId, 'timeline'] as const,
  eventRelatedTasks: (userId: string, weddingId: string, eventId: string) =>
    ['u', userId, 'wedding', weddingId, 'events', eventId, 'tasks'] as const,
  eventRelatedBookings: (userId: string, weddingId: string, eventId: string) =>
    ['u', userId, 'wedding', weddingId, 'events', eventId, 'bookings'] as const,
  guestRsvps: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'guest-rsvps'] as const,
  /** Prefix for all seating queries of a wedding. */
  seatingRoot: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'seating'] as const,
  seatingTables: (userId: string, weddingId: string, eventId: string) =>
    ['u', userId, 'wedding', weddingId, 'seating', eventId, 'tables'] as const,
  seatingAssignments: (userId: string, weddingId: string, eventId: string) =>
    ['u', userId, 'wedding', weddingId, 'seating', eventId, 'assignments'] as const,
  /**
   * Public (token-authorised) invitation preview. Deliberately not under `['u', userId]`: the
   * invite screen works signed out. It holds only what the token grants and the whole cache is
   * cleared whenever the signed-in account changes.
   */
  publicInvite: (token: string) => ['invite', token] as const,
  /**
   * Public marketplace (Explore). Not user-scoped: every read is limited to published, verified
   * vendors and public columns, so the result is the same for every viewer and signed-out guests.
   */
  publicVendorsRoot: () => ['public', 'vendors'] as const,
  publicVendorCategories: () => ['public', 'vendors', 'categories'] as const,
  publicVendorCities: () => ['public', 'vendors', 'cities'] as const,
  publicVendorSearch: (filters: VendorServerFilters) =>
    ['public', 'vendors', 'search', filters] as const,
  publicVendorServices: (categoryId: string | null) =>
    ['public', 'vendors', 'services', categoryId ?? 'all'] as const,
  publicVendorProfile: (vendorId: string) => ['public', 'vendors', 'profile', vendorId] as const,

  weddingBudget: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'budget'] as const,
  budgetItemsRoot: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'budget-items'] as const,
  budgetItemSummaries: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'budget-items', 'summaries'] as const,
  budgetItems: (userId: string, weddingId: string, filters: BudgetServerFilters) =>
    ['u', userId, 'wedding', weddingId, 'budget-items', 'list', filters] as const,
  budgetItem: (userId: string, weddingId: string, itemId: string) =>
    ['u', userId, 'wedding', weddingId, 'budget-items', 'detail', itemId] as const,
  budgetPayments: (userId: string, weddingId: string, itemId: string) =>
    ['u', userId, 'wedding', weddingId, 'budget-items', itemId, 'payments'] as const,
  budgetVendorOptions: (userId: string, weddingId: string) =>
    ['u', userId, 'wedding', weddingId, 'budget-vendor-options'] as const,
  budgetCategories: (userId: string) => ['u', userId, 'ref', 'budget-categories'] as const,

  taskCategories: (userId: string) => ['u', userId, 'ref', 'task-categories'] as const,
  checklistTemplateCount: (userId: string) => ['u', userId, 'ref', 'template-count'] as const,
  vendorCategories: (userId: string) => ['u', userId, 'ref', 'vendor-categories'] as const,
  vendorCities: (userId: string) => ['u', userId, 'ref', 'vendor-cities'] as const,

  vendorsRoot: (userId: string) => ['u', userId, 'vendors'] as const,
  vendorList: (userId: string, filters: VendorServerFilters) =>
    ['u', userId, 'vendors', 'list', filters] as const,
  vendorProfile: (userId: string, vendorId: string) =>
    ['u', userId, 'vendors', 'profile', vendorId] as const,
};

/** Cache lifetimes by how often the underlying data changes. */
export const staleTimes = {
  /** Lookup tables edited only by migrations / seed. */
  reference: 60 * 60_000,
  /** Public vendor listings change rarely during a session. */
  vendors: 5 * 60_000,
  /** Wedding data can be edited by partners on other devices. */
  wedding: 60_000,
  /** Collaborative lists (tasks, comments) refresh in the background on revisit. */
  collaborative: 30_000,
} as const;
