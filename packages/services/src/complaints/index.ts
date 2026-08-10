import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type ComplaintDbStatus = Database['public']['Enums']['complaint_status'];

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

export interface SubmitComplaintInput {
  subject: string;
  message: string;
}

export interface SubmitComplaintResult {
  error: string | null;
}

/**
 * Files a complaint as the signed-in user (`submitted_by = auth.uid()`,
 * enforced by the `complaints_submit` RLS policy). No category picker exists
 * in the driver UI yet, so `category` is left for the column's own default
 * rather than guessing one — same gap already flagged on the passenger side
 * (docs/CHECKLIST.MD P2). No attachment upload either; `complaint_attachments`
 * has nothing to wire until the UI grows one.
 */
export async function submitComplaint({ subject, message }: SubmitComplaintInput): Promise<SubmitComplaintResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('complaints')
    .insert({ submitted_by: userId, subject, message });

  return { error: error?.message ?? null };
}

export interface MyComplaintRow {
  id: string;
  subject: string;
  status: ComplaintDbStatus;
}

export interface ListMyComplaintsResult {
  data: MyComplaintRow[];
  error: string | null;
}

/** The signed-in user's own submitted complaints, newest first. */
export async function listMyComplaints(): Promise<ListMyComplaintsResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: [], error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('complaints')
    .select('id, subject, status')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}
