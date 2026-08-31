/**
 * Shared inventory rules and conditions.
 *
 * Centralizes low-stock logic so that Dashboard, Inventory, Reports,
 * and Notifications all use the exact same condition.
 */

/**
 * Check if an item object is low stock.
 * An item is low stock when:
 *   - It is NOT soft-deleted (deleted_at IS NULL)
 *   - Its quantity <= minimum_stock
 *
 * @param {Object} item - Item row from the database
 * @param {number|string} item.quantity - Current stock quantity
 * @param {number|string} item.minimum_stock - Minimum allowed stock
 * @param {string|null} item.deleted_at - Soft-delete timestamp (null = active)
 * @returns {boolean}
 */
function isLowStock(item) {
  if (item.deleted_at) return false;
  return Number(item.quantity) <= Number(item.minimum_stock);
}

/**
 * SQL WHERE fragment for low-stock queries.
 * Use this when building raw SQL queries to ensure consistency.
 *
 * @example
 *   const { clause, params } = lowStockCondition('i');
 *   query += clause;   // "AND i.deleted_at IS NULL AND i.quantity <= i.minimum_stock"
 *
 * @param {string} [alias=''] - Optional table alias (e.g., 'i', 'items')
 * @returns {{ clause: string, params: string[] }}
 */
function lowStockCondition(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return {
    clause: ` AND ${prefix}deleted_at IS NULL AND ${prefix}quantity <= ${prefix}minimum_stock`,
    params: [],
  };
}

module.exports = {
  isLowStock,
  lowStockCondition,
};
