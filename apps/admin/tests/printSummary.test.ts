import test from 'node:test';
import assert from 'node:assert/strict';
import { printSummaryReport, type PrintSummaryDeps } from '../src/lib/reports/printSummary.ts';
import type { ReportMeta, ReportModel } from '../src/lib/reports/types.ts';

const RECEIPT = { docNo: 'PSO-RVN-2026-000001', printedAt: '2026-10-05T07:15:00.000Z', printedByName: 'Rina Cabuslay', printedByRole: 'pso_supervisor' };
const MODEL = { kind: 'report_rides', title: 'Rides and Revenue Summary', reference: 'x', status: 'Summary report', open: false, sections: [] } as ReportModel;

function fakeDeps(overrides: Partial<PrintSummaryDeps> = {}) {
  const calls: string[] = [];
  const downloads: { model: ReportModel; meta: ReportMeta; filename: string }[] = [];
  const deps: PrintSummaryDeps = {
    recordReport: async (input) => {
      calls.push(`record:${input.kind}:${input.period}`);
      return { data: RECEIPT, error: null };
    },
    download: async (model, meta, filename) => {
      calls.push('download');
      downloads.push({ model, meta, filename });
    },
    ...overrides,
  };
  return { deps, calls, downloads };
}

test('a summary report is recorded first, then built and downloaded under its document number', async () => {
  const { deps, calls, downloads } = fakeDeps();
  let built = 0;

  const result = await printSummaryReport({ kind: 'report_rides', period: 'Last 30 days', build: () => (built++, MODEL) }, deps);

  assert.deepEqual(result, { error: null, docNo: 'PSO-RVN-2026-000001' });
  assert.deepEqual(calls, ['record:report_rides:Last 30 days', 'download']);
  assert.equal(built, 1);
  assert.equal(downloads[0].filename, 'PSO-RVN-2026-000001.pdf');
  assert.equal(downloads[0].meta.printedByRole, 'PSO Supervisor');
  assert.equal(downloads[0].meta.printedByName, 'Rina Cabuslay');
});

test('when the print is refused the report is never built and nothing is downloaded', async () => {
  const { deps, calls } = fakeDeps({ recordReport: async () => ({ data: null, error: 'Only a PSO Supervisor or Admin may print a summary report.' }) });
  let built = 0;

  const result = await printSummaryReport({ kind: 'report_drivers', period: 'As of today', build: () => (built++, MODEL) }, deps);

  assert.deepEqual(result, { error: 'Only a PSO Supervisor or Admin may print a summary report.' });
  assert.equal(built, 0);
  assert.deepEqual(calls, []);
});
