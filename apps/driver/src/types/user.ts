export interface User {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  accountStatus: 'active' | 'flagged' | 'suspended' | 'deactivated';
}
