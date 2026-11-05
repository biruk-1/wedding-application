import { useRouter, useSegments, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { resolveAuthRedirect } from '@/features/auth/navigation/resolveAuthRedirect';
import {
  hydratePendingTeamInvite,
  peekPendingTeamInvite,
} from '@/features/team/services/pendingTeamInvite';

/**
 * Keeps Expo Router in sync with Supabase session without redirect loops.
 * After sign-in, a saved Planning Team invite resumes at `/join/<token>`.
 */
export function useAuthGate() {
  const { session, isLoading, isPasswordRecovery } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [pendingJoinToken, setPendingJoinToken] = useState<string | null>(peekPendingTeamInvite());

  useEffect(() => {
    let cancelled = false;
    void hydratePendingTeamInvite().then((token) => {
      if (!cancelled) setPendingJoinToken(token);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const target = resolveAuthRedirect({
      isLoading,
      hasSession: Boolean(session),
      isPasswordRecovery,
      rootSegment: segments[0],
      pendingJoinToken,
    });
    if (target) {
      router.replace(target as Href);
    }
  }, [session, isLoading, isPasswordRecovery, segments, router, pendingJoinToken]);
}
