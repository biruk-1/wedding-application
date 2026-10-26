import { useRouter, useSegments, type Href } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { resolveAuthRedirect } from '@/features/auth/navigation/resolveAuthRedirect';

/**
 * Keeps Expo Router in sync with Supabase session without redirect loops.
 */
export function useAuthGate() {
  const { session, isLoading, isPasswordRecovery } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const target = resolveAuthRedirect({
      isLoading,
      hasSession: Boolean(session),
      isPasswordRecovery,
      rootSegment: segments[0],
    });
    if (target) {
      router.replace(target as Href);
    }
  }, [session, isLoading, isPasswordRecovery, segments, router]);
}

