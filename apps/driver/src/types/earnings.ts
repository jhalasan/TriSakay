export interface DailyEarning {
  date: string;
  ridesCompleted: number;
  totalCollected: number;
}

export interface PeakHourBucket {
  hourLabel: string;
  count: number;
}
