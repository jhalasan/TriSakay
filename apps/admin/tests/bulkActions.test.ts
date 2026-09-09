import test from 'node:test';
import assert from 'node:assert/strict';
import { runBulkAction } from '../src/lib/bulkActions.ts';

test('runBulkAction reports every id succeeded when the action never errors', async () => {
  const calls: [string, string][] = [];
  const action = async (id: string, reason: string) => {
    calls.push([id, reason]);
    return { error: null };
  };

  const summary = await runBulkAction(['a', 'b', 'c'], action, 'Fleet-wide audit');

  assert.deepEqual(summary, { succeeded: 3, failed: 0 });
  assert.deepEqual(calls, [
    ['a', 'Fleet-wide audit'],
    ['b', 'Fleet-wide audit'],
    ['c', 'Fleet-wide audit'],
  ]);
});

test('runBulkAction counts a per-row { error } result as a failure without stopping the rest', async () => {
  const action = async (id: string) => (id === 'b' ? { error: 'Target user not found.' } : { error: null });

  const summary = await runBulkAction(['a', 'b', 'c'], action, 'reason');

  assert.deepEqual(summary, { succeeded: 2, failed: 1 });
});

test('runBulkAction counts a rejected promise as a failure too, not just an { error } result', async () => {
  const action = async (id: string) => {
    if (id === 'b') throw new Error('network error');
    return { error: null };
  };

  const summary = await runBulkAction(['a', 'b', 'c'], action, 'reason');

  assert.deepEqual(summary, { succeeded: 2, failed: 1 });
});

test('runBulkAction resolves to { succeeded: 0, failed: 0 } for an empty id list without calling the action', async () => {
  let called = false;
  const action = async () => {
    called = true;
    return { error: null };
  };

  const summary = await runBulkAction([], action, 'reason');

  assert.deepEqual(summary, { succeeded: 0, failed: 0 });
  assert.equal(called, false);
});
