/**
 * Format a number as currency with 2 decimal places
 */
export function formatCurrency(val) {
  return Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format a number with comma separators (no decimals for integers)
 */
export function formatNumber(val) {
  return Number(val || 0).toLocaleString();
}
