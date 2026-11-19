import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { TeamInviteStatus } from '@/features/team/types';

const TONE: Record<TeamInviteStatus, BadgeTone> = {
  pending: 'info',
  accepted: 'success',
  expired: 'warning',
  revoked: 'danger',
};

const LABEL: Record<TeamInviteStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  expired: 'Expired',
  revoked: 'Revoked',
};

export function InviteStatusBadge({ status }: { status: TeamInviteStatus }) {
  return <Badge label={LABEL[status]} tone={TONE[status]} />;
}
