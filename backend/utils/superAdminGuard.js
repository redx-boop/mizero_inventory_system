/**
 * Super Admin Protection Guard
 * 
 * Centralized validation and audit logging for Super Admin account protections.
 * Every operation that touches user creation, update, deletion, or role change
 * must go through this guard.
 */
const pool = require('../config/db');
const logActivity = require('./activityLogger');

/**
 * Get the role ID for 'super_admin' from the database (cached per call)
 */
let superAdminRoleIdCache = null;
async function getSuperAdminRoleId() {
  if (superAdminRoleIdCache) return superAdminRoleIdCache;
  const [rows] = await pool.query('SELECT id FROM roles WHERE name = ?', ['super_admin']);
  if (rows.length === 0) throw new Error('Super Admin role not found in system.');
  superAdminRoleIdCache = rows[0].id;
  return superAdminRoleIdCache;
}

/**
 * Count how many active Super Admin accounts exist
 */
async function countActiveSuperAdmins() {
  const roleId = await getSuperAdminRoleId();
  const [rows] = await pool.query(
    'SELECT COUNT(*) as count FROM users WHERE role_id = ? AND status = ?',
    [roleId, 'active']
  );
  return rows[0].count;
}

/**
 * Check if a given user_id is a Super Admin
 */
async function isSuperAdmin(userId) {
  const roleId = await getSuperAdminRoleId();
  const [rows] = await pool.query(
    'SELECT id FROM users WHERE id = ? AND role_id = ?',
    [userId, roleId]
  );
  return rows.length > 0;
}

/**
 * Log an audit event to the super_admin_audit_log table
 * @param {number} actorId - The user performing the action
 * @param {string} action - The action being audited
 * @param {number|null} targetUserId - The target user (or null)
 * @param {string} details - Description of the event
 * @param {string|null} ipAddress - The actor's IP address
 * @param {string} status - 'blocked' or 'allowed'
 */
async function logAuditEvent(actorId, action, targetUserId, details, ipAddress, status) {
  try {
    await pool.query(
      'INSERT INTO super_admin_audit_log (actor_id, action, target_user_id, details, ip_address, status) VALUES (?, ?, ?, ?, ?, ?)',
      [actorId, action, targetUserId || null, details, ipAddress || null, status]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
}

/**
 * Check if a target user_id is the ONLY active Super Admin
 */
async function isLastActiveSuperAdmin(userId) {
  if (!(await isSuperAdmin(userId))) return false;
  const count = await countActiveSuperAdmins();
  return count <= 1;
}

/**
 * Guard: Prevent creating a second Super Admin
 * @param {number} roleId - The role_id being assigned
 * @param {number} adminUserId - The requesting user's ID (for audit)
 * @throws {Error} If creation would result in duplicate Super Admin
 */
async function guardCreateSuperAdmin(roleId, adminUserId, ipAddress) {
  const superRoleId = await getSuperAdminRoleId();
  if (parseInt(roleId) !== superRoleId) return; // Not creating a super admin

  const count = await countActiveSuperAdmins();
  if (count >= 1) {
    const details = 'BLOCKED: Attempted to create a second Super Admin account. Only one Super Admin is allowed.';
    await logAuditEvent(adminUserId, 'create_super_admin', null, details, ipAddress, 'blocked');
    await logActivity(adminUserId, 'super_admin_violation', 'security', details);
    throw new Error('A Super Admin account already exists. Only one Super Admin is permitted in the system.');
  }
}

/**
 * Guard: Prevent modifying the Super Admin account
 * @param {number} targetUserId - The user being modified
 * @param {object} changes - The proposed changes { role_id, status, department_id, etc. }
 * @param {number} adminUserId - The requesting user's ID
 * @throws {Error} If the operation would compromise Super Admin integrity
 */
async function guardUpdateSuperAdmin(targetUserId, changes, adminUserId, ipAddress) {
  const isTargetSuperAdmin = await isSuperAdmin(targetUserId);
  if (!isTargetSuperAdmin) {
    // Target is not a super admin — check if they're being promoted TO super admin
    const superRoleId = await getSuperAdminRoleId();
    if (changes.role_id && parseInt(changes.role_id) === superRoleId) {
      const count = await countActiveSuperAdmins();
      if (count >= 1) {
        const details = `BLOCKED: Attempted to promote user ID ${targetUserId} to Super Admin. Only one Super Admin is allowed.`;
        await logAuditEvent(adminUserId, 'promote_super_admin', targetUserId, details, ipAddress, 'blocked');
        await logActivity(adminUserId, 'super_admin_violation', 'security', details);
        throw new Error('Cannot promote another user to Super Admin. Only one Super Admin is permitted in the system.');
      }
    }
    return; // Not touching super admin, no further checks
  }

  // === TARGET IS THE SUPER ADMIN ===

  // Cannot change role
  if (changes.role_id !== undefined) {
    const details = `BLOCKED: Attempted to change Super Admin user ID ${targetUserId}'s role. Super Admin role is protected.`;
    await logAuditEvent(adminUserId, 'change_super_admin_role', targetUserId, details, ipAddress, 'blocked');
    await logActivity(adminUserId, 'super_admin_violation', 'security', details);
    throw new Error('Super Admin role is protected and cannot be changed.');
  }

  // Cannot deactivate/disable the Super Admin
  if (changes.status !== undefined && changes.status !== 'active') {
    const details = `BLOCKED: Attempted to deactivate Super Admin user ID ${targetUserId}. Super Admin account cannot be disabled.`;
    await logAuditEvent(adminUserId, 'deactivate_super_admin', targetUserId, details, ipAddress, 'blocked');
    await logActivity(adminUserId, 'super_admin_violation', 'security', details);
    throw new Error('Super Admin account is protected and cannot be deactivated.');
  }

  // Cannot change Super Admin's department restrictions (they must have no restrictions)
  if (changes.department_id !== undefined || changes.department_ids !== undefined) {
    const details = `BLOCKED: Attempted to change Super Admin user ID ${targetUserId}'s department. Super Admin must not be department-restricted.`;
    await logAuditEvent(adminUserId, 'change_super_admin_department', targetUserId, details, ipAddress, 'blocked');
    await logActivity(adminUserId, 'super_admin_violation', 'security', details);
    throw new Error('Super Admin account must not be restricted by department.');
  }
}

/**
 * Guard: Prevent deleting/deactivating the Super Admin
 * @param {number} targetUserId - The user being deleted/deactivated
 * @param {number} adminUserId - The requesting user's ID
 * @throws {Error} If the target is a Super Admin
 */
async function guardDeleteSuperAdmin(targetUserId, adminUserId, ipAddress) {
  if (await isSuperAdmin(targetUserId)) {
    const details = `BLOCKED: Attempted to delete/deactivate Super Admin user ID ${targetUserId}. Super Admin account is protected.`;
    await logAuditEvent(adminUserId, 'delete_super_admin', targetUserId, details, ipAddress, 'blocked');
    await logActivity(adminUserId, 'super_admin_violation', 'security', details);
    throw new Error('Super Admin account is protected and cannot be deleted.');
  }
}

/**
 * Guard: Prevent resetting the Super Admin's password
 * @param {number} targetUserId - The user whose password is being reset
 * @param {number} adminUserId - The requesting user's ID
 * @throws {Error} If the target is a Super Admin and the requester is not the Super Admin themselves
 */
async function guardResetSuperAdminPassword(targetUserId, adminUserId, ipAddress) {
  if (await isSuperAdmin(targetUserId)) {
    if (parseInt(targetUserId) !== parseInt(adminUserId)) {
      const details = `BLOCKED: Attempted to reset Super Admin user ID ${targetUserId}'s password. Only the Super Admin can change their own password.`;
      await logAuditEvent(adminUserId, 'reset_super_admin_password', targetUserId, details, ipAddress, 'blocked');
      await logActivity(adminUserId, 'super_admin_violation', 'security', details);
      throw new Error('Only the Super Admin can change their own password.');
    }
  }
}

module.exports = {
  getSuperAdminRoleId,
  countActiveSuperAdmins,
  isSuperAdmin,
  isLastActiveSuperAdmin,
  guardCreateSuperAdmin,
  guardUpdateSuperAdmin,
  guardDeleteSuperAdmin,
  guardResetSuperAdminPassword
};
