import type { AppType } from '../types';
import { APP_NAMES } from '../constants';

export function getAppName(app: AppType) {
  return APP_NAMES[app];
}
