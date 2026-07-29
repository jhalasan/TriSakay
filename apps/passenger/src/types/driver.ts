export interface Driver {
  id: string;
  name: string;
  plateNumber: string;
  /** Null until the backend supplies it — never render 0 stars for "unknown". */
  rating: number | null;
  etaMinutes: number | null;
}
