/**
 * Smart Seed Script
 *
 * Populates the database with sample data without failing on existing records.
 * Uses INSERT IGNORE / ON DUPLICATE KEY UPDATE for all inserts.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const DB = process.env.DB_NAME || 'mizero_inventory';
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

let conn;

async function main() {
  conn = await mysql.createConnection(config);
  await conn.query(`USE \`${DB}\``);
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  const seedLog = [];

  // ---- 1. Clean up test/CSRF departments ----
  console.log('🧹 Cleaning up test departments...');
  const [testDepts] = await conn.query(
    "SELECT id FROM departments WHERE name LIKE 'CSRF-Test%'"
  );
  for (const d of testDepts) {
    // Remove user_department associations
    await conn.query('DELETE FROM user_departments WHERE department_id = ?', [d.id]);
    // Remove item associations
    await conn.query('UPDATE items SET department_id = NULL WHERE department_id = ?', [d.id]);
    await conn.query('DELETE FROM departments WHERE id = ?', [d.id]);
    console.log(`  ✗ Removed test department ID ${d.id}`);
  }
  seedLog.push(`Cleaned ${testDepts.length} test department(s)`);

  // ---- 2. Upsert departments ----
  console.log('\n📦 Seeding departments...');
  const departments = [
    ['General Store', 'Main inventory storage'],
    ['IT Department', 'Information technology equipment'],
    ['Human Resources', 'HR department supplies'],
    ['Finance', 'Finance department'],
    ['Operations', 'Operations and logistics']
  ];
  for (const [name, desc] of departments) {
    await conn.query(
      `INSERT INTO departments (name, description)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [name, desc]
    );
  }
  console.log('  ✅ 5 departments upserted');
  seedLog.push('5 departments upserted');

  // ---- 3. Get department IDs (they may have changed) ----
  const [deptRows] = await conn.query('SELECT id, name FROM departments WHERE name IN (?,?,?,?,?)',
    ['General Store', 'IT Department', 'Human Resources', 'Finance', 'Operations']);
  const deptMap = {};
  deptRows.forEach(d => { deptMap[d.name] = d.id; });

  // ---- 4. Upsert users ----
  console.log('\n👤 Seeding users...');
  const bcryptHash = '$2a$12$cpRzUxtYqwC6s1pFJ/zXOuJQgl35veyz6ZNIna9auydN7.J3dL3Im';
  const users = [
    ['Super Admin',   'admin@mizero.com',  bcryptHash, 1, null],
    ['John Stock Manager', 'john@mizero.com', bcryptHash, 3, deptMap['IT Department']],
    ['Sarah Stock',   'stock@mizero.com', bcryptHash, 3, deptMap['General Store']],
    ['Mike Staff',    'staff@mizero.com', bcryptHash, 4, deptMap['Human Resources']]
  ];
  for (const [fullName, email, password, roleId, deptId] of users) {
    await conn.query(
      `INSERT INTO users (full_name, email, password, role_id, department_id, status, must_change_password)
       VALUES (?, ?, ?, ?, ?, 'active', 0)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role_id = VALUES(role_id),
                               department_id = VALUES(department_id), must_change_password = 0`,
      [fullName, email, password, roleId, deptId]
    );
  }
  console.log('  ✅ 4 users upserted');
  seedLog.push('4 users upserted');

  // Get user IDs
  const [userRows] = await conn.query(
    'SELECT id, email FROM users WHERE email IN (?,?,?,?)',
    ['admin@mizero.com', 'john@mizero.com', 'stock@mizero.com', 'staff@mizero.com']
  );
  const userMap = {};
  userRows.forEach(u => { userMap[u.email] = u.id; });

  // ---- 5. Update department managers ----
  await conn.query('UPDATE departments SET manager_id = ? WHERE id = ?', [
    userMap['stock@mizero.com'], deptMap['IT Department']
  ]);
  await conn.query('UPDATE departments SET manager_id = ? WHERE id = ?', [
    userMap['stock@mizero.com'], deptMap['General Store']
  ]);
  console.log('  ✅ Department managers assigned');

  // ---- 6. Upsert user_departments ----
  const userDeptPairs = [
    [userMap['john@mizero.com'], deptMap['IT Department']],
    [userMap['stock@mizero.com'], deptMap['General Store']],
    [userMap['staff@mizero.com'], deptMap['Human Resources']]
  ];
  for (const [userId, deptId] of userDeptPairs) {
    await conn.query(
      'INSERT IGNORE INTO user_departments (user_id, department_id) VALUES (?, ?)',
      [userId, deptId]
    );
  }
  console.log('  ✅ User-department associations created');

  // ---- 7. Upsert items ----
  console.log('\n📦 Seeding items...');
  const items = [
    ['INV-A001-0001', 'Office Paper A4', 'Standard A4 copy paper 80gsm', 'Office Supplies', 'ream', 150, 20, 'consumable', deptMap['Human Resources'], userMap['admin@mizero.com']],
    ['INV-A001-0002', 'Ballpoint Pens Blue', 'Blue ink ballpoint pens box of 50', 'Office Supplies', 'box', 80, 10, 'consumable', deptMap['Human Resources'], userMap['admin@mizero.com']],
    ['INV-B002-0001', 'Dell Laptop Latitude 3420', 'Business laptop 8GB RAM 256GB SSD', 'Electronics', 'pcs', 15, 5, 'non-consumable', deptMap['IT Department'], userMap['admin@mizero.com']],
    ['INV-B002-0002', 'HP LaserJet Printer', 'Monochrome laser printer', 'Electronics', 'pcs', 8, 2, 'non-consumable', deptMap['IT Department'], userMap['admin@mizero.com']],
    ['INV-C003-0001', 'Cleaning Detergent 5L', 'Multi-surface cleaning detergent', 'Cleaning', 'bottle', 40, 10, 'consumable', deptMap['Operations'], userMap['admin@mizero.com']],
    ['INV-C003-0002', 'Paper Towels', 'Industrial paper towel rolls', 'Cleaning', 'roll', 200, 30, 'consumable', deptMap['Operations'], userMap['admin@mizero.com']],
    ['INV-D004-0001', 'Office Chair', 'Ergonomic office chair', 'Furniture', 'pcs', 25, 5, 'non-consumable', deptMap['General Store'], userMap['admin@mizero.com']],
    ['INV-D004-0002', 'Whiteboard 120x90cm', 'Magnetic whiteboard with markers', 'Furniture', 'pcs', 12, 3, 'non-consumable', deptMap['General Store'], userMap['admin@mizero.com']]
  ];
  for (const [sku, name, desc, category, unit, qty, minStock, type, deptId, createdBy] of items) {
    await conn.query(
      `INSERT INTO items (sku, name, description, category, unit, quantity, minimum_stock, item_type, department_id, created_by, unit_cost, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'RWF')
       ON DUPLICATE KEY UPDATE name = VALUES(name), quantity = VALUES(quantity), minimum_stock = VALUES(minimum_stock)`,
      [sku, name, desc, category, unit, qty, minStock, type, deptId, createdBy]
    );
  }
  console.log('  ✅ 8 items upserted');
  seedLog.push('8 items upserted');

  // ---- 8. Get item IDs for FK references ----
  const [itemRows] = await conn.query('SELECT id, sku FROM items WHERE sku IN (?,?,?,?,?,?,?,?)',
    items.map(i => i[0]));
  const itemMap = {};
  itemRows.forEach(i => { itemMap[i.sku] = i.id; });

  // ---- 9. Insert sample stock_in (clear old ones first) ----
  console.log('\n📦 Seeding stock_in records...');
  await conn.query('DELETE FROM stock_in');
  const stockInData = [
    [itemMap['INV-A001-0001'], 200, 12000, 'OfficeMax Supplies', 'PO-2024-001', 'Monthly office supplies order', '2024-01-15', userMap['admin@mizero.com']],
    [itemMap['INV-A001-0002'], 100, 5000, 'OfficeMax Supplies', 'PO-2024-001', 'Monthly office supplies order', '2024-01-15', userMap['admin@mizero.com']],
    [itemMap['INV-B002-0001'], 20, 850000, 'Dell Technologies', 'PO-2024-002', 'Q1 hardware procurement', '2024-01-20', userMap['admin@mizero.com']],
    [itemMap['INV-B002-0002'], 10, 350000, 'HP Direct', 'PO-2024-003', 'Printer replacement program', '2024-01-25', userMap['admin@mizero.com']]
  ];
  for (const [itemId, qty, unitPrice, supplier, ref, notes, date, createdBy] of stockInData) {
    await conn.query(
      `INSERT INTO stock_in (item_id, quantity, unit_price, supplier, reference_number, notes, date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, qty, unitPrice, supplier, ref, notes, date, createdBy]
    );
  }
  console.log('  ✅ 4 stock_in records inserted (with prices)');
  seedLog.push('4 stock_in records (with prices)');

  // ---- 10. Insert sample stock_out (with cost snapshot from items) ----
  console.log('\n📦 Seeding stock_out records...');
  await conn.query('DELETE FROM stock_out');
  // Get unit_cost from items for COGS tracking
  const [itemCosts2] = await conn.query('SELECT id, unit_cost, sku FROM items');
  const costMap2 = {};
  itemCosts2.forEach(i => { costMap2[i.sku] = i.unit_cost; });
  const stockOutData = [
    ['INV-A001-0001', 30, 'HR Department', 'Human Resources', 'Monthly usage', '2024-02-01', userMap['stock@mizero.com'], costMap2['INV-A001-0001'] || 12000],
    ['INV-A001-0002', 15, 'Finance Team', 'Finance', 'Office supplies', '2024-02-01', userMap['stock@mizero.com'], costMap2['INV-A001-0002'] || 5000],
    ['INV-B002-0001', 3, 'Alice Johnson', 'IT Department', 'New employee setup', '2024-02-05', userMap['stock@mizero.com'], costMap2['INV-B002-0001'] || 850000]
  ];
  for (const [sku, qty, recipient, dept, reason, date, createdBy, unitCost] of stockOutData) {
    await conn.query(
      `INSERT INTO stock_out (item_id, quantity, unit_cost_at_time, recipient, department, reason, date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemMap[sku], qty, unitCost, recipient, dept, reason, date, createdBy]
    );
  }
  console.log('  ✅ 3 stock_out records inserted (with COGS snapshot)');
  seedLog.push('3 stock_out records (with COGS snapshot)');

  // ---- 11. Insert sample borrowings ----
  console.log('\n📦 Seeding borrowings...');
  await conn.query('DELETE FROM borrowings');
  // Get unit_cost from items for realistic replacement values
  const [itemCosts] = await conn.query('SELECT id, unit_cost FROM items WHERE id IN (?, ?)',
    [itemMap['INV-B002-0001'], itemMap['INV-B002-0002']]);
  const costMap = {};
  itemCosts.forEach(i => { costMap[i.id] = i.unit_cost; });
  const borrowingData = [
    [itemMap['INV-B002-0001'], 'Bob Williams', '+250788123456', 1, '2024-02-10', '2024-02-24', 'borrowed', userMap['stock@mizero.com'], costMap[itemMap['INV-B002-0001']] || 0],
    [itemMap['INV-B002-0002'], 'Carol Davis', '+250788654321', 1, '2024-02-12', '2024-02-26', 'borrowed', userMap['stock@mizero.com'], costMap[itemMap['INV-B002-0002']] || 0]
  ];
  for (const [itemId, name, phone, qty, borrowDate, dueDate, status, createdBy, unitCost] of borrowingData) {
    await conn.query(
      `INSERT INTO borrowings (item_id, borrower_name, borrower_phone, quantity, borrow_date, due_date, status, created_by, unit_cost_at_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, name, phone, qty, borrowDate, dueDate, status, createdBy, unitCost]
    );
  }
  console.log('  ✅ 2 borrowings inserted (with replacement values)');
  seedLog.push('2 borrowings (with replacement values)');

  // ---- 12. Insert sample requests ----
  console.log('\n📦 Seeding requests...');
  await conn.query('DELETE FROM requests');
  const requestData = [
    [userMap['staff@mizero.com'], itemMap['INV-A001-0001'], 10, 'Need paper for monthly reports', 'pending'],
    [userMap['staff@mizero.com'], itemMap['INV-A001-0002'], 5, 'Office pens running low', 'approved'],
    [userMap['staff@mizero.com'], itemMap['INV-B002-0001'], 1, 'Need laptop for new intern', 'pending']
  ];
  for (const [requesterId, itemId, qty, justification, status] of requestData) {
    await conn.query(
      `INSERT INTO requests (requester_id, item_id, quantity, justification, status)
       VALUES (?, ?, ?, ?, ?)`,
      [requesterId, itemId, qty, justification, status]
    );
  }
  console.log('  ✅ 3 requests inserted');
  seedLog.push('3 requests');

  // ---- 13. Insert sample notifications ----
  console.log('\n📦 Seeding notifications...');
  await conn.query('DELETE FROM notifications');
  // Capture the first request's actual ID for the notification reference
  const [firstRequest] = await conn.query('SELECT id FROM requests ORDER BY id LIMIT 1');
  const requestRefId = firstRequest.length > 0 ? firstRequest[0].id : null;
  const notifData = [
    [userMap['admin@mizero.com'], 'Welcome to Mizero Hub', 'Your inventory management system is ready to use.', 'system', null],
    [userMap['john@mizero.com'], 'Low Stock Alert', 'Item Dell Laptop Latitude 3420 has low stock.', 'inventory', itemMap['INV-B002-0001']],
    [userMap['stock@mizero.com'], 'New Request', 'Mike Staff requested 10 of Office Paper A4', 'requests', requestRefId]
  ];
  for (const [userId, title, msg, module, refId] of notifData) {
    await conn.query(
      `INSERT INTO notifications (user_id, title, message, module, reference_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, msg, module, refId]
    );
  }
  console.log('  ✅ 3 notifications inserted');
  seedLog.push('3 notifications');

  // ---- 13b. Clear old activity logs and insert fresh ones ----
  console.log('\n📦 Seeding activity logs...');
  // Keep system reset but add our seed activities
  await conn.query("DELETE FROM activity_logs WHERE action != 'system_reset'");
  const activityData = [
    [userMap['admin@mizero.com'], 'login', 'auth', 'Super Admin logged in'],
    [userMap['admin@mizero.com'], 'create', 'inventory', 'Created sample inventory items'],
    [userMap['stock@mizero.com'], 'stock_in', 'inventory', 'Stock in: 200 reams of Office Paper A4'],
    [userMap['stock@mizero.com'], 'stock_out', 'inventory', 'Stock out: 30 reams to HR Department']
  ];
  for (const [userId, action, module, desc] of activityData) {
    await conn.query(
      `INSERT INTO activity_logs (user_id, action, module, description) VALUES (?, ?, ?, ?)`,
      [userId, action, module, desc]
    );
  }
  console.log('  ✅ 4 activity logs inserted');
  seedLog.push('4 activity logs');

  // ---- 14. Update item quantities AND unit_cost to reflect transactions ----
  console.log('\n📦 Updating item quantities and unit_cost to reflect transactions...');
  // Items start with base quantities. stock_in adds, stock_out subtracts.
  // We update items to show the FINAL quantities after all seed transactions.
  // Also update unit_cost to match the stock_in prices for realistic demo data.
  const itemUpdates = [
    ['INV-A001-0001', 320, 12000],   // Paper:   150 + 200 - 30 = 320 @ 12,000 RWF
    ['INV-A001-0002', 165, 5000],    // Pens:     80 + 100 - 15 = 165 @ 5,000 RWF
    ['INV-B002-0001', 32, 850000],   // Laptop:   15 + 20 - 3  = 32  @ 850,000 RWF
    ['INV-B002-0002', 18, 350000],   // Printer:   8 + 10      = 18  @ 350,000 RWF
  ];
  for (const [sku, qty, cost] of itemUpdates) {
    await conn.query('UPDATE items SET quantity = ?, unit_cost = ? WHERE sku = ?', [qty, cost, sku]);
  }
  console.log('  ✅ Item quantities and unit_cost updated to reflect transactions');

  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n═══════════════════════════════════════');
  console.log('✅ Seed complete!');
  console.log('───────────────────────────────────────');
  seedLog.forEach(s => console.log(`  • ${s}`));
  console.log('═══════════════════════════════════════');

  await conn.end();
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
