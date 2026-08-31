/**
 * Financial Calculation Utilities
 *
 * All financial arithmetic uses Decimal.js to prevent floating-point drift.
 * These functions are used by controllers for consistent, precise calculations.
 *
 * IMPORTANT: The actual AVCO query runs in SQL (SUM(quantity*unit_price)/SUM(quantity)).
 * These utilities exist for application-level calculations and fallback scenarios.
 */
const Decimal = require('decimal.js');

// Set default precision for RWF (no fractional cents)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Safely convert a value to Decimal, defaulting to 0 for null/undefined/NaN
 */
function toDecimal(val) {
  if (val === null || val === undefined) return new Decimal(0);
  if (val instanceof Decimal) return val;
  const num = Number(val);
  return Number.isFinite(num) ? new Decimal(num) : new Decimal(0);
}

/**
 * Format a number to 2 decimal places (standard for RWF)
 */
function formatCurrency(val) {
  return toDecimal(val).toFixed(2);
}

/**
 * Parse a value as a number, defaulting to 0
 */
function parseNumber(val) {
  return toDecimal(val).toNumber();
}

/**
 * AVCO — Weighted Average Cost per Unit
 * Formula: (current_qty × current_cost + incoming_qty × incoming_price) / (current_qty + incoming_qty)
 *
 * @param {number|string} currentQty - Current quantity in stock
 * @param {number|string} currentCost - Current unit cost (AVCO)
 * @param {number|string} incomingQty - Quantity being added
 * @param {number|string} incomingPrice - Unit price of incoming stock
 * @returns {number} New weighted average cost, rounded to 2 decimal places
 */
function calculateAVCO(currentQty, currentCost, incomingQty, incomingPrice) {
  const cQty = toDecimal(currentQty);
  const cCost = toDecimal(currentCost);
  const iQty = toDecimal(incomingQty);
  const iPrice = toDecimal(incomingPrice);

  const totalQty = cQty.plus(iQty);
  if (totalQty.isZero()) return 0;

  const totalValue = cQty.times(cCost).plus(iQty.times(iPrice));
  return totalValue.div(totalQty).toDecimalPlaces(2).toNumber();
}

/**
 * AVCO from all stock-in records (mirrors the actual SQL query)
 * Formula: SUM(quantity × unit_price for all records) / SUM(quantity)
 *
 * @param {Array<{quantity: number, unit_price: number}>} records - All stock-in records for an item
 * @returns {number} Weighted average cost, rounded to 2 decimal places
 */
function calculateAVCOFromAllRecords(records) {
  if (!records || records.length === 0) return 0;

  let totalQty = new Decimal(0);
  let totalCost = new Decimal(0);

  for (const record of records) {
    const qty = toDecimal(record.quantity);
    const price = toDecimal(record.unit_price);
    totalQty = totalQty.plus(qty);
    totalCost = totalCost.plus(qty.times(price));
  }

  if (totalQty.isZero()) return 0;
  return totalCost.div(totalQty).toDecimalPlaces(2).toNumber();
}

/**
 * Inventory Value
 * Formula: quantity × unit_cost
 */
function calculateInventoryValue(quantity, unitCost) {
  return toDecimal(quantity).times(toDecimal(unitCost)).toNumber();
}

/**
 * Replacement Cost
 * Formula: unit_cost × quantity
 */
function calculateReplacementCost(unitCost, quantity) {
  return toDecimal(unitCost).times(toDecimal(quantity)).toNumber();
}

/**
 * Damage Liability (50% of replacement cost)
 */
function calculateDamageLiability(replacementCost) {
  return toDecimal(replacementCost).times(0.5).toNumber();
}

/**
 * Loss Liability (100% of replacement cost)
 */
function calculateLossLiability(replacementCost) {
  return toDecimal(replacementCost).times(1.0).toNumber();
}

/**
 * Liability Amount based on type
 */
function calculateLiabilityAmount(unitCost, quantity, liabilityType) {
  const replacementCost = calculateReplacementCost(unitCost, quantity);
  if (liabilityType === 'lost') return replacementCost; // 100%
  return toDecimal(replacementCost).times(0.5).toNumber(); // 50% for damage
}

/**
 * Budget Remaining
 */
function calculateBudgetRemaining(totalBudget, amountUsed) {
  return Decimal.max(0, toDecimal(totalBudget).minus(toDecimal(amountUsed))).toNumber();
}

/**
 * Budget Usage Percentage
 */
function calculateBudgetUsagePct(totalBudget, amountUsed) {
  const budget = toDecimal(totalBudget);
  const used = toDecimal(amountUsed);
  if (budget.isZero()) return 0;
  return used.div(budget).times(100).toDecimalPlaces(1).toNumber();
}

/**
 * Stock-Out Cost (COGS snapshot)
 */
function calculateStockOutCost(unitCostAtTime, quantity) {
  return toDecimal(unitCostAtTime).times(toDecimal(quantity)).toNumber();
}

/**
 * Remaining Balance on a liability
 */
function calculateRemainingBalance(totalLiability, amountPaid) {
  return Decimal.max(0, toDecimal(totalLiability).minus(toDecimal(amountPaid))).toNumber();
}

/**
 * Round a value to 2 decimal places (for display/storage)
 */
function roundToCents(val) {
  return toDecimal(val).toDecimalPlaces(2).toNumber();
}

module.exports = {
  toDecimal,
  formatCurrency,
  parseNumber,
  calculateAVCO,
  calculateAVCOFromAllRecords,
  calculateInventoryValue,
  calculateReplacementCost,
  calculateDamageLiability,
  calculateLossLiability,
  calculateLiabilityAmount,
  calculateBudgetRemaining,
  calculateBudgetUsagePct,
  calculateStockOutCost,
  calculateRemainingBalance,
  roundToCents
};
