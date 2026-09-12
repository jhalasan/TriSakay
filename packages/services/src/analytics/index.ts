import { getSupabaseClient } from '../supabase/client.ts';

export interface DriverPeakHourBucket {
  hourLabel: string;
  count: number;
}

export interface GetDriverPeakHourHistogramResult {
  data: DriverPeakHourBucket[];
  error: string | null;
}

/** Uses local Asia/Manila wall-clock hours server-side (see the get_peak_hour_histogram SQL function) — the label formatting here must stay in sync with that bucketing, not recompute it client-side. */
function formatHour(hour24: number): string {
  const h = hour24 % 24;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

function bucketLabel(bucketIndex: number): string {
  const startHour = bucketIndex * 2;
  return `${formatHour(startHour)}–${formatHour(startHour + 2)}`;
}

/**
 * Driver-facing "peak hours" chart data (Earnings screen). Calls the
 * get_peak_hour_histogram RPC — a SECURITY DEFINER aggregate over ALL
 * drivers' completed ride_requests, safe for any authenticated driver to
 * call since it returns only 12 bucket counts, no rows. Distinct from
 * (and does not replace) the Admin app's own getPeakHourHistogram in
 * admin/reports.ts, which queries ride_requests directly under PSO's own
 * RLS — that one stays as-is.
 */
export async function getDriverPeakHourHistogram(sinceIso: string): Promise<GetDriverPeakHourHistogramResult> {
  const { data, error } = await getSupabaseClient().rpc('get_peak_hour_histogram', { p_since: sinceIso });
  if (error) return { data: [], error: error.message };

  const counts = new Array(12).fill(0);
  for (const row of data ?? []) {
    counts[row.bucket_index] = row.bucket_count;
  }

  return { data: counts.map((count, i) => ({ hourLabel: bucketLabel(i), count })), error: null };
}
