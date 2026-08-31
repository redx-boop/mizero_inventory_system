/**
 * Department Scope Middleware
 *
 * Centralizes the department-scoping logic that was previously duplicated
 * across multiple controllers (itemController, stockInController, stockOutController).
 *
 * stock_manager users are restricted to only seeing records related to
 * departments they are assigned to.
 *
 * Usage:
 *   const { scopeDepartments } = require('../middleware/departmentScope');
 *
 *   // In route handler:
 *   const { scopeDepartments } = require('../middleware/departmentScope');
 *   const { query, params } = scopeDepartments(req);
 *
 * Or use the middleware directly on routes:
 *   router.get('/', addDepartmentScope, controller.getItems);
 *   // req.departmentScopeQuery and req.departmentScopeParams are populated
 */

/**
 * Returns department scope filter clause and params for the current user.
 *
 * @param {object} req - Express request object (must have req.user)
 * @param {string} tableAlias - SQL table alias for the department_id column (e.g., 'i', 'so')
 * @returns {{ hasScope: boolean, clause: string, params: Array }}
 */
function getDepartmentScope(req, tableAlias = 'i') {
  const roleScoped = ['stock_manager'];

  if (roleScoped.includes(req.user?.role_name) && req.user?.department_ids?.length) {
    return {
      hasScope: true,
      clause: ` AND ${tableAlias}.department_id IN (?)`,
      params: [req.user.department_ids]
    };
  }

  return { hasScope: false, clause: '', params: [] };
}

/**
 * Express middleware that attaches department scope info to the request.
 * Populates req.departmentScope for use in query building.
 */
function addDepartmentScope(req, res, next) {
  const scope = getDepartmentScope(req);
  req.departmentScope = scope;
  next();
}

module.exports = { getDepartmentScope, addDepartmentScope };
