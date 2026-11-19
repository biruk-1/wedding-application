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

export type AuthRedirectTarget = '/login' | '/(app)' | `/join/${string}` | null;

/** Public auth forms — signed-out users may stay here. */
const PUBLIC_AUTH = new Set([
  'login',
  'register',
  'forgot-password',
]);

/**
 * Pure navigation policy for auth gating (unit-tested).
 * Returns a replace target, or null to stay.
 *
 * `join` and `invite` are intentionally not public-auth: signed-in users may stay on those
 * screens, and signed-out users are not kicked away from them.
 * `/` (index) is the public welcome screen for signed-out visitors only; signed-in users are
 * sent to the app. Public Explore (`explore-vendors`) is open to everyone.
 */
export function resolveAuthRedirect(input: AuthRedirectInput): AuthRedirectTarget {
  if (input.isLoading) return null;

  const root = input.rootSegment;
  const inApp = root === '(app)';
  const inTabs = root === '(tabs)';
  const onPublicAuth = Boolean(root && PUBLIC_AUTH.has(root));
  const onMarketingIndex = !root || root === 'index';
  const onDevTools = root === 'dev';
  const pending = input.pendingJoinToken?.trim() || null;

  if (!input.hasSession) {
    if (inApp || inTabs) {
      return '/login';
    }
    return null;
  }

  // Allow temporary local testing screens to finish their own navigation.
  if (onDevTools) return null;

  if (
    (onPublicAuth || onMarketingIndex) &&
    !input.isPasswordRecovery
  ) {
    if (pending) return `/join/${pending}`;
    return '/(app)';
  }

  return null;
}
