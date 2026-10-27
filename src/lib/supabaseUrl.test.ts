import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { hostUri: '10.249.56.80:8081' },
    experienceUrl: undefined,
    linkingUri: undefined,
  },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('resolveSupabaseUrl', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('rewrites localhost to the Expo LAN host on native', async () => {
    const { resolveSupabaseUrl } = await import('./supabaseUrl');
    expect(resolveSupabaseUrl('http://127.0.0.1:54321')).toBe('http://10.249.56.80:54321');
    expect(resolveSupabaseUrl('http://localhost:54321')).toBe('http://10.249.56.80:54321');
  });

  it('leaves non-loopback URLs unchanged', async () => {
    const { resolveSupabaseUrl } = await import('./supabaseUrl');
    expect(resolveSupabaseUrl('http://10.0.0.5:54321')).toBe('http://10.0.0.5:54321');
  });
});
