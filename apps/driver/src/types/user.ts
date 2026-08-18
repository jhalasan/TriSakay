export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  accountStatus: 'active' | 'flagged' | 'suspended' | 'deactivated';
}
