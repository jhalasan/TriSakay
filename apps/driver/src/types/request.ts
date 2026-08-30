export type { PaymentMethod, PendingRequest } from '@trisakay/ui';
import type { PendingRequest } from '@trisakay/ui';

export interface AcceptedRequest extends PendingRequest {
  tripId: string;
}
