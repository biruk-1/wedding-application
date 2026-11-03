import type { Database } from '@/types/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export type ProfileUpdateInput = {
  displayName: string;
  phone?: string | null;
  avatarUrl?: string | null;
};
