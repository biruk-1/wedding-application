import type { Database } from '@/types/database.types';

export type Wedding = Database['public']['Tables']['weddings']['Row'];
export type WeddingMemberRole =
  Database['public']['Tables']['wedding_members']['Row']['role'];

export type WeddingMembership = {
  wedding_id: string;
  role: WeddingMemberRole;
  joined_at: string;
  wedding: Wedding;
};

export type CreateWeddingInput = {
  title: string;
  partnerOneName: string;
  partnerTwoName: string;
  weddingDate?: string | null;
  city?: string | null;
  style?: string | null;
  countryCode?: string;
  timezone?: string;
  currencyCode?: string;
  estimatedGuestCount?: number | null;
};
