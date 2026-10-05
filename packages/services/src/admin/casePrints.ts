import { getSupabaseClient } from '../supabase/client.ts';

export type CasePrintKind = 'complaint' | 'sos_alert';

export interface RecordCasePrintInput {
  kind: CasePrintKind;
  caseId: string;
  /** SOS reports only: also print the ride's chat thread. Needs a reason and is logged. */
  includeChat?: boolean;
  reason?: string;
}

export interface CasePrintReceipt {
  /** e.g. PSO-CMP-2026-000123 — made by the database, shown in the PDF footer. */
  docNo: string;
  printedAt: string;
  printedByName: string;
  printedByRole: string;
}

export interface RecordCasePrintResult {
  data: CasePrintReceipt | null;
  error: string | null;
}

/**
 * Records that a complaint or SOS alert is about to be printed, and returns the document number and the
 * printer's name and role. The database checks who may print what (record_case_print) and writes the audit
 * row, so the PDF footer comes from the server, not from the browser. Call this BEFORE building the PDF; if it
 * returns an error, nothing should be downloaded.
 */
export async function recordCasePrint({ kind, caseId, includeChat = false, reason }: RecordCasePrintInput): Promise<RecordCasePrintResult> {
  const trimmedReason = reason?.trim() || undefined;
  if (includeChat && !trimmedReason) return { data: null, error: 'A reason is required to include a chat thread.' };

  const { data, error } = await getSupabaseClient().rpc('record_case_print', {
    p_kind: kind,
    p_case_id: caseId,
    p_include_chat: includeChat,
    p_reason: trimmedReason,
  });

  if (error) return { data: null, error: error.message };

  const row = data?.[0];
  if (!row) return { data: null, error: 'Could not record this print. Please try again.' };

  return {
    data: { docNo: row.doc_no, printedAt: row.printed_at, printedByName: row.printed_by_name, printedByRole: row.printed_by_role },
    error: null,
  };
}

export interface CasePrintRow {
  id: string;
  caseKind: CasePrintKind;
  caseId: string;
  docNo: string;
  printedByName: string | null;
  printedAt: string;
  includeChat: boolean;
  reason: string | null;
}

export interface ListCasePrintsResult {
  data: CasePrintRow[];
  error: string | null;
  /** True when the 2,000 row cap was hit, so older prints in the range were not returned. */
  truncated: boolean;
}

const CASE_PRINTS_ROW_CAP = 2000;

/** The Audit Log "Case prints" tab: who printed which case and when, newest first (Supervisor and Admin only, enforced by RLS). */
export async function listCasePrints(sinceIso: string): Promise<ListCasePrintsResult> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('case_print_log')
    .select('id, case_kind, case_id, doc_no, printed_by, printed_at, include_chat, reason')
    .gte('printed_at', sinceIso)
    .order('printed_at', { ascending: false })
    .limit(CASE_PRINTS_ROW_CAP + 1);

  if (error) return { data: [], error: error.message, truncated: false };

  const all = data ?? [];
  const truncated = all.length > CASE_PRINTS_ROW_CAP;
  const shown = all.slice(0, CASE_PRINTS_ROW_CAP);

  const userIds = [...new Set(shown.map((row) => row.printed_by))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await client.from('users').select('id, full_name').in('id', userIds);
    for (const user of users ?? []) names.set(user.id, user.full_name!);
  }

  const rows: CasePrintRow[] = shown.map((row) => ({
    id: row.id,
    caseKind: row.case_kind as CasePrintKind,
    caseId: row.case_id,
    docNo: row.doc_no,
    printedByName: names.get(row.printed_by) ?? null,
    printedAt: row.printed_at,
    includeChat: row.include_chat,
    reason: row.reason,
  }));

  return { data: rows, error: null, truncated };
}
