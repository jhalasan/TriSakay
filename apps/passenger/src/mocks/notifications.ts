import type { NotificationItem } from '../types/notification';

export const seedNotifications: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Ride completed',
    body: 'Your trip with Ramon Dela Cruz has ended. Rate your driver.',
    read: false,
    createdAt: '2026-07-26T08:20:00.000Z',
  },
  {
    id: 'n2',
    title: 'Fare receipt',
    body: '₱45.00 paid via cash for your last ride.',
    read: false,
    createdAt: '2026-07-26T08:19:00.000Z',
  },
  {
    id: 'n3',
    title: 'Welcome to TriSakay',
    body: 'Book your first tricycle ride in just a few taps.',
    read: true,
    createdAt: '2026-07-20T10:00:00.000Z',
  },
  {
    id: 'n4',
    title: 'Complaint update',
    body: 'Your complaint about fare discrepancy is now in review.',
    read: true,
    createdAt: '2026-07-18T15:42:00.000Z',
  },
  {
    id: 'n5',
    title: 'Rate your last driver',
    body: 'You haven’t rated Boyet Santos yet. Share your feedback.',
    read: true,
    createdAt: '2026-07-15T09:55:00.000Z',
  },
];
