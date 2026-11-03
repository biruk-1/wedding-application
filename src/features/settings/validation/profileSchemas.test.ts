import { describe, expect, it } from 'vitest';

import {
  changePasswordSchema,
  profileFormSchema,
} from '@/features/settings/validation/profileSchemas';

describe('profileFormSchema', () => {
  it('requires a display name', () => {
    expect(profileFormSchema.safeParse({ displayName: '', phone: '' }).success).toBe(false);
    expect(profileFormSchema.safeParse({ displayName: 'Hana', phone: '' }).success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('requires matching passwords of sufficient length', () => {
    expect(
      changePasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        password: 'longenough',
        confirmPassword: 'different1',
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        password: 'longenough',
        confirmPassword: 'longenough',
      }).success,
    ).toBe(true);
  });
});
