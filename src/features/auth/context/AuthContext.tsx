import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Linking from 'expo-linking';

import {
  getSession,
  handleAuthCallbackUrl,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  updatePassword,
  type AuthResult,
} from '@/features/auth/services/authService';
import type { AuthUserMessage } from '@/features/auth/services/authErrors';
import { membershipsQuery } from '@/features/weddings/membershipsQuery';
import { syncCacheOwner } from '@/lib/query/cacheOwner';
import { queryClient } from '@/lib/query/queryClient';
import { supabase } from '@/lib/supabase';

const SESSION_RESTORE_TIMEOUT_MS = 4_000;

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: typeof signIn;
  signUp: typeof signUp;
  signOut: typeof signOut;
  requestPasswordReset: typeof requestPasswordReset;
  updatePassword: typeof updatePassword;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function restoreSessionWithTimeout(): Promise<Session | null> {
  try {
    return await Promise.race([
      getSession(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), SESSION_RESTORE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const cacheOwnerRef = useRef<string | null>(null);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const applySession = useCallback((next: Session | null) => {
    const nextUserId = next?.user?.id ?? null;
    cacheOwnerRef.current = syncCacheOwner(queryClient, cacheOwnerRef.current, nextUserId);
    setSession(next);
    if (nextUserId) {
      void queryClient.prefetchQuery(membershipsQuery(nextUserId));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const existing = await restoreSessionWithTimeout();
      if (mounted) {
        applySession(existing);
        setIsLoading(false);
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      applySession(nextSession);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
      }
      // Ensure we leave the restore skeleton even if getSession was slow.
      setIsLoading(false);
    });

    const handleUrl = (url: string) => {
      void handleAuthCallbackUrl(url).then((result: AuthResult<{ session: Session | null }>) => {
        if (!mounted) return;
        if (result.ok && result.data.session) {
          applySession(result.data.session);
          if (url.includes('type=recovery') || url.includes('reset-password')) {
            setIsPasswordRecovery(true);
          }
        }
      });
    };

    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
      linkingSub.remove();
    };
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isPasswordRecovery,
      clearPasswordRecovery,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [session, isLoading, isPasswordRecovery, clearPasswordRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };

export type { AuthUserMessage };
