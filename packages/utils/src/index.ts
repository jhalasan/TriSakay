export function formatCurrency(value: number, symbol = '₱') {
  return `${symbol}${value.toFixed(2)}`;
}
