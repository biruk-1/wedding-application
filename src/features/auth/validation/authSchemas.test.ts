import { describe, expect, it } from 'vitest';

import {
  fieldErrorsFromZod,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './authSchemas';

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({
      email: 'hana@example.com',
      password: 'secret1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'nope', password: 'secret1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZod(result.error).email).toMatch(/valid email/i);
    }
  });

  it('requires password', () => {
    const result = loginSchema.safeParse({ email: 'hana@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('requires matching passwords', () => {
    const result = registerSchema.safeParse({
      fullName: 'Hana Desta',
      email: 'hana@example.com',
      password: 'secret1',
      confirmPassword: 'other',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZod(result.error).confirmPassword).toMatch(/match/i);
    }
  });

  it('rejects short passwords', () => {
    const result = registerSchema.safeParse({
      fullName: 'Hana',
      email: 'hana@example.com',
      password: '123',
      confirmPassword: '123',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a complete registration payload', () => {
    const result = registerSchema.safeParse({
      fullName: 'Hana Desta',
      email: 'hana@example.com',
      password: 'secret1',
      confirmPassword: 'secret1',
    });
    expect(result.success).toBe(true);
  });
});

describe('forgotPasswordSchema', () => {
  it('requires email', () => {
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('requires confirmation match', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'secret1',
      confirmPassword: 'secret2',
    });
    expect(result.success).toBe(false);
  });
});
