import type { Ionicons } from '@expo/vector-icons';

import type { AppColors } from '@/theme/types';

type IconName = keyof typeof Ionicons.glyphMap;

const ICON_BY_KEY: Record<string, IconName> = {
  venue: 'home-outline',
  attire: 'shirt-outline',
  photography: 'camera-outline',
  camera: 'camera-outline',
  catering: 'restaurant-outline',
  food: 'restaurant-outline',
  music: 'musical-notes-outline',
  flowers: 'flower-outline',
  flower: 'flower-outline',
  invitations: 'mail-outline',
  mail: 'mail-outline',
  guests: 'people-outline',
  people: 'people-outline',
  budget: 'wallet-outline',
  legal: 'document-text-outline',
  document: 'document-text-outline',
  car: 'car-outline',
  decor: 'flower-outline',
};

export function categoryIcon(slugOrIcon: string | null | undefined): IconName {
  if (!slugOrIcon) return 'checkbox-outline';
  return ICON_BY_KEY[slugOrIcon.toLowerCase()] ?? 'checkbox-outline';
}

export function categoryTone(index: number, colors: AppColors): { bg: string; fg: string } {
  const TONES = [
    { bg: colors.successMuted, fg: colors.success },
    { bg: colors.primaryMuted, fg: colors.primary },
    { bg: colors.infoMuted, fg: colors.info },
    { bg: colors.dangerMuted, fg: colors.danger },
  ] as const;
  return TONES[index % TONES.length];
}
