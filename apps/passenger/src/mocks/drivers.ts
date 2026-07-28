import type { Driver } from '../types/driver';

export const mockDrivers: Driver[] = [
  { id: 'd1', name: 'Ramon Dela Cruz', plateNumber: 'ABC-1234', rating: 4.8, etaMinutes: 3 },
  { id: 'd2', name: 'Ernie Villanueva', plateNumber: 'XYZ-4521', rating: 4.6, etaMinutes: 5 },
  { id: 'd3', name: 'Boyet Santos', plateNumber: 'TRK-8890', rating: 4.9, etaMinutes: 2 },
  { id: 'd4', name: 'Nonoy Ramirez', plateNumber: 'PGN-3317', rating: 4.5, etaMinutes: 6 },
];

export function pickRandomDriver(): Driver {
  return mockDrivers[Math.floor(Math.random() * mockDrivers.length)];
}
