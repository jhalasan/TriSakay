export * from './supabase';
export * from './auth';
export * from './booking';
export * from './consents';
export * from './notifications';
export * from './location';
export * from './storage';

export function getServiceStatus() {
  return 'Services ready';
}
