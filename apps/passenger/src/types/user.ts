export interface User {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  /** P1-25 (2026-09-15 launch audit): mirrors the driver app's field — lets the root layout gate a suspended/deactivated account instead of leaving it hitting raw RLS rejections. */
  accountStatus: 'active' | 'flagged' | 'suspended' | 'deactivated';
}
