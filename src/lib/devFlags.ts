/**
 * Temporary local-only helpers. All gates require `__DEV__` so production
 * release builds cannot enable them even if env is mis-set.
 */

export function isDevCollabLoginEnabled(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const looksLocal =
    /127\.0\.0\.1|localhost|:54321/i.test(url) ||
    process.env.EXPO_PUBLIC_ALLOW_DEV_COLLAB_LOGIN === '1';

  return looksLocal;
}

/** Fixed password used only by the temporary dev collaborator login screen. */
export const DEV_COLLAB_PASSWORD = 'KiburanDev1!';
