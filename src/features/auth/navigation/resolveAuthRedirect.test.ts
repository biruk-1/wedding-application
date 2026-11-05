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

  it('sends unauthenticated users away from protected routes', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: false,
        isPasswordRecovery: false,
        rootSegment: '(app)',
      }),
    ).toBe('/');
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

  it('leaves public routes alone when signed out', () => {
    expect(
      resolveAuthRedirect({
        isLoading: false,
        hasSession: false,
        isPasswordRecovery: false,
        rootSegment: 'register',
      }),
    ).toBeNull();
  });
});
