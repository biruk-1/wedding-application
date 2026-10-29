export type AuthRedirectInput = {
  isLoading: boolean;
  hasSession: boolean;
  isPasswordRecovery: boolean;
  /** First Expo Router segment, or undefined for `/`. */
  rootSegment?: string;
};

export type AuthRedirectTarget = '/' | '/(app)' | null;

const PUBLIC_ONLY = new Set([
  'index',
  'login',
  'register',
  'forgot-password',
]);

/**
 * Pure navigation policy for auth gating (unit-tested).
 * Returns a replace target, or null to stay.
 */
export function resolveAuthRedirect(input: AuthRedirectInput): AuthRedirectTarget {
  if (input.isLoading) return null;

  const root = input.rootSegment;
  const inApp = root === '(app)';
  const inTabs = root === '(tabs)';
  const onPublicOnly = !root || PUBLIC_ONLY.has(root);

  if (!input.hasSession && (inApp || inTabs)) {
    return '/';
  }

  if (input.hasSession && onPublicOnly && !input.isPasswordRecovery) {
    return '/(app)';
  }

  return null;
}
