import { describe, expect, it } from 'vitest';

import { resolveAuthRedirect } from './resolveAuthRedirect';

describe('resolveAuthRedirect', () => {
  it('waits while loading', () => {
    expect(
      resolveAuthRedirect({
        isLoading: true,
        hasSession: false,
        isPasswordRecovery: false,
        rootSegment: '(app)',
      }),
    ).toBeNull();
  });

  it('sends unauthenticated users from protected routes to sign-in', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: false,
        isPasswordRecovery: false,
        rootSegment: '(app)',
      }),
    ).toBe('/login');
  });

  it('keeps signed-out visitors on the public welcome screen', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: false,
        isPasswordRecovery: false,
        rootSegment: 'index',
      }),
    ).toBeNull();
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: false,
        isPasswordRecovery: false,
        rootSegment: undefined,
      }),
    ).toBeNull();
  });

  it('never shows the welcome screen to signed-in users', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: true,
        isPasswordRecovery: false,
        rootSegment: undefined,
      }),
    ).toBe('/(app)');
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: true,
        isPasswordRecovery: false,
        rootSegment: 'index',
        pendingJoinToken: 'abc123',
      }),
    ).toBe('/join/abc123');
  });

  it('keeps public Explore open signed out and signed in', () => {
    for (const hasSession of [false, true]) {
      expect(
        resolveAuthRedirect({
          isLoading: false,
          hasSession,
          isPasswordRecovery: false,
          rootSegment: 'explore-vendors',
        }),
      ).toBeNull();
    }
  });

  it('still protects the legacy tabs group when signed out', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: false,
        isPasswordRecovery: false,
        rootSegment: '(tabs)',
      }),
    ).toBe('/login');
  });

  it('keeps reset-password public when signed out', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: false,
        isPasswordRecovery: false,
        rootSegment: 'reset-password',
      }),
    ).toBeNull();
  });

  it('sends authenticated users away from welcome/login', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: true,
        isPasswordRecovery: false,
        rootSegment: 'login',
      }),
    ).toBe('/(app)');
  });

  it('resumes a pending Planning Team invite after sign-in', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: true,
        isPasswordRecovery: false,
        rootSegment: 'login',
        pendingJoinToken: 'abc123',
      }),
    ).toBe('/join/abc123');
  });

  it('leaves join and invite screens alone when signed in', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: true,
        isPasswordRecovery: false,
        rootSegment: 'join',
        pendingJoinToken: 'abc123',
      }),
    ).toBeNull();
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: true,
        isPasswordRecovery: false,
        rootSegment: 'invite',
      }),
    ).toBeNull();
  });

  it('leaves temporary dev tools alone so they can navigate after sign-in', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: true,
        isPasswordRecovery: false,
        rootSegment: 'dev',
      }),
    ).toBeNull();
  });

  it('allows reset-password during recovery without bouncing to app home', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: true,
        isPasswordRecovery: true,
        rootSegment: 'reset-password',
      }),
    ).toBeNull();
  });

  it('leaves public auth routes alone when signed out', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: false,
        isPasswordRecovery: false,
        rootSegment: 'register',
      }),
    ).toBeNull();
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: false,
        isPasswordRecovery: false,
        rootSegment: 'login',
      }),
    ).toBeNull();
  });
});
