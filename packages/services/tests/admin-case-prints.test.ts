import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listCasePrints, recordCasePrint } from '../src/admin/casePrints.ts';

test('recordCasePrint sends the case and returns the document number and the server-made print details', async () => {
  const calls: unknown[] = [];
  __setSupabaseClientForTests({
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return {
        data: [{ doc_no: 'PSO-CMP-2026-000123', printed_at: '2026-10-05T01:00:00.000Z', printed_by_name: 'Rina Cabuslay', printed_by_role: 'pso_supervisor' }],
        error: null,
      };
    },
  } as any);

  const { data, error } = await recordCasePrint({ kind: 'complaint', caseId: 'c1' });

  assert.equal(error, null);
  assert.deepEqual(calls, [{ fn: 'record_case_print', args: { p_kind: 'complaint', p_case_id: 'c1', p_include_chat: false, p_reason: undefined } }]);
  assert.deepEqual(data, {
    docNo: 'PSO-CMP-2026-000123',
    printedAt: '2026-10-05T01:00:00.000Z',
    printedByName: 'Rina Cabuslay',
    printedByRole: 'pso_supervisor',
  });
});

test('recordCasePrint passes the chat flag and a trimmed reason', async () => {
  const calls: any[] = [];
  __setSupabaseClientForTests({
    rpc: async (fn: string, args: unknown) => {
      calls.push(args);
      return { data: [{ doc_no: 'PSO-SOS-2026-000007', printed_at: '2026-10-05T01:00:00.000Z', printed_by_name: 'A', printed_by_role: 'admin' }], error: null };
    },
  } as any);

  await recordCasePrint({ kind: 'sos_alert', caseId: 'a1', includeChat: true, reason: '  Police asked for the thread  ' });
  assert.deepEqual(calls[0], { p_kind: 'sos_alert', p_case_id: 'a1', p_include_chat: true, p_reason: 'Police asked for the thread' });
});

test('recordCasePrint refuses the chat thread without a reason, before calling the database', async () => {
  let called = false;
  __setSupabaseClientForTests({
    rpc: async () => {
      called = true;
      return { data: [], error: null };
    },
  } as any);

  for (const reason of [undefined, '', '   ']) {
    const { data, error } = await recordCasePrint({ kind: 'sos_alert', caseId: 'a1', includeChat: true, reason });
    assert.equal(data, null);
    assert.equal(error, 'A reason is required to include a chat thread.');
  }
  assert.equal(called, false);
});

test('recordCasePrint passes the database refusal through and gives no document number', async () => {
  __setSupabaseClientForTests({
    rpc: async () => ({ data: null, error: { message: 'Only a PSO Supervisor or Admin may print an emergency alert.' } }),
  } as any);

  const { data, error } = await recordCasePrint({ kind: 'sos_alert', caseId: 'a1' });
  assert.equal(data, null);
  assert.equal(error, 'Only a PSO Supervisor or Admin may print an emergency alert.');
});

test('recordCasePrint reports an empty answer as an error instead of guessing a document number', async () => {
  __setSupabaseClientForTests({ rpc: async () => ({ data: [], error: null }) } as any);

  const { data, error } = await recordCasePrint({ kind: 'complaint', caseId: 'c1' });
  assert.equal(data, null);
  assert.equal(error, 'Could not record this print. Please try again.');
});

function printRow(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `p${i}`,
    case_kind: 'complaint',
    case_id: `case-${i}`,
    doc_no: `PSO-CMP-2026-${String(i).padStart(6, '0')}`,
    printed_by: 'u1',
    printed_at: '2026-10-05T01:00:00.000Z',
    include_chat: false,
    reason: null,
    period: null,
    ...overrides,
  };
}

function fakePrintsClient(rows: unknown[], capture?: { since?: string; limit?: number }) {
  return {
    from: (table: string) => {
      if (table === 'case_print_log') {
        return {
          select: () => ({
            gte: (_col: string, since: string) => {
              if (capture) capture.since = since;
              return {
                order: () => ({
                  limit: async (n: number) => {
                    if (capture) capture.limit = n;
                    return { data: rows, error: null };
                  },
                }),
              };
            },
          }),
        };
      }
      if (table === 'users') return { select: () => ({ in: async () => ({ data: [{ id: 'u1', full_name: 'Rina Cabuslay' }], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any;
}

test('listCasePrints maps rows, resolves who printed, and asks for one extra row to detect truncation', async () => {
  const capture: { since?: string; limit?: number } = {};
  __setSupabaseClientForTests(fakePrintsClient([printRow(1, { include_chat: true, reason: 'Police request', case_kind: 'sos_alert' })], capture));

  const { data, error, truncated } = await listCasePrints('2026-10-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.equal(truncated, false);
  assert.equal(capture.since, '2026-10-01T00:00:00.000Z');
  assert.equal(capture.limit, 2001);
  assert.deepEqual(data[0], {
    id: 'p1',
    caseKind: 'sos_alert',
    caseId: 'case-1',
    period: null,
    docNo: 'PSO-CMP-2026-000001',
    printedByName: 'Rina Cabuslay',
    printedAt: '2026-10-05T01:00:00.000Z',
    includeChat: true,
    reason: 'Police request',
  });
});

test('listCasePrints returns 2000 rows and truncated when the database sends the extra row', async () => {
  __setSupabaseClientForTests(fakePrintsClient(Array.from({ length: 2001 }, (_, i) => printRow(i))));

  const { data, truncated } = await listCasePrints('2026-10-01T00:00:00.000Z');
  assert.equal(data.length, 2000);
  assert.equal(truncated, true);
});

test('listCasePrints returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ gte: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }) }),
  } as any);

  const { data, error, truncated } = await listCasePrints('2026-10-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
  assert.equal(truncated, false);
});

// ---- summary reports

import { recordReportPrint } from '../src/admin/casePrints.ts';

test('recordReportPrint sends the report type and the period and returns the document number', async () => {
  const calls: unknown[] = [];
  __setSupabaseClientForTests({
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return {
        data: [{ doc_no: 'PSO-RVN-2026-000001', printed_at: '2026-10-05T01:00:00.000Z', printed_by_name: 'Rina Cabuslay', printed_by_role: 'pso_supervisor' }],
        error: null,
      };
    },
  } as any);

  const { data, error } = await recordReportPrint({ kind: 'report_rides', period: '  Last 30 days  ' });

  assert.equal(error, null);
  assert.deepEqual(calls, [{ fn: 'record_report_print', args: { p_kind: 'report_rides', p_period: 'Last 30 days' } }]);
  assert.equal(data?.docNo, 'PSO-RVN-2026-000001');
});

test('recordReportPrint passes the database refusal through and gives no document number', async () => {
  __setSupabaseClientForTests({
    rpc: async () => ({ data: null, error: { message: 'Only a PSO Supervisor or Admin may print a summary report.' } }),
  } as any);

  const { data, error } = await recordReportPrint({ kind: 'report_drivers' });
  assert.equal(data, null);
  assert.equal(error, 'Only a PSO Supervisor or Admin may print a summary report.');
});

test('recordReportPrint reports an empty answer as an error', async () => {
  __setSupabaseClientForTests({ rpc: async () => ({ data: [], error: null }) } as any);

  const { data, error } = await recordReportPrint({ kind: 'report_franchise' });
  assert.equal(data, null);
  assert.equal(error, 'Could not record this print. Please try again.');
});

test('listCasePrints shows a summary report print with no case and its period', async () => {
  __setSupabaseClientForTests(
    fakePrintsClient([printRow(1, { case_kind: 'report_complaints', case_id: null, doc_no: 'PSO-CST-2026-000001', period: 'Last 7 days' })]),
  );

  const { data } = await listCasePrints('2026-10-01T00:00:00.000Z');
  assert.equal(data[0].caseKind, 'report_complaints');
  assert.equal(data[0].caseId, null);
  assert.equal(data[0].period, 'Last 7 days');
});
