import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

// Extra facts a printed case report needs that the complaint and alert lists do not carry.

export interface CaseRide {
  id: string;
  status: Database['public']['Enums']['ride_status'];
  requestedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  pickupLabel: string | null;
  destLabel: string | null;
  /** The final fare when the ride finished, otherwise the quoted one. */
  fare: number | null;
  passengerName: string | null;
  driverName: string | null;
  plateNo: string | null;
}

export interface GetCaseRideResult {
  data: CaseRide | null;
  error: string | null;
}

/**
 * The ride behind a complaint or an SOS alert: route, fare, passenger, driver and plate number. Flat lookups
 * and one name query, same convention as the other admin modules. A ride that cannot be found is not an error
 * (the report prints "No linked ride"); a failed query is.
 */
export async function getCaseRide(rideRequestId: string): Promise<GetCaseRideResult> {
  const client = getSupabaseClient();

  const { data: ride, error: rideError } = await client
    .from('ride_requests')
    .select('id, passenger_id, trip_id, status, pickup_label, dest_label, requested_at, completed_at, cancelled_at, final_fare, estimated_fare')
    .eq('id', rideRequestId)
    .maybeSingle();

  if (rideError) return { data: null, error: rideError.message };
  if (!ride) return { data: null, error: null };

  let driverId: string | null = null;
  let plateNo: string | null = null;
  if (ride.trip_id) {
    const { data: trip } = await client.from('trips').select('driver_id, tricycle_id').eq('id', ride.trip_id).maybeSingle();
    driverId = trip?.driver_id ?? null;
    if (trip?.tricycle_id) {
      const { data: tricycle } = await client.from('tricycles').select('plate_no').eq('id', trip.tricycle_id).maybeSingle();
      plateNo = tricycle?.plate_no ?? null;
    }
  }

  const ids = [ride.passenger_id, driverId].filter((id): id is string => !!id);
  const names = new Map<string, string>();
  const { data: users } = await client.from('users').select('id, full_name').in('id', ids);
  for (const user of users ?? []) names.set(user.id, user.full_name!);

  return {
    data: {
      id: ride.id,
      status: ride.status,
      requestedAt: ride.requested_at,
      completedAt: ride.completed_at,
      cancelledAt: ride.cancelled_at,
      pickupLabel: ride.pickup_label,
      destLabel: ride.dest_label,
      fare: ride.final_fare ?? ride.estimated_fare ?? null,
      passengerName: names.get(ride.passenger_id) ?? null,
      driverName: driverId ? (names.get(driverId) ?? null) : null,
      plateNo,
    },
    error: null,
  };
}

export interface CaseContact {
  phone: string | null;
  email: string | null;
}

export interface GetCaseContactsResult {
  data: Record<string, CaseContact>;
  error: string | null;
}

/**
 * Phone and email by user id, read through the same masked directory views the Drivers and Passengers
 * screens use (admin_passenger_directory, admin_driver_directory). For PSO Staff those views return nothing
 * for phone and email, so this is safe to call for anyone; the report builders only print contact details
 * when the person printing is a Supervisor or Admin.
 */
export async function getCaseContacts(userIds: string[]): Promise<GetCaseContactsResult> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return { data: {}, error: null };

  const client = getSupabaseClient();
  const [passengers, drivers] = await Promise.all([
    client.from('admin_passenger_directory').select('id, contact_no, email').in('id', ids),
    client.from('admin_driver_directory').select('id, contact_no, email').in('id', ids),
  ]);

  const error = passengers.error?.message ?? drivers.error?.message ?? null;
  if (error) return { data: {}, error };

  const contacts: Record<string, CaseContact> = {};
  for (const row of [...(passengers.data ?? []), ...(drivers.data ?? [])]) {
    if (row.id) contacts[row.id] = { phone: row.contact_no ?? null, email: row.email ?? null };
  }
  return { data: contacts, error: null };
}
