import type { NotificationRow } from '@trisakay/services';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  type: NotificationRow['type'];
}
