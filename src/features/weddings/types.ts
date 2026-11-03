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

export type CelebrationKind =
  | 'wedding'
  | 'shemgelena'
  | 'qelekel'
  | 'baby_shower'
  | 'birthday'
  | 'anniversary'
  | 'graduation'
  | 'other';

export type BudgetAllocationInput = {
  categorySlug: string;
  amount: number;
};

export type CreateWeddingInput = {
  title: string;
  celebrationKind?: CelebrationKind;
  partnerOneName?: string | null;
  partnerTwoName?: string | null;
  weddingDate?: string | null;
  city?: string | null;
  style?: string | null;
  countryCode?: string;
  timezone?: string;
  currencyCode?: string;
  estimatedGuestCount?: number | null;
  totalBudget?: number;
  budgetAllocations?: BudgetAllocationInput[];
};
