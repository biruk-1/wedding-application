import type { ImageSourcePropType } from 'react-native';

import type { CelebrationKind } from '@/features/weddings/types';

export type CelebrationConfig = {
  kind: CelebrationKind;
  label: string;
  shortDescription: string;
  titleLabel: string;
  titlePlaceholder: string;
  dateLabel: string;
  locationLabel: string;
  image: ImageSourcePropType;
};

const STYLE_IMAGES = {
  modern: require('../../../assets/themes/modern/wedding-images/preview.jpg'),
  traditional: require('../../../assets/themes/traditional/wedding-images/preview.jpg'),
  blend: require('../../../assets/themes/fusion/wedding-images/preview.jpg'),
} satisfies Record<string, ImageSourcePropType>;

const EVENT_IMAGES = {
  babyShower: require('../../../assets/images/events/baby-shower.jpg'),
  birthday: require('../../../assets/images/events/birthday.jpg'),
  anniversary: require('../../../assets/images/events/anniversary.jpg'),
  graduation: require('../../../assets/images/events/graduation.jpg'),
  other: require('../../../assets/images/events/other.jpg'),
} satisfies Record<string, ImageSourcePropType>;

export const CELEBRATIONS: readonly CelebrationConfig[] = [
  {
    kind: 'wedding',
    label: 'Wedding',
    shortDescription: 'Plan your wedding day together.',
    titleLabel: 'Wedding title',
    titlePlaceholder: 'Hana & Daniel',
    dateLabel: 'Wedding date',
    locationLabel: 'Wedding location',
    image: STYLE_IMAGES.traditional,
  },
  {
    kind: 'shemgelena',
    label: 'Shemgelena',
    shortDescription: 'Bring families together for the formal proposal.',
    titleLabel: 'Shemgelena title',
    titlePlaceholder: 'Our Shemgelena',
    dateLabel: 'Shemgelena date',
    locationLabel: 'Shemgelena location',
    image: STYLE_IMAGES.traditional,
  },
  {
    kind: 'qelekel',
    label: 'Qelekel',
    shortDescription: 'Organize the celebration after the wedding.',
    titleLabel: 'Qelekel title',
    titlePlaceholder: 'Our Qelekel',
    dateLabel: 'Qelekel date',
    locationLabel: 'Qelekel location',
    image: STYLE_IMAGES.blend,
  },
  {
    kind: 'baby_shower',
    label: 'Baby shower',
    shortDescription: 'Celebrate a new arrival with family and friends.',
    titleLabel: 'Baby shower title',
    titlePlaceholder: 'Our Baby Shower',
    dateLabel: 'Baby shower date',
    locationLabel: 'Baby shower location',
    image: EVENT_IMAGES.babyShower,
  },
  {
    kind: 'birthday',
    label: 'Birthday',
    shortDescription: 'Plan a memorable birthday celebration.',
    titleLabel: 'Birthday title',
    titlePlaceholder: 'Birthday Celebration',
    dateLabel: 'Birthday date',
    locationLabel: 'Birthday location',
    image: EVENT_IMAGES.birthday,
  },
  {
    kind: 'anniversary',
    label: 'Anniversary',
    shortDescription: 'Mark a meaningful milestone together.',
    titleLabel: 'Anniversary title',
    titlePlaceholder: 'Our Anniversary',
    dateLabel: 'Anniversary date',
    locationLabel: 'Anniversary location',
    image: EVENT_IMAGES.anniversary,
  },
  {
    kind: 'graduation',
    label: 'Graduation',
    shortDescription: 'Celebrate an academic achievement.',
    titleLabel: 'Graduation title',
    titlePlaceholder: 'Graduation Celebration',
    dateLabel: 'Graduation date',
    locationLabel: 'Graduation location',
    image: EVENT_IMAGES.graduation,
  },
  {
    kind: 'other',
    label: 'Other',
    shortDescription: 'Create a celebration that is uniquely yours.',
    titleLabel: 'What are you celebrating?',
    titlePlaceholder: 'Describe your event',
    dateLabel: 'Event date',
    locationLabel: 'Event location',
    image: EVENT_IMAGES.other,
  },
] as const;

export const CELEBRATION_BY_KIND = Object.fromEntries(
  CELEBRATIONS.map((celebration) => [celebration.kind, celebration]),
) as Record<CelebrationKind, CelebrationConfig>;

export function getDefaultCelebrationTitle(
  kind: CelebrationKind,
  partnerOneName = '',
  partnerTwoName = '',
): string {
  if (kind === 'wedding') {
    const first = partnerOneName.trim();
    const second = partnerTwoName.trim();
    if (first && second) return `${first} & ${second}`;
    return first || second || 'Our Wedding';
  }

  if (kind === 'other') return '';
  return CELEBRATION_BY_KIND[kind].titlePlaceholder;
}
