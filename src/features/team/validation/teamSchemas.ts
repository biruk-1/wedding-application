import { z } from 'zod';

import { INVITE_ROLE_TEMPLATES } from '@/features/team/permissionLabels';

export const inviteExpiryOptions = ['7 days', '14 days', '30 days'] as const;

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email')
    .max(254, 'Email is too long'),
  inviteKind: z.enum(['collaborator', 'co_owner']),
  roleTemplate: z.enum(INVITE_ROLE_TEMPLATES),
  expiresIn: z.enum(inviteExpiryOptions),
  groupIds: z.array(z.string().uuid()).default([]),
});

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = issue.message;
  }
  return out;
}
