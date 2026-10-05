import type { CasePrintReceipt, ReportPrintKind } from '@trisakay/services';
import { recordReportPrint } from '../../services/caseReports.ts';
import type { AdminRole } from '../../types/role.ts';
import { ROLE_LABELS } from '../rbac.ts';
import type { PrintResult } from './printCase.ts';
import { downloadReportPdf } from './renderPdf.ts';
import type { ReportMeta, ReportModel } from './types.ts';

export interface PrintSummaryDeps {
  recordReport: (input: { kind: ReportPrintKind; period?: string }) => Promise<{ data: CasePrintReceipt | null; error: string | null }>;
  download: (model: ReportModel, meta: ReportMeta, filename: string) => Promise<void>;
}

const defaultDeps: PrintSummaryDeps = {
  recordReport: recordReportPrint,
  download: downloadReportPdf,
};

export interface PrintSummaryArgs {
  kind: ReportPrintKind;
  /** What the report covers, kept in the audit trail. */
  period: string;
  /** Builds the report from the data already on the screen. Only called once the print has been recorded. */
  build: () => ReportModel;
}

/**
 * Prints a summary report (rides and revenue, franchise status, complaints statistics, driver roster). Same order
 * as the case reports: the print is recorded first (Supervisor and Admin only, decided by the database), and if
 * that is refused nothing is built or downloaded.
 */
export async function printSummaryReport(args: PrintSummaryArgs, deps: PrintSummaryDeps = defaultDeps): Promise<PrintResult> {
  const recorded = await deps.recordReport({ kind: args.kind, period: args.period });
  if (recorded.error || !recorded.data) return { error: recorded.error ?? 'Could not record this print.' };

  const receipt = recorded.data;
  const meta: ReportMeta = {
    docNo: receipt.docNo,
    printedAt: receipt.printedAt,
    printedByName: receipt.printedByName,
    printedByRole: ROLE_LABELS[receipt.printedByRole as AdminRole] ?? receipt.printedByRole,
  };
  await deps.download(args.build(), meta, `${receipt.docNo}.pdf`);
  return { error: null, docNo: receipt.docNo };
}
