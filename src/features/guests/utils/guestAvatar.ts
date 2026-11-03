import type { AppColors } from '@/theme/types';

export function guestInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [parts[0]?.[0] ?? '?'];
  return letters.join('').toUpperCase();
}

/** Stable soft color from guest id / name so list avatars feel varied. */
export function guestAvatarTone(seed: string, colors: AppColors): { bg: string; fg: string } {
  const AVATAR_PALETTE = [
    { bg: colors.successMuted, fg: colors.success },
    { bg: colors.primaryMuted, fg: colors.primaryPressed },
    { bg: colors.infoMuted, fg: colors.info },
    { bg: colors.dangerMuted, fg: colors.danger },
    { bg: '#F0E6F2', fg: '#7A4E85' },
    { bg: '#E8EDE6', fg: '#4A5C45' },
  ] as const;

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
