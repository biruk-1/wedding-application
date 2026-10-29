import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import type { WeddingUserMessage } from '@/features/weddings/services/weddingErrors';
import { listMyWeddings } from '@/features/weddings/services/weddingService';
import type { WeddingMembership } from '@/features/weddings/types';

export function useMyWeddings() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const [memberships, setMemberships] = useState<WeddingMembership[]>([]);
  const [fetchLoading, setFetchLoading] = useState(Boolean(userId));
  const [error, setError] = useState<WeddingUserMessage | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (authLoading || !userId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await listMyWeddings();
      if (cancelled) return;
      if (!result.ok) {
        setMemberships([]);
        setError(result.error);
      } else {
        setMemberships(result.data);
        setError(null);
      }
      setFetchLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, reloadToken]);

  if (!authLoading && !userId) {
    return {
      memberships: [] as WeddingMembership[],
      isLoading: false,
      error: null,
      refresh,
    };
  }

  return {
    memberships,
    isLoading: authLoading || fetchLoading,
    error,
    refresh,
  };
}
