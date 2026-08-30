import { useEffect, useState } from 'react';
import { getDriverUnit, type DriverUnitResult } from '@trisakay/services';

export function useDriverUnit() {
  const [unit, setUnit] = useState<DriverUnitResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDriverUnit().then((result) => {
      if (!cancelled) setUnit(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return unit;
}
