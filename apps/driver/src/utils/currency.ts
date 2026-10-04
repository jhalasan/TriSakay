/** The number only, for text that already carries its own peso sign (for example "₱{amount} to go"). */
export function formatAmount(amount: number): string {
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCurrency(amount: number): string {
  return `₱${formatAmount(amount)}`;
}
