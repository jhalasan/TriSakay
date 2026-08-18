import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type AdminVerificationStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';
export type AdminDocumentType = 'drivers_license' | 'or_cr' | 'franchise_permit' | 'tricycle_photo';
export type AdminTricycleCluster = 'red' | 'white' | 'apple_green' | 'melting_pot';

export interface VerificationDocumentRow {
  id: string;
  docType: AdminDocumentType;
  status: AdminVerificationStatus;
  storagePath: string;
}

export interface VerificationCaseRow {
  driverId: string;
  driverFullName: string;
  tricycleId: string | null;
  plateNo: string;
  mtopNo: string | null;
  mtopExpiryDate: string | null;
  cluster: AdminTricycleCluster | null;
  overallStatus: AdminVerificationStatus;
  notes: string | null;
  documents: VerificationDocumentRow[];
}

export interface ListPendingVerificationsResult {
  data: VerificationCaseRow[];
  error: string | null;
}

/**
 * FR-1.5 — driver + tricycle verification review. Excludes only
 * `unsubmitted` drivers (never submitted anything, nothing to review) —
 * `approved`/`rejected` cases stay in the list too, ordered oldest-updated
 * first so a still-`pending` case naturally surfaces above one PSO just
 * decided, letting a reviewer see the outcome of their own decision instead
 * of it vanishing the moment they act (the case-list Badge already renders
 * all three statuses for exactly this reason). Tricycle and document rows
 * are merged in via follow-up lookups (no multi-hop embed), same
 * convention as admin/drivers.ts's listDriversForAdmin(). `notes` has no
 * dedicated column anywhere — it's read back from any one of the driver's
 * documents' `remarks` (perform_verification_decision writes the same
 * remarks to all of them, so they're always in sync once a decision has
 * been made).
 */
export async function listPendingVerifications(): Promise<ListPendingVerificationsResult> {
  const client = getSupabaseClient();

  const { data: profiles, error: profilesError } = await client
    .from('driver_profiles')
    .select('user_id, verification_status')
    .neq('verification_status', 'unsubmitted')
    .order('updated_at', { ascending: true });

  if (profilesError) return { data: [], error: profilesError.message };
  if (!profiles || profiles.length === 0) return { data: [], error: null };

  const driverIds = profiles.map((p) => p.user_id);

  const [
    { data: users, error: usersError },
    { data: tricycles, error: tricyclesError },
    { data: documents, error: documentsError },
  ] = await Promise.all([
    client.from('users').select('id, full_name').in('id', driverIds),
    client
      .from('tricycles')
      .select('id, driver_id, plate_no, mtop_no, mtop_expiry_date, cluster')
      .in('driver_id', driverIds)
      .eq('is_active', true),
    client.from('driver_documents').select('id, driver_id, doc_type, status, storage_path, remarks').in('driver_id', driverIds),
  ]);

  if (usersError) return { data: [], error: usersError.message };
  if (tricyclesError) return { data: [], error: tricyclesError.message };
  if (documentsError) return { data: [], error: documentsError.message };

  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const tricycleByDriverId = new Map((tricycles ?? []).map((t) => [t.driver_id, t]));

  const documentsByDriverId = new Map<string, NonNullable<typeof documents>>();
  for (const doc of documents ?? []) {
    const list = documentsByDriverId.get(doc.driver_id) ?? [];
    list.push(doc);
    documentsByDriverId.set(doc.driver_id, list);
  }

  const rows: VerificationCaseRow[] = profiles.map((p) => {
    const tricycle = tricycleByDriverId.get(p.user_id) ?? null;
    const docs = documentsByDriverId.get(p.user_id) ?? [];
    const notes = docs.find((d) => d.remarks)?.remarks ?? null;

    return {
      driverId: p.user_id,
      driverFullName: nameById.get(p.user_id) ?? '—',
      tricycleId: tricycle?.id ?? null,
      plateNo: tricycle?.plate_no ?? '—',
      mtopNo: tricycle?.mtop_no ?? null,
      mtopExpiryDate: tricycle?.mtop_expiry_date ?? null,
      cluster: tricycle?.cluster ?? null,
      overallStatus: p.verification_status,
      notes,
      documents: docs.map((d) => ({
        id: d.id,
        docType: d.doc_type,
        status: d.status,
        storagePath: d.storage_path,
      })),
    };
  });

  return { data: rows, error: null };
}

export interface UpdateVerificationFieldsInput {
  mtopNo?: string;
  mtopExpiryDate?: string;
  cluster?: AdminTricycleCluster;
}

export interface UpdateVerificationFieldsResult {
  error: string | null;
}

/**
 * PSO Supervisor/Admin transcribing MTOP fields while reviewing the
 * uploaded Franchise/Permit (FR-1.4a) — the app never OCRs it. Not itself
 * an S+ decision, but `tricycles_owner_rw`'s RLS `with check` only allows a
 * non-owner write from `is_supervisor()`, so PSO Staff calling this gets a
 * clean RLS rejection rather than a silent no-op.
 */
export async function updateVerificationFields(
  driverId: string,
  patch: UpdateVerificationFieldsInput
): Promise<UpdateVerificationFieldsResult> {
  const client = getSupabaseClient();

  const dbPatch: Database['public']['Tables']['tricycles']['Update'] = {};
  if (patch.mtopNo !== undefined) dbPatch.mtop_no = patch.mtopNo || null;
  if (patch.mtopExpiryDate !== undefined) dbPatch.mtop_expiry_date = patch.mtopExpiryDate || null;
  if (patch.cluster !== undefined) dbPatch.cluster = patch.cluster || null;

  if (Object.keys(dbPatch).length === 0) return { error: null };

  const { error } = await client.from('tricycles').update(dbPatch).eq('driver_id', driverId).eq('is_active', true);
  return { error: error?.message ?? null };
}

export interface DecideVerificationResult {
  error: string | null;
}

async function decideVerification(
  driverId: string,
  decision: 'approved' | 'rejected',
  notes: string | null
): Promise<DecideVerificationResult> {
  const { error } = await getSupabaseClient().rpc('perform_verification_decision', {
    p_driver_id: driverId,
    p_decision: decision,
    p_notes: notes ?? undefined,
  });
  return { error: error?.message ?? null };
}

/** S+ action (FR-1.5, perform_verification_decision RPC — atomically updates driver_profiles, the active tricycle, and every document). */
export async function approveVerification(driverId: string, notes?: string): Promise<DecideVerificationResult> {
  return decideVerification(driverId, 'approved', notes ?? null);
}

/** S+ action. */
export async function rejectVerification(driverId: string, notes: string): Promise<DecideVerificationResult> {
  return decideVerification(driverId, 'rejected', notes);
}
