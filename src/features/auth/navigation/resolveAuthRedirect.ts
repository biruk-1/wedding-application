export type AuthRedirectInput = {
  isLoading: boolean;
  hasSession: boolean;
  isPasswordRecovery: boolean;
  /** First Expo Router segment, or undefined for `/`. */
  rootSegment?: string;
  /**
   * Raw Planning Team invite token saved before sign-in/register.
   * When set, signed-in users leaving public auth screens go to `/join/<token>` instead of home.
   */
  pendingJoinToken?: string | null;
};

export type AuthRedirectTarget = '/' | '/(app)' | `/join/${string}` | null;

const PUBLIC_ONLY = new Set([
  'index',
  'login',
  'register',
  'forgot-password',
]);

/**
 * Pure navigation policy for auth gating (unit-tested).
 * Returns a replace target, or null to stay.
 *
 * `join` and `invite` are intentionally not public-only: signed-in users may stay on those
 * screens, and signed-out users are not kicked away from them.
 */
export function resolveAuthRedirect(input: AuthRedirectInput): AuthRedirectTarget {
  if (input.isLoading) return null;

  const root = input.rootSegment;
  const inApp = root === '(app)';
  const inTabs = root === '(tabs)';
  const onPublicOnly = !root || PUBLIC_ONLY.has(root);
  const pending = input.pendingJoinToken?.trim() || null;

  if (!input.hasSession && (inApp || inTabs)) {
    return '/';
  }

  if (input.hasSession && onPublicOnly && !input.isPasswordRecovery) {
    if (pending) return `/join/${pending}`;
    return '/(app)';
  }

  return null;
}
