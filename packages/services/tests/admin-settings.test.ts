import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import {
  getAdminFareConfig,
  getAdminFeatureToggles,
  getAdminSystemSettings,
  updateAdminFareConfig,
  updateAdminFeatureToggles,
} from '../src/admin/settings.ts';

function fakeClient(overrides: Record<string, unknown> = {}) {
  const fareConfig = { base_fare: 15.0, base_km: 4.0, rate_per_km: 1.0, discount_rate_percent: 20.0, ordinance_ref: 'Ordinance No. 08, s.2023' as string | null };
  const systemSettings = {
    bearing_tolerance_deg: 40.0,
    detour_ratio_max: 1.25,
    search_radius_km: 3.0,
    low_rating_threshold: 3.0,
    gcash_enabled: true,
    cash_enabled: true,
    franchise_expiry_notifications: true,
  };

  return {
    from: (table: string) => {
      if (table === 'fare_config') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fareConfig, error: null }) }) }) };
      }
      if (table === 'system_settings') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: systemSettings, error: null }) }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              Object.assign(systemSettings, patch);
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn !== 'update_fare_config') throw new Error(`unexpected rpc ${fn}`);
      fareConfig.base_fare = args.p_base_fare as number;
      fareConfig.base_km = args.p_base_km as number;
      fareConfig.rate_per_km = args.p_rate_per_km as number;
      return { data: 'fare1', error: null };
    },
    ...overrides,
  } as any;
}

test('getAdminFareConfig maps the active row', async () => {
  __setSupabaseClientForTests(fakeClient());
  const { data, error } = await getAdminFareConfig();
  assert.equal(error, null);
  assert.deepEqual(data, { baseFare: 15, baseKm: 4, ratePerKm: 1, discountRatePercent: 20, ordinanceRef: 'Ordinance No. 08, s.2023' });
});

test('getAdminFareConfig returns { data: null, error } on a query failure', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);
  const { data, error } = await getAdminFareConfig();
  assert.equal(data, null);
  assert.equal(error, 'connection refused');
});

test('updateAdminFareConfig carries discountRatePercent/ordinanceRef over from the current row and calls the RPC', async () => {
  let capturedRpc: { fn: string; args: Record<string, unknown> } | null = null;
  __setSupabaseClientForTests(
    fakeClient({
      rpc: async (fn: string, args: Record<string, unknown>) => {
        capturedRpc = { fn, args };
        return { data: 'fare1', error: null };
      },
    })
  );

  const { error } = await updateAdminFareConfig({ baseFare: 18, baseKm: 4.5, ratePerKm: 1.2 });
  assert.equal(error, null);
  assert.equal(capturedRpc!.fn, 'update_fare_config');
  assert.deepEqual(capturedRpc!.args, {
    p_base_fare: 18,
    p_base_km: 4.5,
    p_rate_per_km: 1.2,
    p_discount_rate_percent: 20.0,
    p_ordinance_ref: 'Ordinance No. 08, s.2023',
  });
});

test('updateAdminFareConfig returns an error without calling the RPC when there is no active row', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    rpc: async () => {
      throw new Error('the RPC must not run when there is no active fare_config row');
    },
  } as any);

  const { error } = await updateAdminFareConfig({ baseFare: 18, baseKm: 4, ratePerKm: 1 });
  assert.equal(error, 'No active fare configuration found');
});

test('getAdminSystemSettings and getAdminFeatureToggles both read from the same active system_settings row', async () => {
  __setSupabaseClientForTests(fakeClient());

  const [settings, toggles] = await Promise.all([getAdminSystemSettings(), getAdminFeatureToggles()]);
  assert.deepEqual(settings.data, { bearingToleranceDeg: 40, detourRatioMax: 1.25, searchRadiusKm: 3, lowRatingThreshold: 3 });
  assert.deepEqual(toggles.data, { gcashEnabled: true, cashEnabled: true, franchiseExpiryNotifications: true });
});

test('updateAdminFeatureToggles only patches the provided keys', async () => {
  const client = fakeClient();
  __setSupabaseClientForTests(client);

  const { error } = await updateAdminFeatureToggles({ gcashEnabled: false });
  assert.equal(error, null);

  const { data } = await getAdminFeatureToggles();
  assert.equal(data!.gcashEnabled, false);
  assert.equal(data!.cashEnabled, true);
  assert.equal(data!.franchiseExpiryNotifications, true);
});

test('updateAdminFeatureToggles is a no-op that skips the write when the patch is empty', async () => {
  __setSupabaseClientForTests({
    from: () => ({
      update: () => {
        throw new Error('must not write when the patch is empty');
      },
    }),
  } as any);

  const { error } = await updateAdminFeatureToggles({});
  assert.equal(error, null);
});
