import type { PassengerRow } from '../types/passenger';

export const MOCK_PASSENGERS: PassengerRow[] = [
  {
    id: 'pax-001',
    fullName: 'Maria Fe Santos',
    contactNo: '0917-102-8834',
    email: 'mariafe.santos@example.com',
    accountStatus: 'active',
    totalRides: 58,
    hasApprovedDiscount: true,
    createdAt: '2025-10-01T08:00:00+08:00',
  },
  {
    id: 'pax-002',
    fullName: 'Juan Dela Cruz',
    contactNo: '0918-441-9902',
    email: 'juan.delacruz@example.com',
    accountStatus: 'active',
    totalRides: 12,
    hasApprovedDiscount: false,
    createdAt: '2026-01-15T10:00:00+08:00',
  },
  {
    id: 'pax-003',
    fullName: 'Corazon Miralles',
    contactNo: '0919-223-6671',
    email: 'corazon.miralles@example.com',
    // Wireframe labels this "Blocked" in the Passenger Management UI; the
    // underlying account_status enum (docs/SCHEMA.MD) has no separate
    // 'blocked' value, so it maps onto 'suspended' — see lib/format.ts
    // accountStatusLabel() for the passenger-facing relabel.
    accountStatus: 'suspended',
    totalRides: 3,
    hasApprovedDiscount: false,
    createdAt: '2026-03-22T13:30:00+08:00',
  },
  {
    id: 'pax-004',
    fullName: 'Ryan Abenoja',
    contactNo: '0920-887-1145',
    email: 'ryan.abenoja@example.com',
    accountStatus: 'active',
    totalRides: 204,
    hasApprovedDiscount: false,
    createdAt: '2025-04-09T07:20:00+08:00',
  },
  {
    id: 'pax-005',
    fullName: 'Lorna Kintanar',
    contactNo: '0921-556-2290',
    email: 'lorna.kintanar@example.com',
    accountStatus: 'active',
    totalRides: 76,
    hasApprovedDiscount: true,
    createdAt: '2025-07-30T09:10:00+08:00',
  },
];
