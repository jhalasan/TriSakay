import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { createRideRequest, cancelRideRequest, getActiveRideForPassenger, subscribeToRideRequestStatus, acceptRideRequest, subscribeToPendingRideRequests, completeRideLeg, cancelRideLeg, endTrip, getTripDriverInfo, getTripPassengerInfo, listDriverTripHistory, getActiveTripForDriver, startRideLeg } from '../src/booking/index.ts';

test('createRideRequest inserts the full payload and returns the row', async () => {
  let capturedInsert: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'ride_requests');
        return {
          insert: (row: unknown) => {
            capturedInsert = row;
            return {
              select: () => ({
                single: async () => ({ data: { id: 'rr1', ...(row as object) }, error: null }),
              }),
            };
          },
        };
      },
    })
  );

  const { data, error } = await createRideRequest({
    passengerId: 'p1',
    pickup: { latitude: 6.11, longitude: 125.17, label: 'Home' },
    dropoff: { latitude: 6.12, longitude: 125.18, label: 'Mall' },
    seats: 2,
    distanceKm: 1.4,
    estimatedFare: 18,
    preferredMethod: 'cash',
    discountApplied: true,
    discountPercent: 20,
  });

  assert.equal(error, null);
  assert.equal(data?.id, 'rr1');
  assert.deepEqual(capturedInsert, {
    passenger_id: 'p1',
    pickup_lat: 6.11,
    pickup_lng: 125.17,
    pickup_label: 'Home',
    dest_lat: 6.12,
    dest_lng: 125.18,
    dest_label: 'Mall',
    seats_requested: 2,
    distance_km: 1.4,
    estimated_fare: 18,
    preferred_method: 'cash',
    discount_applied: true,
    discount_percent: 20,
  });
});

test('createRideRequest surfaces the Postgres error message', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: 'insert failed' } }),
          }),
        }),
      }),
    })
  );

  const { data, error } = await createRideRequest({
    passengerId: 'p1',
    pickup: { latitude: 0, longitude: 0, label: 'A' },
    dropoff: { latitude: 0, longitude: 0, label: 'B' },
    seats: 1,
    distanceKm: 1,
    estimatedFare: 15,
    preferredMethod: 'cash',
    discountApplied: false,
    discountPercent: null,
  });

  assert.equal(data, null);
  assert.equal(error, 'insert failed');
});

test('cancelRideRequest updates status to cancelled and returns no error on success', async () => {
  let capturedUpdate: any = null;
  let capturedId: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'ride_requests');
        return {
          update: (row: unknown) => {
            capturedUpdate = row;
            return {
              eq: (column: string, value: unknown) => {
                assert.equal(column, 'id');
                capturedId = value;
                return {
                  select: () => ({
                    maybeSingle: async () => ({ data: { id: value, status: 'cancelled' }, error: null }),
                  }),
                };
              },
            };
          },
        };
      },
    })
  );

  const { error } = await cancelRideRequest('rr1', 'Cancelled by passenger');
  assert.equal(error, null);
  assert.equal(capturedId, 'rr1');
  assert.equal(capturedUpdate.status, 'cancelled');
  assert.equal(capturedUpdate.cancel_reason, 'Cancelled by passenger');
});

test('cancelRideRequest reports a plain error when RLS rejects the update (already assigned)', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    })
  );

  const { error } = await cancelRideRequest('rr1', 'Cancelled by passenger');
  assert.equal(error, 'Could not cancel — this ride may already be assigned or no longer active.');
});

test('cancelRideRequest surfaces a genuine Postgres error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: { message: 'network error' } }),
            }),
          }),
        }),
      }),
    })
  );

  const { error } = await cancelRideRequest('rr1', 'Cancelled by passenger');
  assert.equal(error, 'network error');
});

test("getActiveRideForPassenger finds the passenger's most recent pending/assigned ride", async () => {
  const capturedEqArgs: [string, unknown][] = [];
  let capturedIn: [string, unknown[]] | null = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'ride_requests');
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              capturedEqArgs.push([column, value]);
              return {
                in: (column2: string, values: unknown[]) => {
                  capturedIn = [column2, values];
                  return {
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: {
                            id: 'rr1',
                            status: 'assigned',
                            pickup_label: 'Home',
                            pickup_lat: 6.11,
                            pickup_lng: 125.17,
                            dest_label: 'Mall',
                            dest_lat: 6.12,
                            dest_lng: 125.18,
                            seats_requested: 2,
                            estimated_fare: 25,
                            preferred_method: 'gcash',
                          },
                          error: null,
                        }),
                      }),
                    }),
                  };
                },
              };
            },
          }),
        };
      },
    })
  );

  const { data, error } = await getActiveRideForPassenger('p1');

  assert.equal(error, null);
  assert.deepEqual(capturedEqArgs, [['passenger_id', 'p1']]);
  assert.deepEqual(capturedIn, ['status', ['pending', 'assigned', 'ongoing']]);
  assert.deepEqual(data, {
    id: 'rr1',
    status: 'assigned',
    pickupLabel: 'Home',
    pickupLat: 6.11,
    pickupLng: 125.17,
    destLabel: 'Mall',
    destLat: 6.12,
    destLng: 125.18,
    seats: 2,
    estimatedFare: 25,
    preferredMethod: 'gcash',
  });
});

test('getActiveRideForPassenger returns null data with no error when there is no active ride', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
  );

  const { data, error } = await getActiveRideForPassenger('p1');
  assert.equal(data, null);
  assert.equal(error, null);
});

test('getActiveRideForPassenger surfaces a Postgres error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: { message: 'network error' } }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
  );

  const { data, error } = await getActiveRideForPassenger('p1');
  assert.equal(data, null);
  assert.equal(error, 'network error');
});

test('subscribeToRideRequestStatus filters on the row id and forwards status updates', async () => {
  let capturedArgs: any = null;
  let capturedHandler: ((payload: unknown) => void) | null = null;
  let capturedStatusCallback: ((status: string) => void) | null = null;
  let removedChannel: unknown = null;
  const fakeChannel = {
    on: (_event: string, filterArgs: unknown, handler: (payload: unknown) => void) => {
      capturedArgs = filterArgs;
      capturedHandler = handler;
      return fakeChannel;
    },
    subscribe: (statusCallback?: (status: string) => void) => {
      capturedStatusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: (name: string) => {
        assert.equal(name, 'ride_request_status_rr1');
        return fakeChannel;
      },
      removeChannel: (channel: unknown) => {
        removedChannel = channel;
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })
  );

  const received: unknown[] = [];
  const unsubscribe = subscribeToRideRequestStatus('rr1', (row) => received.push(row));

  assert.equal(capturedArgs.filter, 'id=eq.rr1');
  assert.equal(capturedArgs.event, 'UPDATE');
  assert.equal(capturedArgs.table, 'ride_requests');
  assert.ok(capturedStatusCallback);

  capturedHandler!({ new: { id: 'rr1', status: 'assigned' } });
  assert.deepEqual(received, [{ id: 'rr1', status: 'assigned' }]);

  unsubscribe();
  assert.equal(removedChannel, fakeChannel);
});

interface FakeStatusChannel {
  on: () => FakeStatusChannel;
  subscribe: (statusCallback?: (status: string) => void) => FakeStatusChannel;
}

test('subscribeToRideRequestStatus reconciles once the channel reports SUBSCRIBED', async () => {
  const captured: { statusCallback: ((status: string) => void) | null } = { statusCallback: null };
  let capturedTable: string | null = null;
  let capturedSelect: string | null = null;
  let capturedEqArgs: [string, unknown] | null = null;
  const fakeChannel: FakeStatusChannel = {
    on: () => fakeChannel,
    subscribe: (statusCallback?: (status: string) => void) => {
      captured.statusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
      from: (table: string) => {
        capturedTable = table;
        return {
          select: (columns: string) => {
            capturedSelect = columns;
            return {
              eq: (column: string, value: unknown) => {
                capturedEqArgs = [column, value];
                return {
                  maybeSingle: async () => ({ data: { id: 'rr1', status: 'assigned' }, error: null }),
                };
              },
            };
          },
        };
      },
    })
  );

  const received: unknown[] = [];
  subscribeToRideRequestStatus('rr1', (row) => received.push(row));

  const statusCallback = captured.statusCallback;
  assert.ok(statusCallback);
  statusCallback('SUBSCRIBED');

  // The reconcile query is async — flush microtasks.
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(capturedTable, 'ride_requests');
  assert.equal(capturedSelect, 'id, status');
  assert.deepEqual(capturedEqArgs, ['id', 'rr1']);
  assert.deepEqual(received, [{ id: 'rr1', status: 'assigned' }]);
});

test('subscribeToRideRequestStatus calls onError when the channel errors out or times out', async () => {
  const captured: { statusCallback: ((status: string) => void) | null } = { statusCallback: null };
  const fakeChannel: FakeStatusChannel = {
    on: () => fakeChannel,
    subscribe: (statusCallback?: (status: string) => void) => {
      captured.statusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })
  );

  const errors: string[] = [];
  subscribeToRideRequestStatus(
    'rr1',
    () => {},
    (message) => errors.push(message),
  );

  const statusCallback = captured.statusCallback;
  assert.ok(statusCallback);
  statusCallback('CHANNEL_ERROR');
  statusCallback('TIMED_OUT');

  assert.deepEqual(errors, [
    'Lost connection while waiting for a driver. Please check your connection.',
    'Lost connection while waiting for a driver. Please check your connection.',
  ]);
});

test('acceptRideRequest reuses an existing active trip and assigns the ride request', async () => {
  const capturedTripLookup: { column: string; value: unknown }[] = [];
  let capturedUpdate: any = null;
  const capturedUpdateFilters: { column: string; value: unknown }[] = [];

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => ({
              eq: (column: string, value: unknown) => {
                capturedTripLookup.push({ column, value });
                return {
                  eq: (column2: string, value2: unknown) => {
                    capturedTripLookup.push({ column: column2, value: value2 });
                    return {
                      maybeSingle: async () => ({ data: { id: 'trip1' }, error: null }),
                    };
                  },
                };
              },
            }),
          };
        }
        if (table === 'ride_requests') {
          return {
            update: (row: unknown) => {
              capturedUpdate = row;
              return {
                eq: (column: string, value: unknown) => {
                  capturedUpdateFilters.push({ column, value });
                  return {
                    eq: (column2: string, value2: unknown) => {
                      capturedUpdateFilters.push({ column: column2, value: value2 });
                      return {
                        select: () => ({
                          maybeSingle: async () => ({ data: { id: 'rr1' }, error: null }),
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const result = await acceptRideRequest('driver1', 'rr1');
  const { error } = result;

  assert.equal(error, null);
  assert.deepEqual(capturedTripLookup, [
    { column: 'driver_id', value: 'driver1' },
    { column: 'status', value: 'active' },
  ]);
  assert.equal(capturedUpdate.trip_id, 'trip1');
  assert.equal(capturedUpdate.status, 'assigned');
  assert.ok(capturedUpdate.assigned_at);
  assert.deepEqual(capturedUpdateFilters, [
    { column: 'id', value: 'rr1' },
    { column: 'status', value: 'pending' },
  ]);
  assert.equal(result.tripId, 'trip1');
});

test("acceptRideRequest creates a trip from the driver's active tricycle when none exists", async () => {
  const capturedTricycleLookup: { column: string; value: unknown }[] = [];
  let capturedTripInsert: any = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
            insert: (row: unknown) => {
              capturedTripInsert = row;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'trip2' }, error: null }),
                }),
              };
            },
          };
        }
        if (table === 'tricycles') {
          return {
            select: () => ({
              eq: (column: string, value: unknown) => {
                capturedTricycleLookup.push({ column, value });
                return {
                  eq: (column2: string, value2: unknown) => {
                    capturedTricycleLookup.push({ column: column2, value: value2 });
                    return {
                      eq: (column3: string, value3: unknown) => {
                        capturedTricycleLookup.push({ column: column3, value: value3 });
                        return {
                          maybeSingle: async () => ({ data: { id: 'tri1', seat_capacity: 3 }, error: null }),
                        };
                      },
                    };
                  },
                };
              },
            }),
          };
        }
        if (table === 'ride_requests') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    maybeSingle: async () => ({ data: { id: 'rr1' }, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const result = await acceptRideRequest('driver1', 'rr1');
  const { error } = result;

  assert.equal(error, null);
  assert.deepEqual(capturedTricycleLookup, [
    { column: 'driver_id', value: 'driver1' },
    { column: 'is_active', value: true },
    { column: 'verification_status', value: 'approved' },
  ]);
  assert.equal(capturedTripInsert.driver_id, 'driver1');
  assert.equal(capturedTripInsert.tricycle_id, 'tri1');
  assert.equal(capturedTripInsert.max_seats, 3);
  assert.equal(capturedTripInsert.status, 'active');
  assert.equal(result.tripId, 'trip2');
});

test('acceptRideRequest recovers from a trips_one_active_per_driver race by using the concurrent insert\'s trip', async () => {
  let tripSelectCalls = 0;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => {
              tripSelectCalls += 1;
              const isRaceRecoveryLookup = tripSelectCalls === 2;
              return {
                eq: () => ({
                  eq: () => ({
                    // First .select() (the normal pre-insert check): no active
                    // trip yet. Second .select() (after the 23505 below): the
                    // concurrent accept's insert already won, so this now finds it.
                    maybeSingle: async () =>
                      isRaceRecoveryLookup ? { data: { id: 'trip-race-winner' }, error: null } : { data: null, error: null },
                  }),
                }),
              };
            },
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { code: '23505', message: 'duplicate key value violates unique constraint "trips_one_active_per_driver"' },
                }),
              }),
            }),
          };
        }
        if (table === 'tricycles') {
          return {
            select: () => ({
              eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'tri1', seat_capacity: 3 }, error: null }) }) }) }),
            }),
          };
        }
        if (table === 'ride_requests') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({ maybeSingle: async () => ({ data: { id: 'rr1' }, error: null }) }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const result = await acceptRideRequest('driver1', 'rr1');

  assert.equal(result.error, null);
  assert.equal(result.tripId, 'trip-race-winner');
  assert.equal(tripSelectCalls, 2);
});

test('acceptRideRequest reports a clear error when the driver has no active tricycle', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
          };
        }
        if (table === 'tricycles') {
          return {
            select: () => ({
              eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await acceptRideRequest('driver1', 'rr1');
  assert.equal(error, 'No active tricycle assigned yet — finish vehicle verification first.');
});

test('acceptRideRequest reports a clear error when another driver already accepted the request', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'trip1' }, error: null }) }) }) }),
          };
        }
        if (table === 'ride_requests') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await acceptRideRequest('driver1', 'rr1');
  assert.equal(error, 'This ride was just accepted by another driver.');
});

test('acceptRideRequest surfaces a Postgres error from the assignment update', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'trip1' }, error: null }) }) }) }),
          };
        }
        if (table === 'ride_requests') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'network error' } }) }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await acceptRideRequest('driver1', 'rr1');
  assert.equal(error, "Couldn't assign this ride. Please try again.");
});

test('subscribeToPendingRideRequests invokes match-ride-request with driverId on SUBSCRIBED and on every change event', async () => {
  let capturedChannelName: string | null = null;
  let capturedOnArgs: any = null;
  let capturedChangeHandler: (() => void) | null = null;
  // Wrapped in an object, not a bare `let`: a closure-assigned `let` gets
  // control-flow-narrowed back to its `null` initializer at the call site
  // below (TS can't see the fake's subscribe() ran), so `assert.ok` would
  // narrow it to `never`. Reading an object property keeps the declared
  // union type — same pattern as the SUBSCRIBED-reconcile test above.
  const captured: { statusCallback: ((status: string) => void) | null } = { statusCallback: null };
  const capturedInvokeArgs: { name: string; options: any }[] = [];
  let call = 0;

  const fakeChannel = {
    on: (event: string, filterArgs: unknown, handler: () => void) => {
      assert.equal(event, 'postgres_changes');
      capturedOnArgs = filterArgs;
      capturedChangeHandler = handler;
      return fakeChannel;
    },
    subscribe: (statusCallback?: (status: string) => void) => {
      captured.statusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: (name: string) => {
        capturedChannelName = name;
        return fakeChannel;
      },
      removeChannel: () => {},
      functionsInvoke: async (name, options) => {
        capturedInvokeArgs.push({ name, options });
        call += 1;
        return { data: { data: [{ id: `rr${call}` }], error: null }, error: null };
      },
    })
  );

  const received: unknown[] = [];
  const unsubscribe = subscribeToPendingRideRequests('driver1', (rows) => received.push(rows));

  assert.equal(capturedChannelName, 'pending_ride_requests');
  assert.equal(capturedOnArgs.event, '*');
  assert.equal(capturedOnArgs.schema, 'public');
  assert.equal(capturedOnArgs.table, 'ride_requests');
  const statusCallback = captured.statusCallback;
  assert.ok(statusCallback);

  statusCallback('SUBSCRIBED');
  await Promise.resolve();
  await Promise.resolve();

  // The initial post-SUBSCRIBED refetch is immediate; a change-triggered
  // refetch is debounced (collapses a burst of events into one Edge
  // Function call), so this waits out the debounce window instead of
  // asserting synchronously.
  capturedChangeHandler!();
  await new Promise((resolve) => setTimeout(resolve, 600));

  assert.deepEqual(capturedInvokeArgs, [
    { name: 'match-ride-request', options: { body: { driverId: 'driver1' } } },
    { name: 'match-ride-request', options: { body: { driverId: 'driver1' } } },
  ]);
  assert.deepEqual(received, [[{ id: 'rr1' }], [{ id: 'rr2' }]]);

  unsubscribe();
});

test('subscribeToPendingRideRequests collapses a burst of change events into a single debounced refetch', async () => {
  const captured: { statusCallback: ((status: string) => void) | null; changeHandler: (() => void) | null } = {
    statusCallback: null,
    changeHandler: null,
  };
  const fakeChannel = {
    on: (_event: string, _filterArgs: unknown, handler: () => void) => {
      captured.changeHandler = handler;
      return fakeChannel;
    },
    subscribe: (statusCallback?: (status: string) => void) => {
      captured.statusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  let invokeCount = 0;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
      functionsInvoke: async () => {
        invokeCount += 1;
        return { data: { data: [], error: null }, error: null };
      },
    })
  );

  const unsubscribe = subscribeToPendingRideRequests('driver1', () => {});

  captured.statusCallback!('SUBSCRIBED');
  await Promise.resolve();
  await Promise.resolve();
  invokeCount = 0; // isolate the burst below from the initial post-SUBSCRIBED refetch

  captured.changeHandler!();
  captured.changeHandler!();
  captured.changeHandler!();
  await new Promise((resolve) => setTimeout(resolve, 600));

  assert.equal(invokeCount, 1);

  unsubscribe();
});

test('subscribeToPendingRideRequests forwards channel errors', async () => {
  let capturedStatusCallback: ((status: string) => void) | null = null;
  const fakeChannel = {
    on: () => fakeChannel,
    subscribe: (statusCallback?: (status: string) => void) => {
      capturedStatusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
      functionsInvoke: async () => ({ data: { data: [], error: null }, error: null }),
    })
  );

  const errors: string[] = [];
  subscribeToPendingRideRequests(
    'driver1',
    () => {},
    (message) => errors.push(message),
  );

  capturedStatusCallback!('CHANNEL_ERROR');
  capturedStatusCallback!('TIMED_OUT');

  assert.deepEqual(errors, [
    'Lost connection while listening for ride requests. Please check your connection.',
    'Lost connection while listening for ride requests. Please check your connection.',
  ]);
});

test('subscribeToPendingRideRequests unsubscribe removes the channel', async () => {
  const fakeChannel = {
    on: () => fakeChannel,
    subscribe: () => fakeChannel,
  };
  let removedChannel: unknown = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: (channel: unknown) => {
        removedChannel = channel;
      },
      functionsInvoke: async () => ({ data: { data: [], error: null }, error: null }),
    })
  );

  const unsubscribe = subscribeToPendingRideRequests('driver1', () => {});
  unsubscribe();

  assert.equal(removedChannel, fakeChannel);
});

test('subscribeToPendingRideRequests forwards a friendly message for an Edge Function transport error instead of treating it as an empty list', async () => {
  let capturedStatusCallback: ((status: string) => void) | null = null;
  const fakeChannel = {
    on: () => fakeChannel,
    subscribe: (statusCallback?: (status: string) => void) => {
      capturedStatusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
      functionsInvoke: async () => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code' } }),
    })
  );

  const receivedData: unknown[] = [];
  const receivedErrors: string[] = [];
  subscribeToPendingRideRequests(
    'driver1',
    (rows) => receivedData.push(rows),
    (message) => receivedErrors.push(message),
  );

  capturedStatusCallback!('SUBSCRIBED');
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(receivedData, []);
  assert.deepEqual(receivedErrors, ["Couldn't load ride requests. Please check your connection and try again."]);
});

test('subscribeToPendingRideRequests translates a 401 "Not authenticated" body into a re-login message', async () => {
  let capturedStatusCallback: ((status: string) => void) | null = null;
  const fakeChannel = {
    on: () => fakeChannel,
    subscribe: (statusCallback?: (status: string) => void) => {
      capturedStatusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  const response = new Response(JSON.stringify({ data: null, error: 'Not authenticated' }), { status: 401 });

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
      functionsInvoke: async () => ({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: response },
      }),
    })
  );

  const receivedData: unknown[] = [];
  const receivedErrors: string[] = [];
  subscribeToPendingRideRequests(
    'driver1',
    (rows) => receivedData.push(rows),
    (message) => receivedErrors.push(message),
  );

  capturedStatusCallback!('SUBSCRIBED');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(receivedData, []);
  assert.deepEqual(receivedErrors, ['Your session expired. Please log out and log back in.']);
});

test('subscribeToPendingRideRequests forwards an in-body error from the Edge Function via onError', async () => {
  let capturedStatusCallback: ((status: string) => void) | null = null;
  const fakeChannel = {
    on: () => fakeChannel,
    subscribe: (statusCallback?: (status: string) => void) => {
      capturedStatusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
      functionsInvoke: async () => ({ data: { data: null, error: 'driverId must match the authenticated user' }, error: null }),
    })
  );

  const receivedData: unknown[] = [];
  const receivedErrors: string[] = [];
  subscribeToPendingRideRequests(
    'driver1',
    (rows) => receivedData.push(rows),
    (message) => receivedErrors.push(message),
  );

  capturedStatusCallback!('SUBSCRIBED');
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(receivedData, []);
  assert.deepEqual(receivedErrors, ['driverId must match the authenticated user']);
});

test('getTripPassengerInfo maps the RPC row into TripPassengerInfo', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return {
          data: [{
            passenger_id: 'p1',
            passenger_name: 'Maria Clara',
            avatar_url: 'https://example.com/p1.jpg',
          }],
          error: null,
        };
      },
    })
  );

  const { data, error } = await getTripPassengerInfo('rr1');

  assert.equal(error, null);
  assert.equal(capturedFn, 'get_trip_passenger_info');
  assert.deepEqual(capturedArgs, { p_ride_request_id: 'rr1' });
  assert.deepEqual(data, {
    passengerId: 'p1',
    passengerName: 'Maria Clara',
    avatarUrl: 'https://example.com/p1.jpg',
  });
});

test('getTripPassengerInfo surfaces an RPC error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'network error' } }),
    })
  );

  const { data, error } = await getTripPassengerInfo('rr1');
  assert.equal(data, null);
  assert.equal(error, 'network error');
});

test('getTripPassengerInfo returns null data with no error on an empty result set (not this driver\'s trip)', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: [], error: null }),
    })
  );

  const { data, error } = await getTripPassengerInfo('rr1');
  assert.equal(data, null);
  assert.equal(error, null);
});

test('getActiveTripForDriver combines the trip header with every passenger leg', async () => {
  const capturedCalls: { fn: string; args: any }[] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedCalls.push({ fn, args });
        if (fn === 'get_active_trip_for_driver') {
          return { data: [{ trip_id: 'trip1', started_at: '2026-08-10T00:00:00.000Z' }], error: null };
        }
        if (fn === 'get_active_trip_passengers') {
          return {
            data: [
              {
                ride_request_id: 'rr1',
                seats_requested: 2,
                preferred_method: 'cash',
                estimated_fare: 55,
                passenger_id: 'p1',
                passenger_name: 'Maria Clara',
                avatar_url: 'https://example.com/p1.jpg',
                cash_confirmed: false,
                status: 'ongoing',
              },
              {
                ride_request_id: 'rr2',
                seats_requested: 1,
                preferred_method: 'gcash',
                estimated_fare: 20,
                passenger_id: 'p2',
                passenger_name: 'Juan Pablo',
                avatar_url: null,
                cash_confirmed: false,
                status: 'assigned',
              },
            ],
            error: null,
          };
        }
        throw new Error(`unexpected rpc ${fn}`);
      },
    })
  );

  const { data, error } = await getActiveTripForDriver();

  assert.equal(error, null);
  assert.equal(capturedCalls[0].fn, 'get_active_trip_for_driver');
  assert.equal(capturedCalls[1].fn, 'get_active_trip_passengers');
  assert.deepEqual(capturedCalls[1].args, { p_trip_id: 'trip1' });
  assert.deepEqual(data, {
    tripId: 'trip1',
    startedAt: '2026-08-10T00:00:00.000Z',
    passengers: [
      {
        rideRequestId: 'rr1',
        seats: 2,
        paymentMethod: 'cash',
        fare: 55,
        passengerId: 'p1',
        passengerName: 'Maria Clara',
        passengerAvatarUrl: 'https://example.com/p1.jpg',
        cashConfirmed: false,
        status: 'ongoing',
      },
      {
        rideRequestId: 'rr2',
        seats: 1,
        paymentMethod: 'gcash',
        fare: 20,
        passengerId: 'p2',
        passengerName: 'Juan Pablo',
        passengerAvatarUrl: null,
        cashConfirmed: false,
        status: 'assigned',
      },
    ],
  });
});

test('getActiveTripForDriver returns an active trip with an empty passengers array — not confused with no trip at all', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn) => {
        if (fn === 'get_active_trip_for_driver') {
          return { data: [{ trip_id: 'trip1', started_at: '2026-08-10T00:00:00.000Z' }], error: null };
        }
        if (fn === 'get_active_trip_passengers') return { data: [], error: null };
        throw new Error(`unexpected rpc ${fn}`);
      },
    })
  );

  const { data, error } = await getActiveTripForDriver();
  assert.equal(error, null);
  assert.deepEqual(data, { tripId: 'trip1', startedAt: '2026-08-10T00:00:00.000Z', passengers: [] });
});

test('getActiveTripForDriver surfaces a trip-header RPC error without calling the passengers RPC', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn) => {
        if (fn === 'get_active_trip_for_driver') return { data: null, error: { message: 'network error' } };
        throw new Error('must not fetch passengers when the trip-header call failed');
      },
    })
  );

  const { data, error } = await getActiveTripForDriver();
  assert.equal(data, null);
  assert.equal(error, 'network error');
});

test('getActiveTripForDriver returns null data with no error when there is no active trip', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn) => {
        if (fn === 'get_active_trip_for_driver') return { data: [], error: null };
        throw new Error('must not fetch passengers when there is no active trip');
      },
    })
  );

  const { data, error } = await getActiveTripForDriver();
  assert.equal(data, null);
  assert.equal(error, null);
});

test('listDriverTripHistory maps RPC rows and picks the right date per status', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return {
          data: [
            { ride_request_id: 'rr1', passenger_name: 'Maria Clara', status: 'completed', fare: 45, completed_at: '2026-08-10T00:00:00.000Z', cancelled_at: null, requested_at: '2026-08-09T23:00:00.000Z' },
            { ride_request_id: 'rr2', passenger_name: null, status: 'cancelled', fare: null, completed_at: null, cancelled_at: '2026-08-08T00:00:00.000Z', requested_at: '2026-08-07T23:00:00.000Z' },
          ],
          error: null,
        };
      },
    })
  );

  const { data, error } = await listDriverTripHistory(20);

  assert.equal(error, null);
  assert.equal(capturedFn, 'get_driver_trip_history');
  assert.deepEqual(capturedArgs, { p_limit: 20 });
  assert.deepEqual(data, [
    { rideRequestId: 'rr1', passengerName: 'Maria Clara', status: 'completed', fare: 45, date: '2026-08-10T00:00:00.000Z' },
    { rideRequestId: 'rr2', passengerName: null, status: 'cancelled', fare: null, date: '2026-08-08T00:00:00.000Z' },
  ]);
});

test('listDriverTripHistory defaults the limit to 50', async () => {
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (_fn, args) => {
        capturedArgs = args;
        return { data: [], error: null };
      },
    })
  );

  await listDriverTripHistory();
  assert.deepEqual(capturedArgs, { p_limit: 50 });
});

test('listDriverTripHistory surfaces an RPC error with an empty list', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'network error' } }),
    })
  );

  const { data, error } = await listDriverTripHistory();
  assert.deepEqual(data, []);
  assert.equal(error, 'network error');
});

test('completeRideLeg calls the complete_ride_leg RPC with the trip and ride request ids', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return { data: [{ ride_request_id: 'rr1' }], error: null };
      },
    })
  );

  const { error } = await completeRideLeg('trip1', 'rr1');

  assert.equal(error, null);
  assert.equal(capturedFn, 'complete_ride_leg');
  assert.deepEqual(capturedArgs, { p_trip_id: 'trip1', p_ride_request_id: 'rr1' });
});

test('completeRideLeg surfaces a friendly error when the RPC fails', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'No active trip found for this driver to complete' } }),
    })
  );

  const { error } = await completeRideLeg('trip1', 'rr1');
  assert.equal(error, "Couldn't close out this passenger's ride. Please try again.");
});

test('cancelRideLeg calls the cancel_ride_leg RPC with the trip id, ride request id, and reason', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return { data: [{ ride_request_id: 'rr1' }], error: null };
      },
    })
  );

  const { error } = await cancelRideLeg('trip1', 'rr1', 'Passenger no-show');

  assert.equal(error, null);
  assert.equal(capturedFn, 'cancel_ride_leg');
  assert.deepEqual(capturedArgs, { p_trip_id: 'trip1', p_ride_request_id: 'rr1', p_reason: 'Passenger no-show' });
});

test('cancelRideLeg surfaces a friendly error when the RPC fails', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'No active trip found for this driver to cancel' } }),
    })
  );

  const { error } = await cancelRideLeg('trip1', 'rr1', 'Passenger no-show');
  assert.equal(error, "Couldn't cancel this passenger's ride. Please try again.");
});

test('startRideLeg calls the start_ride_leg RPC with the trip id and ride request id', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return { data: [{ ride_request_id: 'rr1' }], error: null };
      },
    })
  );

  const { error } = await startRideLeg('trip1', 'rr1');

  assert.equal(error, null);
  assert.equal(capturedFn, 'start_ride_leg');
  assert.deepEqual(capturedArgs, { p_trip_id: 'trip1', p_ride_request_id: 'rr1' });
});

test('startRideLeg surfaces a friendly error when the RPC fails', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'Ride request not found for this trip' } }),
    })
  );

  const { error } = await startRideLeg('trip1', 'rr1');
  assert.equal(error, "Couldn't start this passenger's ride. Please try again.");
});

test('getActiveTripForDriver maps each passenger row\'s status field', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn) => {
        if (fn === 'get_active_trip_for_driver') {
          return { data: [{ trip_id: 't1', started_at: '2026-08-30T00:00:00Z' }], error: null };
        }
        if (fn === 'get_active_trip_passengers') {
          return {
            data: [
              {
                ride_request_id: 'rr1',
                seats_requested: 1,
                preferred_method: 'cash',
                estimated_fare: 20,
                passenger_id: 'p1',
                passenger_name: 'Ana',
                avatar_url: null,
                cash_confirmed: false,
                status: 'ongoing',
              },
            ],
            error: null,
          };
        }
        throw new Error(`unexpected rpc ${fn}`);
      },
    })
  );

  const { data, error } = await getActiveTripForDriver();
  assert.equal(error, null);
  assert.equal(data?.passengers[0]?.status, 'ongoing');
});

test('endTrip calls the end_trip RPC with the trip id', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return { data: [{ trip_id: 'trip1' }], error: null };
      },
    })
  );

  const { error } = await endTrip('trip1');

  assert.equal(error, null);
  assert.equal(capturedFn, 'end_trip');
  assert.deepEqual(capturedArgs, { p_trip_id: 'trip1' });
});

test('endTrip surfaces the RPC error verbatim (e.g. "passenger still active")', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'Cannot end trip -- 1 passenger(s) still active' } }),
    })
  );

  const { error } = await endTrip('trip1');
  assert.equal(error, 'Cannot end trip -- 1 passenger(s) still active');
});

test('getTripDriverInfo maps the RPC row into TripDriverInfo', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return {
          data: [{
            driver_id: 'driver1',
            driver_name: 'Juan Dela Cruz',
            avatar_url: 'https://example.com/a.jpg',
            plate_no: 'ABC-123',
            rating_avg: 4.8,
            rating_count: 12,
          }],
          error: null,
        };
      },
    })
  );

  const { data, error } = await getTripDriverInfo('rr1');

  assert.equal(error, null);
  assert.equal(capturedFn, 'get_trip_driver_info');
  assert.deepEqual(capturedArgs, { p_ride_request_id: 'rr1' });
  assert.deepEqual(data, {
    driverId: 'driver1',
    driverName: 'Juan Dela Cruz',
    avatarUrl: 'https://example.com/a.jpg',
    plateNo: 'ABC-123',
    ratingAvg: 4.8,
    ratingCount: 12,
  });
});

test('getTripDriverInfo surfaces an RPC error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'network error' } }),
    })
  );

  const { data, error } = await getTripDriverInfo('rr1');
  assert.equal(data, null);
  assert.equal(error, 'network error');
});

test('getTripDriverInfo returns null data with no error on an empty result set', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: [], error: null }),
    })
  );

  const { data, error } = await getTripDriverInfo('rr1');
  assert.equal(data, null);
  assert.equal(error, null);
});
