import type { TricycleCluster } from '@trisakay/services';

/** Matches the admin app's CLUSTER_OPTIONS labels (apps/admin/src/routes/Tricycles.tsx) — keep the two in sync. */
export const CLUSTER_LABEL: Record<TricycleCluster, string> = {
  red: 'Red',
  white: 'White',
  apple_green: 'Apple Green',
  melting_pot: 'Melting Pot',
};
