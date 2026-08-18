import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { performAccountAction } from '../src/admin/accounts.ts';

test('performAccountAction calls the perform_account_action RPC with the mapped args', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: unknown = null;

  __setSupabaseClientForTests({
    rpc: async (fn: string, args: unknown) => {
      capturedFn = fn;
      capturedArgs = args;
      return { error: null };
    },
  } as any);

  const { error } = await performAccountAction('driver-1', 'suspend', 'Repeated late cancellations', 'complaint-9');

  assert.equal(error, null);
  assert.equal(capturedFn, 'perform_account_action');
  assert.deepEqual(capturedArgs, {
    p_target_user_id: 'driver-1',
    p_action_type: 'suspend',
    p_reason: 'Repeated late cancellations',
    p_complaint_id: 'complaint-9',
  });
});

test('performAccountAction omits complaintId when not passed', async () => {
  let capturedArgs: any = null;

  __setSupabaseClientForTests({
    rpc: async (_fn: string, args: unknown) => {
      capturedArgs = args;
      return { error: null };
    },
  } as any);

  await performAccountAction('driver-1', 'flag', 'Multiple passenger complaints');

  assert.equal(capturedArgs.p_complaint_id, undefined);
});

test('performAccountAction maps an RPC error to a friendly message', async () => {
  __setSupabaseClientForTests({
    rpc: async () => ({ error: { message: 'permission denied' } }),
  } as any);

  const { error } = await performAccountAction('driver-1', 'suspend', 'reason');
  assert.equal(error, "Couldn't complete that action. Please try again.");
});
