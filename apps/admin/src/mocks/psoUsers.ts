import type { PsoUserRow } from '../types/psoUser';

export const MOCK_PSO_USERS: PsoUserRow[] = [
  { id: 'pso-001', fullName: 'Engr. Wilhelmina Nazareno', email: 'w.nazareno@pso.gensantos.gov.ph', role: 'pso_supervisor', isActive: true, createdAt: '2024-11-01T08:00:00+08:00' },
  { id: 'pso-002', fullName: 'Michael Torreon', email: 'm.torreon@pso.gensantos.gov.ph', role: 'pso_staff', isActive: true, createdAt: '2025-02-14T08:00:00+08:00' },
  { id: 'pso-003', fullName: 'Jasmin Oclarit', email: 'j.oclarit@pso.gensantos.gov.ph', role: 'pso_staff', isActive: false, createdAt: '2025-05-20T08:00:00+08:00' },
  { id: 'pso-004', fullName: 'Rodel Fernandez', email: 'r.fernandez@pso.gensantos.gov.ph', role: 'admin', isActive: true, createdAt: '2024-09-01T08:00:00+08:00' },
];
