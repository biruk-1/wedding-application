import * as Linking from 'expo-linking';
import type { AuthError, Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { mapAuthError, type AuthUserMessage } from '@/features/auth/services/authErrors';

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthUserMessage };

function fail(error: AuthError | Error | null | undefined): AuthResult<never> {
  return { ok: false, error: mapAuthError(error) };
}

/** Redirect target for password-reset emails (Expo scheme + path). */
export function passwordResetRedirectTo(): string {
  return Linking.createURL('reset-password');
}

/** Redirect after email confirmation links. */
export function emailConfirmRedirectTo(): string {
  return Linking.createURL('login');
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthResult<{ user: User | null; session: Session | null; needsEmailConfirmation: boolean }>> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        display_name: input.fullName.trim(),
      },
      emailRedirectTo: emailConfirmRedirectTo(),
    },
  });


  if (error) return fail(error);

  return {
    ok: true,
    data: {
      user: data.user,
      session: data.session,
      needsEmailConfirmation: Boolean(data.user) && !data.session,
    },
  };
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<AuthResult<{ session: Session }>> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) return fail(error);
  if (!data.session) {
    return fail(new Error('No session returned'));
  }

  return { ok: true, data: { session: data.session } };
}

export async function signOut(): Promise<AuthResult<{ signedOut: true }>> {
  const { error } = await supabase.auth.signOut();
  if (error) return fail(error);
  return { ok: true, data: { signedOut: true } };
}

/**
 * Always returns a generic success message so callers cannot probe account existence.
 */
export async function requestPasswordReset(email: string): Promise<AuthResult<{ sent: true }>> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: passwordResetRedirectTo(),
  });

  if (error) {
    // Still avoid account enumeration when the failure is a soft validation miss.
    const mapped = mapAuthError(error);
    if (mapped.code === 'network') return fail(error);
    // For most auth failures on reset, show the same confirmation copy.
    if (mapped.code === 'invalid_credentials' || mapped.code === 'user_already_exists') {
      return { ok: true, data: { sent: true } };
    }
    // Validation / rate-limit style issues can surface a safe message.
    if (mapped.code === 'validation_failed') return fail(error);
  }

  return { ok: true, data: { sent: true } };
}

export async function updatePassword(password: string): Promise<AuthResult<{ updated: true }>> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error);
  return { ok: true, data: { updated: true } };
}

export async function getSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session;
  } catch {
    return null;
  }
}


/**
 * Consumes recovery / magic-link deep links (PKCE `code` or implicit tokens).
 */
export async function handleAuthCallbackUrl(url: string): Promise<AuthResult<{ session: Session | null }>> {
  try {
    const parsed = Linking.parse(url);
    const query = parsed.queryParams ?? {};

    const code = typeof query.code === 'string' ? query.code : undefined;
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail(error);
      return { ok: true, data: { session: data.session } };
    }

    const hash = url.includes('#') ? url.split('#')[1] : '';
    if (hash) {
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) return fail(error);
        return { ok: true, data: { session: data.session } };
      }
    }

    return { ok: true, data: { session: null } };
  } catch (error) {
    return fail(error instanceof Error ? error : new Error('Invalid auth link'));
  }
}
