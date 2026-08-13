export * from './supabase/index.ts';
export * from './auth/index.ts';
export * from './booking/index.ts';
export * from './complaints/index.ts';
export * from './consents/index.ts';
export * from './discount/index.ts';
export * from './driver-documents/index.ts';
export * from './driver-profile/index.ts';
export * from './fare/index.ts';
export * from './notifications/index.ts';
export * from './payments/index.ts';
export * from './ratings/index.ts';
export * from './location/index.ts';
export * from './storage/index.ts';
export * from './trip-history/index.ts';

export function getServiceStatus() {
  return 'Services ready';
}
