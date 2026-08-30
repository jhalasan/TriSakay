import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { getNearbyDriverCount } from '@trisakay/services';
import { useLocationPermission } from './useLocationPermission';

/** Never prompts for permission — Home shouldn't interrupt the user just to show a count. Silently omits the count (returns null) if permission isn't already granted or the last-known position isn't available. */
export function useNearbyDriverCount() {
  const { isGranted } = useLocationPermission();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isGranted) return;
    let cancelled = false;
    Location.getLastKnownPositionAsync()
      .then((position) => {
        if (!position || cancelled) return null;
        return getNearbyDriverCount(position.coords.latitude, position.coords.longitude);
      })
      .then((result) => {
        if (!cancelled && result) setCount(result.count);
      })
      .catch(() => {
        /* leave count null — chip omits the segment */
      });
    return () => {
      cancelled = true;
    };
  }, [isGranted]);

  return count;
}
