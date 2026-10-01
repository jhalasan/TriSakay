import type { AppType } from '../types/index.ts';
import { APP_NAMES } from '../constants/index.ts';

export function getAppName(app: AppType) {
  return APP_NAMES[app];
}

export * from './chat.ts';
export * from './geo.ts';
export * from './nextStop.ts';
export * from './records.ts';
export * from './mask.ts';
