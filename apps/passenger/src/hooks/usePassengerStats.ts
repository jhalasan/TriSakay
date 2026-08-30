import { useEffect, useState } from 'react';
import { getPassengerStats, type PassengerStats } from '@trisakay/services';

/** Loads once per mount — Home doesn't need live updates to trips/discount within a session. */
export function usePassengerStats() {
  const [stats, setStats] = useState<PassengerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPassengerStats().then((result) => {
      if (!cancelled) {
        setStats(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading };
}
