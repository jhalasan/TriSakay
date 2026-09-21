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
  idNumber: string | null;
  dateOfBirth: string | null;
  issuingOffice: string | null;
  /** UAT A11 — null until approved; set to reviewed_at + 1 year by approveDiscount(). */
  expiresAt: string | null;
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
    .select('id, passenger_id, category, status, submitted_at, remarks, id_photo_front_path, id_photo_back_path, id_number, date_of_birth, issuing_office, expires_at')
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
    idNumber: d.id_number,
    dateOfBirth: d.date_of_birth,
    issuingOffice: d.issuing_office,
    expiresAt: d.expires_at,
  }));

  return { data: rows, error: null };
}

export interface UpdateDiscountFieldsInput {
  idNumber?: string;
  dateOfBirth?: string;
  issuingOffice?: string;
}

export interface UpdateDiscountFieldsResult {
  error: string | null;
}

/**
 * PSO Supervisor/Admin transcribing the ID's own fields while reviewing the
 * photo (the app never OCRs it) — not itself an S+ decision, but scoped by
 * the same discounts_review_supervisor RLS policy the approve/reject update
 * below uses, so PSO Staff calling this gets a clean RLS rejection.
 */
export async function updateDiscountFields(id: string, patch: UpdateDiscountFieldsInput): Promise<UpdateDiscountFieldsResult> {
  const client = getSupabaseClient();

  const dbPatch: { id_number?: string | null; date_of_birth?: string | null; issuing_office?: string | null } = {};
  if (patch.idNumber !== undefined) dbPatch.id_number = patch.idNumber || null;
  if (patch.dateOfBirth !== undefined) dbPatch.date_of_birth = patch.dateOfBirth || null;
  if (patch.issuingOffice !== undefined) dbPatch.issuing_office = patch.issuingOffice || null;

  if (Object.keys(dbPatch).length === 0) return { error: null };

  const { error } = await client.from('passenger_discounts').update(dbPatch).eq('id', id);
  return { error: error?.message ?? null };
}

export interface ReviewDiscountResult {
  error: string | null;
}

/** UAT A11 — decided policy default: 1 year from approval, then re-verification (a fresh application) is required. */
const DISCOUNT_VALIDITY_YEARS = 1;

async function reviewDiscount(id: string, status: 'approved' | 'rejected', remarks: string | null): Promise<ReviewDiscountResult> {
  const client = getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  const reviewerId = sessionData.session?.user.id;
  if (!reviewerId) return { error: 'Not signed in' };

  const reviewedAt = new Date();
  const expiresAt = status === 'approved' ? new Date(reviewedAt.getTime()) : null;
  if (expiresAt) expiresAt.setFullYear(expiresAt.getFullYear() + DISCOUNT_VALIDITY_YEARS);

  const { error } = await client
    .from('passenger_discounts')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: reviewedAt.toISOString(),
      remarks,
      // Rejecting clears any prior expiry too — this is also the path PSO
      // uses to reset an already-expired approved row (still 'approved' in
      // the DB, no scheduler exists to flip it) so a passenger blocked by
      // passenger_discounts_one_live_claim can submit a fresh application.
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    })
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
