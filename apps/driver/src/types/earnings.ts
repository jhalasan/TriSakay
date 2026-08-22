export interface SettlementLogEntry {
  id: string;
  amount: number;
  loggedAt: string;
}

export interface DailyEarning {
  date: string;
  ridesCompleted: number;
  totalCollected: number;
}
