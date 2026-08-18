import {
  listPendingDiscounts as listPendingDiscountsShared,
  approveDiscount as approveDiscountShared,
  rejectDiscount as rejectDiscountShared,
} from '@trisakay/services';
import type { DiscountRow } from '../types/discount';
import type { ServiceResult } from './drivers';

export async function listPendingDiscounts(): Promise<ServiceResult<DiscountRow[]>> {
  const { data, error } = await listPendingDiscountsShared();
  if (error) return { data: [], error };

  const rows: DiscountRow[] = data.map((d) => ({
    id: d.id,
    passengerId: d.passengerId,
    passengerName: d.passengerName ?? 'Unknown passenger',
    category: d.category,
    status: d.status,
    submittedAt: d.submittedAt,
    remarks: d.remarks,
    idPhotoFrontPath: d.idPhotoFrontPath,
    idPhotoBackPath: d.idPhotoBackPath,
  }));

  return { data: rows, error: null };
}

/** S+ action. */
export async function approveDiscount(id: string, remarks?: string): Promise<ServiceResult<null>> {
  const { error } = await approveDiscountShared(id, remarks);
  return { data: null, error };
}

/** S+ action. */
export async function rejectDiscount(id: string, remarks: string): Promise<ServiceResult<null>> {
  const { error } = await rejectDiscountShared(id, remarks);
  return { data: null, error };
}
