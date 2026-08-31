// CSV Import Integrity Validation Suite
// Run: node backend/scripts/validate-import.mjs

const BASE = 'http://localhost:5000/api';
let csrfToken = '';
let authToken = '';
let csrfCookie = '';
let passed = 0, failed = 0;
const results = [];

const headers = (extra = {}) => ({
  'Authorization': `Bearer ${authToken}`,
  'X-CSRF-Token': csrfCookie,
  'Cookie': `_csrf=${csrfCookie}`,
  ...extra
});

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json();
  // Grab new CSRF cookie from response headers
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/_csrf=([^;]+)/);
    if (match) csrfCookie = match[1];
  }
  return data;
}

async function main() {
  console.log('\x1b[36m========== CSV IMPORT VALIDATION SUITE ==========\x1b[0m\n');

  // --- Auth ---
  const csrfData = await fetchJSON(`${BASE}/csrf-token`);
  csrfCookie = csrfData.csrfToken;

  const loginData = await fetchJSON(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ email: 'admin@mizero.com', password: 'password123' })
  });
  authToken = loginData.token;
  if (!authToken) { console.error('\x1b[31mLogin failed\x1b[0m'); process.exit(1); }
  console.log('\x1b[32mLogin OK\x1b[0m');

  // Get department
  const depts = await fetchJSON(`${BASE}/departments`, { headers: headers() });
  const dept = depts[0]?.name || 'General Store';
  const dept2 = depts[1]?.name || depts[0]?.name || dept;
  console.log(`Dept: ${dept}\n`);

  // Helper
  async function importCSV(csvContent, params = '') {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const form = new FormData();
    form.append('file', blob, 'test.csv');
    return fetchJSON(`${BASE}/items/import/csv${params}`, {
      method: 'POST',
      headers: headers(),
      body: form
    });
  }

  async function runTest(name, csv, field, expected, params = '') {
    try {
      const result = await importCSV(csv, params);
      const actual = result[field];
      const msg = result.message || '';
      if (actual == expected) {
        console.log(`  \x1b[32mPASS\x1b[0m ${name}`);
        console.log(`     ${msg}`);
        passed++; results.push(`PASS: ${name}`);
      } else {
        console.log(`  \x1b[31mFAIL\x1b[0m ${name}`);
        console.log(`     Expected ${field}=${expected}, got: ${actual}`);
        console.log(`     Response: ${JSON.stringify(result)}`);
        failed++; results.push(`FAIL: ${name}`);
      }
    } catch (e) {
      console.log(`  \x1b[31mFAIL\x1b[0m ${name} (error: ${e.message})`);
      failed++; results.push(`FAIL: ${name}`);
    }
  }

  // ====== TESTS ======

  console.log('\x1b[33m--- TEST 1: New Item ---\x1b[0m');
  await runTest('New item with auto SKU',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_N1,Test,pcs,30,5,consumable,${dept},1000,RWF`,
    'inserted', 1);

  console.log('\x1b[33m--- TEST 2: Consumable Duplicate (auto-merge) ---\x1b[0m');
  await runTest('Create consumable baseline',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Paper,Office,ream,20,10,consumable,${dept},5000,RWF`,
    'inserted', 1);
  await runTest('Re-import consumable merges',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Paper,Office,ream,50,10,consumable,${dept},5500,RWF`,
    'merged', 1);

  console.log('\x1b[33m--- TEST 3: Non-Consumable Duplicate (actions) ---\x1b[0m');
  await runTest('Create non-consumable baseline',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Lap,Electronics,pcs,5,2,non-consumable,${dept},850000,RWF`,
    'inserted', 1);
  await runTest('Non-consumable skip action',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Lap,Electronics,pcs,3,2,non-consumable,${dept},900000,RWF`,
    'nonConsumableSkipped', 1, '?nonConsumableAction=skip');
  await runTest('Non-consumable create action',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Lap,Electronics,pcs,2,2,non-consumable,${dept},900000,RWF`,
    'inserted', 1, '?nonConsumableAction=create');
  await runTest('Non-consumable update action',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Lap,Electronics,pcs,4,2,non-consumable,${dept},950000,RWF`,
    'merged', 1, '?nonConsumableAction=update');

  console.log('\x1b[33m--- TEST 4: Different Departments ---\x1b[0m');
  await runTest('Same name different dept = new item',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Chair,Furniture,pcs,10,2,non-consumable,${dept2},150000,RWF`,
    'inserted', 1);

  console.log('\x1b[33m--- TEST 5: Soft-Delete Restore ---\x1b[0m');
  const ir = await importCSV(
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Printer,Electronics,pcs,3,1,non-consumable,${dept},300000,RWF`);
  if (ir.inserted === 1) {
    const items = await fetchJSON(`${BASE}/items?limit=200`, { headers: headers() });
    const item = (items.items || []).find(i => i.name === 'ValTest_Printer');
    if (item) {
      await fetchJSON(`${BASE}/items/${item.id}`, {
        method: 'DELETE',
        headers: headers()
      });
      await runTest('Re-import soft-deleted restores',
        `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Printer,Electronics,pcs,7,1,non-consumable,${dept},320000,RWF`,
        'restored', 1);
    } else console.log('  \x1b[33mSkip restore: item not found\x1b[0m');
  } else console.log('  \x1b[33mSkip restore: insert failed\x1b[0m');

  console.log('\x1b[33m--- TEST 6: Case-Insensitive Matching ---\x1b[0m');
  await runTest('UPPERCASE item creates',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nVALTEST_CASE_TEST,Test,pcs,10,2,consumable,${dept},2000,RWF`,
    'inserted', 1);
  await runTest('lowercase re-import merges',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nvaltest_case_test,Test,pcs,5,2,consumable,${dept},2000,RWF`,
    'merged', 1);

  console.log('\x1b[33m--- TEST 7: Spacing Normalization ---\x1b[0m');
  await runTest('Normal spacing creates',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest TrimCheck,Test,pcs,8,2,consumable,${dept},3000,RWF`,
    'inserted', 1);
  await runTest('Extra spaces merges (sanitizer trims)',
    `name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\n  ValTest TrimCheck  ,Test,pcs,3,2,consumable,${dept},3000,RWF`,
    'merged', 1);

  // Preview test
  console.log('\x1b[33m--- Preview Test ---\x1b[0m');
  const blob = new Blob([`name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Prev,Test,pcs,10,2,consumable,${dept},1000,RWF`], { type: 'text/csv' });
  const form = new FormData();
  form.append('file', blob, 'preview.csv');
  const preview = await fetchJSON(`${BASE}/items/import/csv/preview`, {
    method: 'POST',
    headers: headers(),
    body: form
  });
  if (preview.predictedConsumableMerge !== undefined && preview.skuAutoGenerated === true) {
    console.log('  \x1b[32mPASS\x1b[0m Preview has predictions + skuAutoGenerated');
    passed++; results.push('PASS: Preview');
  } else {
    console.log(`  \x1b[31mFAIL\x1b[0m Preview: ${JSON.stringify(preview)}`);
    failed++; results.push('FAIL: Preview');
  }

  // ====== SUMMARY ======
  console.log(`\n\x1b[36m========== RESULTS ==========\x1b[0m`);
  console.log(`  \x1b[32mPassed: ${passed}\x1b[0m   \x1b[31mFailed: ${failed}\x1b[0m`);
  for (const r of results) {
    if (r.startsWith('PASS:')) console.log(`  \x1b[32m*\x1b[0m ${r.slice(5)}`);
    else console.log(`  \x1b[31m*\x1b[0m ${r.slice(5)}`);
  }
  if (failed === 0) console.log(`\x1b[32mALL PASSED\x1b[0m`);
  else console.log(`\x1b[31m${failed} FAILED\x1b[0m`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
