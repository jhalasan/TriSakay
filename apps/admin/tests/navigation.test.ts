import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV_GROUPS, ROUTE_TITLES, visibleNavItems, matchNavItems } from '../src/lib/navigation.ts';

test('ROUTE_TITLES has an entry for every nav item, including /emergency-alerts', () => {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      assert.equal(ROUTE_TITLES[item.to], item.title);
    }
  }
  assert.equal(ROUTE_TITLES['/emergency-alerts'], 'Emergency Alerts');
});

test('visibleNavItems hides Administration items for pso_staff and pso_supervisor', () => {
  const staffItems = visibleNavItems('pso_staff').map((i) => i.to);
  const supervisorItems = visibleNavItems('pso_supervisor').map((i) => i.to);
  const adminItems = visibleNavItems('admin').map((i) => i.to);

  assert.ok(!staffItems.includes('/pso-users'));
  assert.ok(!staffItems.includes('/settings'));
  assert.ok(!supervisorItems.includes('/pso-users'));
  assert.ok(!supervisorItems.includes('/settings'));
  assert.ok(adminItems.includes('/pso-users'));
  assert.ok(adminItems.includes('/settings'));
});

test('visibleNavItems returns nothing for an undefined role', () => {
  assert.deepEqual(visibleNavItems(undefined), []);
});

test('matchNavItems ranks a startsWith match above a mid-string match', () => {
  const items = visibleNavItems('admin');
  const results = matchNavItems('re', items);
  assert.ok(results.length > 0);
  // "Reports & Analytics" (startsWith "re") should rank ahead of anything only containing "re" mid-string.
  assert.equal(results[0].to, '/reports');
});

test('matchNavItems is case-insensitive and matches by group caption too', () => {
  const items = visibleNavItems('admin');
  const byLabel = matchNavItems('DRIVERS', items);
  assert.ok(byLabel.some((i) => i.to === '/drivers'));

  const byCaption = matchNavItems('people', items);
  assert.ok(byCaption.some((i) => i.to === '/drivers'));
  assert.ok(byCaption.some((i) => i.to === '/passengers'));
});

test('matchNavItems returns nothing for an empty query', () => {
  assert.deepEqual(matchNavItems('', visibleNavItems('admin')), []);
});
