export * from './supabase';
export * from './auth';
export * from './booking';
export * from './consents';
export * from './discount';
export * from './driver-profile';
export * from './fare';
export * from './notifications';
export * from './location';
export * from './storage';

export function getServiceStatus() {
  return 'Services ready';
}
