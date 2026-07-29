export * from './auth';
export * from './booking';
export * from './pocketbase';
export * from './notifications';
export * from './location';
export * from './supabase';

export function getServiceStatus() {
  return 'Services ready';
}
