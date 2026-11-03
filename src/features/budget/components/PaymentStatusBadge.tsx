import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { PaymentStatus } from '@/features/budget/types';

const TONE: Record<PaymentStatus, BadgeTone> = {
  unpaid: 'neutral',
  partial: 'warning',
  paid: 'success',
};

const LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge label={LABEL[status]} tone={TONE[status]} />;
}
