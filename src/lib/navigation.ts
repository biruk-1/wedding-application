import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

/**
 * Pops back to the screen underneath (kept mounted by the stack, so it reappears instantly with
 * its state); replaces with `fallback` only when opened via deep link with nothing to pop.
 */
export function useBackTo(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as Href);
  }, [router, fallback]);
}
