import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin, isPso, isSupervisor, meetsRoleGate } from '../src/lib/rbac.ts';
import type { AdminRole } from '../src/types/role.ts';

const ROLES: AdminRole[] = ['pso_staff', 'pso_supervisor', 'admin'];

test('isPso() is true for every admin-portal role', () => {
  for (const role of ROLES) {
    assert.equal(isPso(role), true, `expected isPso(${role}) to be true`);
  }
});

test('isSupervisor() denies pso_staff, grants pso_supervisor and admin', () => {
  assert.equal(isSupervisor('pso_staff'), false);
  assert.equal(isSupervisor('pso_supervisor'), true);
  assert.equal(isSupervisor('admin'), true);
});

test('isAdmin() only grants admin', () => {
  assert.equal(isAdmin('pso_staff'), false);
  assert.equal(isAdmin('pso_supervisor'), false);
  assert.equal(isAdmin('admin'), true);
});

test('meetsRoleGate("supervisor") gates the wireframe S+ actions (Verify/Suspend/Approve/Reject/Block/Unblock) correctly', () => {
  assert.equal(meetsRoleGate('pso_staff', 'supervisor'), false, 'PSO Staff must NOT see S+ actions');
  assert.equal(meetsRoleGate('pso_supervisor', 'supervisor'), true, 'PSO Supervisor must see S+ actions');
  assert.equal(meetsRoleGate('admin', 'supervisor'), true, 'Administrator must see S+ actions');
});

test('meetsRoleGate("admin") restricts PSO User Management / System Settings to Administrator only', () => {
  assert.equal(meetsRoleGate('pso_staff', 'admin'), false);
  assert.equal(meetsRoleGate('pso_supervisor', 'admin'), false);
  assert.equal(meetsRoleGate('admin', 'admin'), true);
});

test('meetsRoleGate("staff") — every signed-in admin-portal role can View/Flag', () => {
  for (const role of ROLES) {
    assert.equal(meetsRoleGate(role, 'staff'), true);
  }
});
