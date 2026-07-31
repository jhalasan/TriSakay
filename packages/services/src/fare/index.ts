import { getSupabaseClient } from '../supabase/client.ts';

export interface EstimateFareInput {
  distanceKm: number;
  seats: number;
  /** Omit for an unauthenticated quote — the RPC treats a null passenger as ineligible for any discount. */
  passengerId?: string;
}

export interface EstimateFareResult {
  fare: number | null;
  error: string | null;
}

/** Calls the live `compute_fare` RPC — fares are quoted server-side (tariff, ordinance, discount eligibility), never computed on the client. */
export async function estimateFare({ distanceKm, seats, passengerId }: EstimateFareInput): Promise<EstimateFareResult> {
  const { data, error } = await getSupabaseClient().rpc('compute_fare', {
    p_distance_km: distanceKm,
    p_seats: seats,
    p_passenger_id: passengerId,
  });
  return { fare: error ? null : data, error: error?.message ?? null };
}

export interface FareDiscountRateResult {
  discountRatePercent: number | null;
  error: string | null;
}

/** Admin-configurable, per `fare_config.discount_rate_percent` — never hardcode the 20% figure client-side. */
export async function getFareDiscountRate(): Promise<FareDiscountRateResult> {
  const { data, error } = await getSupabaseClient()
    .from('fare_config')
    .select('discount_rate_percent')
    .eq('is_active', true)
    .maybeSingle();
  return { discountRatePercent: data?.discount_rate_percent ?? null, error: error?.message ?? null };
}
