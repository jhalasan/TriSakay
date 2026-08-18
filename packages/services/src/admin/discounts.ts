import { getSupabaseClient } from '../supabase/client.ts';

export interface PendingDiscountRow {
  id: string;
  passengerId: string;
  passengerName: string | null;
  category: 'senior_citizen' | 'pwd' | 'student';
  status: 'unsubmitted' | 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  remarks: string | null;
  idPhotoFrontPath: string;
  idPhotoBackPath: string;
}

export interface ListPendingDiscountsResult {
  data: PendingDiscountRow[];
  error: string | null;
}

/** FR-3.10-3.15/UC48 — Senior/PWD/Student discount applications. Passenger name resolved via a follow-up users lookup, same convention as admin/dashboard.ts's resolveUserNames(). */
export async function listPendingDiscounts(): Promise<ListPendingDiscountsResult> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('passenger_discounts')
    .select('id, passenger_id, category, status, submitted_at, remarks, id_photo_front_path, id_photo_back_path')
    .order('submitted_at', { ascending: true });

  if (error) return { data: [], error: error.message };
  if (!data || data.length === 0) return { data: [], error: null };

  const ids = [...new Set(data.map((d) => d.passenger_id))];
  const { data: users } = await client.from('users').select('id, full_name').in('id', ids);
  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const rows = data.map((d) => ({
    id: d.id,
    passengerId: d.passenger_id,
    passengerName: nameById.get(d.passenger_id) ?? null,
    category: d.category,
    status: d.status,
    submittedAt: d.submitted_at,
    remarks: d.remarks,
    idPhotoFrontPath: d.id_photo_front_path,
    idPhotoBackPath: d.id_photo_back_path,
  }));

  return { data: rows, error: null };
}

export interface ReviewDiscountResult {
  error: string | null;
}

async function reviewDiscount(id: string, status: 'approved' | 'rejected', remarks: string | null): Promise<ReviewDiscountResult> {
  const client = getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  const reviewerId = sessionData.session?.user.id;
  if (!reviewerId) return { error: 'Not signed in' };

  const { error } = await client
    .from('passenger_discounts')
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), remarks })
    .eq('id', id);

  if (error) return { error: error.message };
  return { error: null };
}

/** S+ action (discounts_review_supervisor RLS policy). */
export async function approveDiscount(id: string, remarks?: string): Promise<ReviewDiscountResult> {
  return reviewDiscount(id, 'approved', remarks ?? null);
}

/** S+ action. */
export async function rejectDiscount(id: string, remarks: string): Promise<ReviewDiscountResult> {
  return reviewDiscount(id, 'rejected', remarks);
}
