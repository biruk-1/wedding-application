import type { CelebrationKind } from '@/features/weddings/types';

export type CelebrationCapabilities = {
  budget: boolean;
  vendors: boolean;
  tasks: boolean;
  timeline: boolean;
  guests: boolean;
  invitations: boolean;
  documents: boolean;
};

export type CelebrationCopy = {
  kind: CelebrationKind;
  label: string;
  eventNoun: string;
  progressLabel: string;
  countdownAccessibilityLabel: string;
  pastDateLabel: string;
  unavailableLabel: string;
  editAccessibilityLabel: string;
  editDialogTitle: string;
  editDialogBody: string;
  successTitle: string;
  successBody: string;
  capabilities: CelebrationCapabilities;
};

const AVAILABLE_MODULES: CelebrationCapabilities = {
  budget: true,
  vendors: true,
  tasks: true,
  timeline: true,
  guests: true,
  invitations: true,
  documents: true,
};

function eventCopy(
  kind: Exclude<CelebrationKind, 'wedding'>,
  label: string,
  eventNoun = label.toLowerCase(),
): CelebrationCopy {
  return {
    kind,
    label,
    eventNoun,
    progressLabel: 'Planning progress',
    countdownAccessibilityLabel: `${label} countdown`,
    pastDateLabel: `Since the ${eventNoun}`,
    unavailableLabel: `${label} unavailable.`,
    editAccessibilityLabel: `Change ${eventNoun} cover photo`,
    editDialogTitle: `Cover photo`,
    editDialogBody: `Choose a new photo for your ${eventNoun} home banner.`,
    successTitle: `${label} created`,
    successBody: `Your ${eventNoun} space is ready. You are the owner and can invite collaborators later.`,
    capabilities: AVAILABLE_MODULES,
  };
}

export const CELEBRATION_COPY: Record<CelebrationKind, CelebrationCopy> = {
  wedding: {
    kind: 'wedding',
    label: 'Wedding',
    eventNoun: 'wedding',
    progressLabel: 'Wedding progress',
    countdownAccessibilityLabel: 'Wedding countdown',
    pastDateLabel: 'Since your wedding day',
    unavailableLabel: 'Wedding unavailable.',
    editAccessibilityLabel: 'Change wedding cover photo',
    editDialogTitle: 'Cover photo',
    editDialogBody: 'Choose a new photo for your wedding home banner.',
    successTitle: 'Wedding created',
    successBody:
      'Your wedding space is ready. You are the owner and can invite partners later.',
    capabilities: AVAILABLE_MODULES,
  },
  shemgelena: eventCopy('shemgelena', 'Shemgelena'),
  qelekel: eventCopy('qelekel', 'Qelekel'),
  baby_shower: eventCopy('baby_shower', 'Baby shower'),
  birthday: eventCopy('birthday', 'Birthday'),
  anniversary: eventCopy('anniversary', 'Anniversary'),
  graduation: eventCopy('graduation', 'Graduation'),
  other: eventCopy('other', 'Event', 'event'),
};

export function normalizeCelebrationKind(
  kind: string | null | undefined,
): CelebrationKind {
  return kind && kind in CELEBRATION_COPY ? (kind as CelebrationKind) : 'wedding';
}

export function getCelebrationCopy(
  kind: string | null | undefined,
): CelebrationCopy {
  return CELEBRATION_COPY[normalizeCelebrationKind(kind)];
}
