import { supabase } from '@/lib/supabase';
import type { CreateWeddingInput, Wedding, WeddingMembership } from '@/features/weddings/types';
import type { Database } from '@/types/database.types';
import { mapWeddingError, type WeddingUserMessage } from '@/features/weddings/services/weddingErrors';

export type WeddingResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WeddingUserMessage };

function fail(error: { message?: string; code?: string } | Error | null): WeddingResult<never> {
  return { ok: false, error: mapWeddingError(error) };
}

/**
 * Creates a wedding + owner membership + empty budget via SECURITY DEFINER RPC.
 * Do not insert into `weddings` / `wedding_members` from the client.
 */
export async function createWedding(input: CreateWeddingInput): Promise<WeddingResult<Wedding>> {
  const { data, error } = await supabase.rpc('create_wedding', {
    p_title: input.title.trim(),
    p_partner_one_name: input.partnerOneName?.trim() || null,
    p_partner_two_name: input.partnerTwoName?.trim() || null,
    p_wedding_date: input.weddingDate ?? undefined,
    p_city: input.city?.trim() || undefined,
    p_country_code: input.countryCode ?? 'ET',
    p_timezone: input.timezone ?? 'Africa/Addis_Ababa',
    p_style: input.style ?? undefined,
    p_currency_code: input.currencyCode ?? 'ETB',
    p_estimated_guest_count: input.estimatedGuestCount ?? undefined,
    p_celebration_kind: input.celebrationKind ?? 'wedding',
    p_total_budget: input.totalBudget ?? 0,
    p_budget_allocations: (input.budgetAllocations ?? []).map((allocation) => ({
      category_slug: allocation.categorySlug,
      amount: allocation.amount,
    })),
  });

  if (error) return fail(error);
  if (!data) return fail(new Error('No wedding returned'));
  return { ok: true, data };
}

/**
 * Weddings the current user may read (RLS: membership only).
 */
export async function listMyWeddings(): Promise<WeddingResult<WeddingMembership[]>> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return fail(userError);
  const userId = userData.user?.id;
  if (!userId) {
    return fail(new Error('authentication required'));
  }

  const { data, error } = await supabase
    .from('wedding_members')
    .select(
      `
      wedding_id,
      role,
      joined_at,
      wedding:weddings (*)
    `,
    )
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });

  if (error) return fail(error);

  const memberships: WeddingMembership[] = (data ?? [])
    .map((row) => {
      const wedding = row.wedding as Wedding | Wedding[] | null;
      const resolved = Array.isArray(wedding) ? wedding[0] : wedding;
      if (!resolved) return null;
      return {
        wedding_id: row.wedding_id,
        role: row.role,
        joined_at: row.joined_at,
        wedding: resolved,
      } satisfies WeddingMembership;
    })
    .filter((item): item is WeddingMembership => item !== null);

  return { ok: true, data: memberships };
}

export async function getWeddingById(weddingId: string): Promise<WeddingResult<Wedding>> {
  const { data, error } = await supabase
    .from('weddings')
    .select('*')
    .eq('id', weddingId)
    .maybeSingle();

  if (error) return fail(error);
  if (!data) {
    return {
      ok: false,
      error: {
        code: 'not_found',
        message: 'Wedding not found or you do not have access.',
      },
    };
  }
  return { ok: true, data };
}

export type UpdateWeddingInput = {
  style?: string | null;
  title?: string;
  city?: string | null;
  weddingDate?: string | null;
};

export async function updateWedding(
  weddingId: string,
  input: UpdateWeddingInput,
): Promise<WeddingResult<Wedding>> {
  const patch: Database['public']['Tables']['weddings']['Update'] = {};
  if (input.style !== undefined) patch.style = input.style;
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.city !== undefined) patch.city = input.city?.trim() || null;
  if (input.weddingDate !== undefined) patch.wedding_date = input.weddingDate;

  if (Object.keys(patch).length === 0) {
    return getWeddingById(weddingId);
  }

  const { data, error } = await supabase
    .from('weddings')
    .update(patch)
    .eq('id', weddingId)
    .select('*')
    .maybeSingle();

  if (error) return fail(error);
  if (!data) {
    return {
      ok: false,
      error: {
        code: 'not_found',
        message: 'Wedding not found or you do not have access.',
      },
    };
  }
  return { ok: true, data };
}
