import type { ActiveTricycleRow, RecentActivityRow } from '../types/ride';

export const MOCK_ACTIVE_TRICYCLES: ActiveTricycleRow[] = [
  { driverId: 'drv-001', driverFullName: 'Ronnie Bautista', plateNo: 'GSC-4521', tripStatus: 'active', seatsTaken: 4, maxSeats: 6 },
  { driverId: 'drv-007', driverFullName: 'Edgardo Pantinople', plateNo: 'GSC-2214', tripStatus: 'forming', seatsTaken: 1, maxSeats: 6 },
  { driverId: 'drv-004', driverFullName: 'Danilo Ramos Jr.', plateNo: 'GSC-3390', tripStatus: 'active', seatsTaken: 6, maxSeats: 6 },
];

export const MOCK_RECENT_ACTIVITY: RecentActivityRow[] = [
  { id: 'act-001', driverFullName: 'Ronnie Bautista', status: 'active', time: '2 min ago' },
  { id: 'act-002', driverFullName: 'Danilo Ramos Jr.', status: 'completed', time: '11 min ago' },
  { id: 'act-003', driverFullName: 'Edgardo Pantinople', status: 'forming', time: '18 min ago' },
  { id: 'act-004', driverFullName: 'Ferdinand Amaro', status: 'cancelled', time: '46 min ago' },
];
