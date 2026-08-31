# MIZERO INVENTORY HUB
## Complete System Blueprint & Software Requirements Specification

---

**Document Version:** 1.1  
**Last Updated:** June 14, 2026  
**System Name:** Mizero Inventory Hub  
**System Type:** Web-Based Inventory Management System  
**Database:** MySQL 8+  
**Backend:** Node.js / Express.js  
**Frontend:** React 18 / Vite / Tailwind CSS  
**Authentication:** JWT (JSON Web Tokens)  
**PDF Generation:** PDFKit  
**Charts:** Chart.js with react-chartjs-2  
**Validation:** express-validator  
**CSV:** csv-parse / csv-stringify  
**Rate Limiting:** express-rate-limit  
**File Upload:** multer  

---

# 1. EXECUTIVE SUMMARY

## What the System Is

Mizero Inventory Hub is a comprehensive, web-based inventory management platform that enables organizations to track, manage, and control their entire inventory lifecycle. It provides complete visibility over stock levels, asset borrowing, stock requests, financial valuation, damage tracking, budget management, database backup, and reporting.

## Why It Exists

Organizations—especially in emerging markets—face critical challenges with manual inventory tracking: lost assets, unauthorized stock usage, inability to track borrowed items, lack of financial visibility, and no audit trail. Mizero Inventory Hub solves these problems with a structured, permission-based digital system.

## Who Uses It

| Role | Typical User |
|------|-------------|
| Super Admin | System owner / IT Director |
| Admin | Operations Manager |
| Stock Manager | Warehouse / Storekeeper |
| Staff | Department employees requesting supplies |

## Business Problems Solved

1. **Loss of Assets:** Borrowing module with due dates, overdue detection, damage (50%) and loss (100%) liability tracking with partial payments
2. **Stock Theft/Leakage:** Complete audit trail of every stock movement with user attribution
3. **Budget Overspend:** Department budget tracking with consumption monitoring
4. **No Inventory Visibility:** Real-time dashboard with low stock alerts and financial KPIs
5. **Paper-based Requests:** Digital request → approval → allocation workflow with partial allocation support
6. **No Financial Data:** Weighted Average Cost (AVCO) valuation, COGS tracking, margin analysis
7. **No Accountability:** Activity logging for every action with user, timestamp, and IP address
8. **Data Loss Risk:** One-click full database SQL backup with auto-discovery of all tables

## Expected Benefits

- 100% inventory accuracy with real-time tracking
- Reduced asset loss through borrowing accountability and liability enforcement
- Budget control with department-level spending visibility
- Complete audit trail for compliance
- Data-driven procurement decisions via reports and analytics
- Reduced paperwork and manual errors
- CSV import/export for bulk operations
- Safe database backup/restore capability

---

# 2. USER ROLES

## 2.1 Super Admin

**Description:** The highest-privilege user with unrestricted system access. There can only be ONE active Super Admin in the system.

**Responsibilities:** Full system administration, user management, department management, budget management, all inventory operations, database backup, system configuration

**Permissions:**
- Access to ALL modules and ALL data
- Create/update/delete users
- Create/update/delete departments (including delete)
- Create/update budgets
- All stock operations (in/out/adjustments)
- All borrowing and return operations
- All request management
- Dashboard, analytics, and all reports
- Activity logs (view + cleanup)
- Notifications (view + cleanup)
- CSV import/export/template download
- **Database backup (one-click SQL export)**

**Restrictions:**
- Cannot be deleted or deactivated by any other user
- Role cannot be changed
- Department cannot be restricted
- Password can only be changed by the Super Admin themselves
- Only one Super Admin account permitted in the system at any time

**Accessible Modules:** All 19 modules (including Database Backup)

## 2.2 Admin

**Description:** Second-tier administrator who manages users, departments, and full inventory operations but cannot access Super Admin protections or database backup.

**Responsibilities:** User management (except Super Admin), department management, full inventory management, budget management, report generation

**Permissions:**
- All inventory operations
- User CRUD (cannot modify Super Admin)
- Department CRUD
- Budget CRUD
- All stock operations
- All borrowing/return operations
- Request review and allocation
- All 10 report types
- Activity log viewing + cleanup
- Notification management + cleanup
- CSV import/export
- Damage liabilities (record payments, waive)
- Overdue checking

**Restrictions:**
- Cannot create another Super Admin
- Cannot modify or deactivate Super Admin
- Cannot delete own account
- Cannot access database backup
- Cannot delete departments (super_admin only)

## 2.3 Stock Manager

**Description:** Operational user focused on day-to-day inventory operations. Scoped to specific departments.

**Responsibilities:** Inventory item management within assigned departments, stock in/out/adjustments, borrowing/return management, leftover returns, damage/liability recording, request review, report generation, CSV import

**Permissions:**
- View/create/edit items within assigned departments
- Stock in (create, view)
- Stock out (create, view)
- Stock adjustments (create, view)
- Borrowings (create, view)
- Returns (create, view)
- Request review (approve/reject/allocate)
- Leftover returns (create, view)
- Damage liabilities (record, view, record payments)
- Dashboard (scoped to departments)
- Reports (all 10 types)
- Activity logs (view)
- **CSV import (preview + execute)**
- **CSV export + template download**

**Restrictions:**
- Can only see items/stock movements within assigned department(s)
- Cannot manage users
- Cannot manage departments
- Cannot manage budgets
- Cannot delete items
- Cannot waive liabilities
- Cannot cleanup logs or notifications

## 2.4 Staff

**Description:** Non-inventory users who can view inventory (read-only, without quantities/costs) and create stock requests.

**Responsibilities:** Create stock requests with justification, view own requests and their status, view own notifications, view items (read-only, no quantities)

**Permissions:**
- Create requests
- Cancel own pending requests
- View own requests
- View their profile
- View notifications
- View dashboard cards (limited)
- View items (read-only, **quantities/costs hidden**)

**Restrictions:**
- Cannot perform stock in/out
- Cannot adjust stock
- Cannot create/edit items
- Cannot manage borrowings/returns
- Cannot review requests
- Cannot access reports
- Cannot manage users or departments
- Cannot access activity logs
- **Cannot see item quantities or costs** (fields are stripped from API responses)

---

# 3. SYSTEM MODULES

## 3.1 Authentication Module

**Purpose:** Secure user login, session management, and profile management.

**Features:**
- Email/password authentication with bcrypt password hashing (12 rounds)
- JWT token generation (configurable expiry, default 24 hours)
- Token-based authorization for all API endpoints
- Login rate limiting (10 attempts per 15 minutes per IP)
- Password change (requires current password verification)
- Password reset (admin-initiated, protected for Super Admin)
- Profile update (name, email)
- Auto-logout on token expiry
- Inactive account detection and access denial

**Screens:** Login page (public), Profile page (protected)

**Inputs:** Email, password | Current password, new password (change) | User ID, new password (reset) | Full name, email (profile update)

**Outputs:** JWT token | User object (id, name, email, role, departments) | Success/error messages

**Validations:**
- Password strength: 8+ chars, 1 uppercase, 1 number, 1 special character
- Email must be valid format
- Current password must match for password change
- Email uniqueness check on profile update
- Inactive users cannot log in

**Permissions:** Login: All active users | Profile/Password: All authenticated | Password reset: super_admin, admin (except Super Admin target)

## 3.2 Dashboard Module

**Purpose:** Provide real-time operational overview of the entire inventory system with financial KPIs.

**Features:**
- Summary statistics cards (6 core metrics)
- Stock movement chart (7-day in vs out)
- Inventory by category chart (doughnut)
- Recent activity feed (last 10 actions)
- Department summary with values
- Financial KPIs: COGS, gross margin, revenue, inventory value
- Liability metrics: outstanding, damage cases, loss cases
- Budget summary: total vs used for current fiscal year

**Screens:** Dashboard (route: `/dashboard`)

**Metrics Returned (20+):**
| Metric | Calculation |
|--------|------------|
| Total Items | `COUNT(*) FROM items WHERE deleted_at IS NULL` |
| Total Stock Quantity | `SUM(quantity) FROM items WHERE deleted_at IS NULL` |
| Total Inventory Value | `SUM(quantity * unit_cost) FROM items` |
| Low Stock Items | `COUNT WHERE quantity <= minimum_stock AND deleted_at IS NULL` |
| Borrowed Items | `COUNT WHERE status = 'borrowed'` |
| Pending Requests | `COUNT WHERE status = 'pending'` |
| COGS This Month | `SUM(quantity * unit_cost_at_time) FROM stock_out WHERE month=current` |
| Gross Margin | `SUM(quantity * (selling_price_at_time - unit_cost_at_time)) WHERE selling_price > 0` |
| Revenue | `SUM(quantity * selling_price_at_time) WHERE selling_price > 0` |
| Stock In Value (Month) | `SUM(total_cost) FROM stock_in WHERE month=current` |
| Borrowed Asset Value | `SUM(total_replacement_value) FROM borrowings WHERE status='borrowed'` |
| Damaged Item Cost | `SUM(replacement_cost) FROM damage_liabilities WHERE liability_type='damaged'` |
| Lost Item Cost | `SUM(replacement_cost) FROM damage_liabilities WHERE liability_type='lost'` |
| Adjustment Costs (Month) | Decrease/increase totals from stock_adjustments |
| Total Budget | `SUM(total_budget) FROM budgets WHERE fiscal_year = current` |
| Total Budget Used | Stock out costs by department for current year |
| Outstanding Liabilities | Value + count of unpaid/partially_paid liabilities |
| Total Liability Paid | Sum of all paid liability amounts |
| Damage Cases | Count of pending unpaid damaged liabilities |
| Loss Cases | Count of pending unpaid lost liabilities |

**Charts:** Bar (7-day stock in/out grouped by date) | Doughnut (inventory by category)

## 3.3 Inventory Management Module

**Purpose:** Core module for managing inventory items - their creation, editing, categorization, and lifecycle management.

**Features:**
- Item CRUD with soft-delete
- Auto-generated unique SKU
- Category management (distinct from database)
- Item types: consumable vs. non-consumable
- Image upload per item (single image, multer, 5MB limit, jpg/png/gif/webp)
- Low stock alerts
- Currency support (RWF, USD, EUR)
- Unit cost and selling price tracking
- **CSV import with 2 strategies (skip/update) and row-level validation**
- **CSV export with department/category filters**
- **CSV template download with auto-filled department names**
- Department assignment (required)

**Screens:** Inventory List (route: `/inventory`), Add/Edit Item Modal, **CSV Import Modal (3-step: upload → preview → result)**

**Inputs:** name*, SKU (auto-generated or CSV-supplied), description, category, unit*, quantity, minimum_stock, unit_cost, selling_price, currency, item_type*, department_id*, image (file)

**Business Rules:**
- **SKU Generation:** `INV-{base36Timestamp}-{random4Chars}` (e.g., `INV-XZ3K9-M7XQ`)
- **Quantity is NOT editable** via item update — all quantity changes go through stock-in, stock-out, or adjustments
- **Soft Delete:** Items soft-deleted via `deleted_at` timestamp — preserves historical JOINs
- Unit cost is auto-calculated via AVCO on stock-in, not manually set
- Low stock notification sent when quantity ≤ minimum_stock

**CSV Import:**
- **Preview endpoint:** Validates all rows without importing, returns per-row errors
- **Import endpoint:** Transaction-safe (all-or-nothing), 2 strategies:
  - `skip`: Rows with existing DB SKUs are skipped
  - `update`: Rows with existing DB SKUs are updated with CSV data
- **Validation:** Required fields, SKU uniqueness, department name lookup, numeric ranges, currency (RWF/USD/EUR), item type (consumable/non-consumable)
- **Limits:** 10MB file size, 5000 rows max
- **Department lookup:** by **name** (not numeric ID)

**Permissions:** super_admin, admin, stock_manager: Full CRUD + CSV ops | staff: View only (quantities/costs hidden)

## 3.4 Stock In Module

**Purpose:** Record incoming stock additions to inventory with purchase price and supplier details.

**Features:**
- Record stock receipt with quantity and unit price
- Supplier tracking (name and type)
- Reference number (PO number)
- Date tracking (can be backdated)
- Department assignment
- **AVCO recalculation on every stock-in**
- Low stock alert trigger
- Receipt detail endpoint

**Screens:** Stock In List (route: `/stock-in`), Add Stock In Modal

**Inputs:** item_id*, quantity*, unit_price*, supplier, supplier_type, reference_number, notes, date, department_id

**Business Rules:**
- **AVCO Recalculation:**
  ```
  new_avg_cost = ((current_qty * current_unit_cost) + (incoming_qty * unit_price))
                 / (current_qty + incoming_qty)
  ```
  Implemented via SQL: `SUM(quantity * unit_price) / SUM(quantity)` grouped by item_id
- Item quantity increased by stock-in quantity
- `total_cost = quantity * unit_price` (generated column)
- Low stock alert triggered after update if applicable

**Permissions:** super_admin, admin, stock_manager: Create and view (department-scoped) | staff: No access

## 3.5 Stock Out Module

**Purpose:** Record outgoing stock distribution to departments, projects, or individuals.

**Features:**
- Record stock issuance with recipient details
- Department and reason tracking
- **COGS snapshot at time of issuance**
- **Gross margin calculation** (if selling price is set)
- Leftover tracking (remaining quantity after returns)
- Insufficient stock validation
- Receipt detail endpoint

**Screens:** Stock Out List (route: `/stock-out`), Add Stock Out Modal

**Inputs:** item_id*, quantity*, recipient*, department, reason, date

**Business Rules:**
- **CRITICAL:** Current `unit_cost` and `selling_price` are **snapshotted** into `unit_cost_at_time` and `selling_price_at_time` on the stock_out record at creation time
- Item quantity decreased by stock-out quantity
- `total_cost = quantity * unit_cost_at_time` (generated column)
- `gross_margin = selling_price_at_time - unit_cost_at_time` (generated column)
- `gross_margin_pct = (margin / selling_price) * 100` (generated, when selling_price > 0)
- Insufficient stock: `items[0].quantity < quantity` → reject with available/requested

**Permissions:** super_admin, admin, stock_manager: Create and view (department-scoped) | staff: No access

## 3.6 Stock Adjustments Module

**Purpose:** Correct inventory quantities due to damage, loss, discovery of surplus, counting errors, or other events not involving purchase or issuance.

**Features:**
- Increase or decrease adjustments
- Reason and notes tracking
- Cost impact snapshot at adjustment time
- Low stock alert on decrease

**Screens:** Adjustments List (route: `/adjustments`), Add Adjustment Modal

**Inputs:** item_id*, adjustment_type* (increase/decrease), quantity*, reason*, notes

**Business Rules:**
- **AVCO is NOT recalculated on adjustments** — only stock-in updates weighted average cost
- Decrease cannot exceed available stock: `items[0].quantity < quantity` → reject
- `unit_cost_at_time` is snapshotted from current item unit_cost
- `total_cost = quantity * unit_cost_at_time` (generated column)
- Low stock alert triggered after decrease if applicable

**Permissions:** super_admin, admin, stock_manager: Create and view | staff: No access

## 3.7 Borrowings Module

**Purpose:** Track non-consumable items that are temporarily borrowed by staff or external parties with due dates and accountability.

**Features:**
- Record borrowing of non-consumable items only
- Borrower contact information (name, phone)
- Due date enforcement
- Overdue auto-detection (manual trigger: `POST /check-overdue`)
- Remaining quantity tracking (JOIN with returns + damage_liabilities)
- Replacement value tracking
- Overdue block: borrower with overdue items cannot borrow again
- Receipt detail endpoint

**Screens:** Borrowings List (route: `/borrowings`), Add Borrowing Modal

**Inputs:** item_id*, borrower_name*, borrower_phone, quantity*, borrow_date*, due_date*

**Business Rules:**
- **Only non-consumable items** can be borrowed (query filter: `item_type = 'non-consumable'`)
- Item quantity DECREASED by borrowed amount at creation
- Overdue check: `COUNT overdue borrowings for borrower_name > 0` → block new borrows
- Replacement value = `quantity * unit_cost_at_time` (generated column)
- Status transitions: `borrowed` → `returned` (via returns) | `overdue` (via check-overdue) | `damaged`/`lost` (via damage_liabilities)
- Overdue detection: `UPDATE borrowings SET status = 'overdue' WHERE status = 'borrowed' AND due_date < CURDATE()`

**Permissions:** super_admin, admin, stock_manager: Create and view | staff: No access

## 3.8 Returns Module

**Purpose:** Record the return of borrowed items in good condition, updating inventory.

**Features:**
- Record item returns from borrowings (good condition only)
- Partial returns supported
- Auto status update on full return
- Double-counting prevention (checks both returns AND damage_liabilities)
- Value tracking from original borrowing

**Screens:** Returns List (route: `/returns`), Add Return Modal

**Inputs:** borrowing_id*, returned_quantity*, notes, return_date

**Business Rules:**
- **Damaged/Lost items are BLOCKED** — must use Damage Liabilities endpoint
- Double-counting prevention: Checks BOTH `returns` table SUM AND `damage_liabilities` SUM for the borrowing
- `already_accounted + returned_quantity > borrowing.quantity` → reject
- Good condition: item quantity INCREASES by returned amount
- Borrowing auto-status: if `totalReturned >= borrowed qty`, status → `returned`
- `unit_cost_at_time` copied from original borrowing

**Permissions:** super_admin, admin, stock_manager: Create and view | staff: No access

## 3.9 Stock Requests Module

**Purpose:** Allow staff to request stock items with manager review/approval workflow and state machine enforcement.

**Features:**
- Request creation by staff with justification
- Manager review: approve, reject, allocate (with partial quantity)
- State machine with valid transitions
- Auto stock-out on allocation
- Auto notification to managers on new request
- Auto notification to requester on review
- Request cancellation (by requester or admin/manager)
- Receipt detail endpoint

**Screens:** Requests List (route: `/requests`), Create Request Modal, Review Modal

**Inputs:** item_id*, quantity*, justification (create) | status* (approved/rejected/allocated), allocated_quantity, notes (review)

**Business Rules:**
- **Status State Machine:**
  ```
  pending → approved, rejected, allocated (initial)
  approved → allocated
  rejected → (terminal)
  allocated → (terminal)
  ```
- Invalid transitions rejected with current/requested status and allowed transitions
- **Allocation:** Creates a stock_out record, decreases item quantity
- Partial allocation: quantity between 1 and requested
- Allocation validates available stock before proceeding
- Staff can only see their own requests (SQL filter: `requester_id = req.user.id`)
- Cancellation only allowed for pending requests

**Permissions:** super_admin, admin, stock_manager: View all, review | staff: Create, cancel own, view own

## 3.10 Leftovers Module

**Purpose:** Track unused stock that was previously issued (via stock-out) and is now being returned to inventory.

**Features:**
- Record return of unused/leftover stock from issued quantities
- Two-tier validation (single return + cumulative returns)
- Inventory credit-back
- Value tracking from original stock-out COGS

**Screens:** Leftovers List (route: `/leftovers`), Add Leftover Return Modal

**Inputs:** stock_out_id*, returned_quantity*, notes

**Business Rules:**
- **Two-tier validation:**
  1. `returned_quantity > stock_out.quantity` → reject (single return exceeds issued)
  2. `already_returned + returned_quantity > stock_out.quantity` → reject (cumulative exceeds issued)
- Item quantity INCREASED by returned_quantity (credited back)
- `unit_cost_at_time` copied from original stock-out
- `remaining_qty = issued_quantity - already_returned` (computed dynamically)

**Permissions:** super_admin, admin, stock_manager: Create and view | staff: No access

## 3.11 Damage & Loss Liabilities Module

**Purpose:** Track damaged (50% liability) or lost (100% liability) borrowed items with financial accountability, payment tracking, and waive functionality.

**Features:**
- Record damage (50% of replacement cost) or loss (100% of replacement cost) of borrowed items
- Financial liability calculation with percentage tracking
- Full and partial payment tracking with installment history
- Liability waiving (super_admin, admin only)
- Status tracking: pending → unpaid → partially_paid → paid | waived
- Double-counting prevention (checks returns + existing liabilities)
- 4 report types: damage, loss, outstanding, paid
- Auto notification to management on creation/payment/waive
- Borrowing auto-status update when fully accounted

**Screens:** Damage Liabilities List (route: `/damage-liabilities`), Record Liability Modal, Payment Modal, Payment History Modal

**Inputs:** borrowing_id*, returned_quantity*, liability_type* (damaged|lost), notes (create) | payment_amount*, notes (pay)

**Business Rules:**
- **Liability calculation:**
  - Damaged: borrower pays **50%** of replacement cost
  - Lost: borrower pays **100%** of replacement cost
  - `replacement_cost = qty * unit_cost_at_time` (full replacement value)
  - `liability_amount = replacement_cost * (liability_percentage / 100)` (what they owe)
- **Status transitions:** `pending` → `unpaid` → `partially_paid` → `paid` | `waived`
- Partial payments supported via `recordPayment` with balance tracking
- `balance = liability_amount - amount_paid` (generated column)
- Double-counting prevention: checks BOTH returns and damage_liabilities SUM
- Borrowing status updated to 'damaged' or 'lost' when all items accounted for
- Notifications sent to creator + management on every payment/status change
- Payment history stored in `damage_payments` table (installment tracking)
- Denormalized data: item_name, item_sku, borrower_name stored on liability record

**Reports (4 types):**
- `/reports/damage` — All damaged liabilities with summary
- `/reports/loss` — All lost liabilities with summary
- `/reports/outstanding` — All unpaid/partially_paid liabilities
- `/reports/paid` — All paid liabilities

**Permissions:** super_admin, admin, stock_manager: Create, view, record payments | super_admin, admin: Waive liabilities

## 3.12 Reports Module

**Purpose:** Generate operational and management reports across all system modules.

**Features:**
- 10 report types covering all modules
- JSON response with summary + records
- Generated-by metadata (user name, role, timestamp)
- Consistent response format across all reports

**Screens:** Reports Page (route: `/reports`)

**Endpoints:**
| Endpoint | Description |
|----------|-------------|
| `GET /reports/inventory-status` | Total items, categories, stock levels, low/out-of-stock counts, full item list |
| `GET /reports/stock-in` | All stock-in transactions with totals |
| `GET /reports/stock-out` | All stock-out transactions with COGS totals |
| `GET /reports/adjustments` | All adjustments with increase/decrease totals |
| `GET /reports/borrowings` | All borrowings with active/overdue/returned counts |
| `GET /reports/returns` | All returns with quantity totals |
| `GET /reports/requests` | All requests with pending/approved/rejected/allocated counts |
| `GET /reports/leftovers` | All leftover returns with quantity totals |
| `GET /reports/damage-liabilities` | All liabilities with unpaid/partially_paid/paid counts |
| `GET /reports/budgets` | Budget vs actual with remaining amounts |

**Permissions:** super_admin, admin, stock_manager: All 10 reports

## 3.13 Departments Module

**Purpose:** Manage organizational departments for inventory categorization and user assignment.

**Features:**
- Department CRUD
- Manager assignment (staff role cannot be manager)
- Inventory count per department (delete protection)

**Screens:** Departments List (route: `/departments`), Add/Edit Department Modal

**Inputs:** name*, description, manager_id

**Business Rules:**
- Name is required and must be unique (DB UNIQUE constraint)
- Staff-role users cannot be assigned as department managers
- Cannot delete department with existing inventory
- Departments referenced by items, users, budgets, stock transactions

**Permissions:** super_admin, admin: Create, update | super_admin: Delete | stock_manager: View only | staff: No access

## 3.14 User Management Module

**Purpose:** Manage system users, their roles, and multi-department assignments.

**Features:**
- User CRUD (deactivation via status, not hard delete)
- Role assignment
- **Multi-department assignment** (junction table: `user_departments`)
- Last login tracking
- Password reset by admin (Super Admin protected)
- Super Admin protection enforcement (8 rules)

**Screens:** Users List (route: `/users`), Add/Edit User Modal

**Inputs:** full_name*, email*, password* (create), role_id*, department_id, department_ids[], status

**Business Rules:**
- **Super Admin Protection (8 rules):**
  1. Only one active Super Admin allowed
  2. Super Admin cannot be deleted or deactivated
  3. Super Admin role cannot be changed
  4. Super Admin cannot be department-restricted
  5. Super Admin password can only be changed by themselves
  6. Cannot promote another user to Super Admin if one exists
  7. Users cannot delete their own account
  8. All violations logged to `super_admin_audit_log` + `activity_logs`
- User deactivation = status change to 'inactive', not DELETE
- Multi-department via `user_departments` junction table (replaced on every update)
- Department_ids sync on create/update

**Permissions:** super_admin, admin: Full CRUD (admin has Super Admin protections applied)

## 3.15 Notifications Module

**Purpose:** Deliver system-generated notifications to users about inventory events.

**Features:**
- User-specific notification list (latest 50)
- Unread notification count
- Mark single as read
- Mark all as read
- Auto-cleanup of old read notifications (30+ days)
- Notifications on every significant event

**Screens:** Notifications Page (route: `/notifications`), Notification bell in header

**Notification Triggers:**

| Event | Title | Recipients | Module |
|-------|-------|-----------|--------|
| Low Stock | "Low Stock Alert" | super_admin, admin, stock_manager | inventory |
| Request Submitted | "New Stock Request" | super_admin, admin, stock_manager | requests |
| Request Approved/Rejected/Allocated | "Request Approved/Rejected/Allocated" | Requester | requests |
| Request Cancelled | "Request Cancelled" | Requester | requests |
| User Created | "Welcome to Mizero Hub" | New user | system |
| Damage Reported | "Damage Reported" | Creator + Management | damage_liabilities |
| Loss Reported | "Lost Item Reported" | Creator + Management | damage_liabilities |
| Payment Recorded | "Liability Payment Recorded" | Creator + Management | damage_liabilities |
| Liability Paid | "Liability Paid" | Creator + Management | damage_liabilities |
| Liability Waived | "Liability Waived" | Creator | damage_liabilities |

**Retention:** Read notifications older than 30 days auto-cleaned

**Permissions:** All authenticated: View own, mark as read | super_admin, admin: Cleanup

## 3.16 Activity Logs Module

**Purpose:** Provide a complete, immutable audit trail of all actions performed in the system.

**Features:**
- Record every significant action
- Filter by module and action type
- Pagination (50 per page)
- 90-day retention with manual cleanup

**Screens:** Activity Logs Page (route: `/activity-logs`)

**Logged Actions:**

| Module | Actions Logged |
|--------|---------------|
| auth | login, change_password, reset_password, update_profile |
| inventory | create, update, delete, stock_in, stock_out, adjustment, import_csv, leftover_return |
| borrowing | borrow |
| returns | return |
| requests | create_request, review_request, cancel_request |
| departments | create, update, delete |
| users | create_user, update_user, deactivate_user |
| budgets | create_budget, update_budget, delete_budget |
| damage_liabilities | damage_report, loss_report, liability_payment, liability_waived |
| admin | backup_database |
| security | super_admin_violation |

**Data per Entry:** user_id, action, module, description (human-readable), ip_address, created_at

**Retention:** 90 days. Manual cleanup by super_admin/admin.

**Permissions:** super_admin, admin, stock_manager: View and filter | super_admin, admin: Cleanup

## 3.17 Budget Management Module

**Purpose:** Allow departments and management to plan and track inventory spending.

**Features:**
- Create annual department budgets
- Budget consumption tracking (via stock out costs by department)
- Budget utilization percentage
- Budget summary overview

**Screens:** Budget Page (route: `/budget`), Add/Edit Budget Modal

**Inputs:** department_id*, fiscal_year*, total_budget*, description

**Business Rules:**
- Unique constraint: (department_id, fiscal_year) must be unique
- Budget consumption = SUM of stock_out costs for items belonging to that department, filtered by fiscal year
- `remaining = MAX(0, total_budget - amount_used)`
- `usage_pct = (amount_used / total_budget) × 100`

**Permissions:** super_admin, admin: Full CRUD

## 3.18 Analytics Module

**Purpose:** Provide financial and inventory intelligence for data-driven decision making.

**Features:**
- Financial KPI display
- Inventory trends and insights
- Department cost analysis view

**Screens:** Analytics Page (route: `/analytics`)

**Permissions:** super_admin, admin, stock_manager

## 3.19 Database Backup Module

**Purpose:** Provide a safe, one-click method to export the entire database as a SQL file that can be used to fully restore the system.

**Features:**
- Full database SQL export using pure Node.js (no mysqldump required)
- Auto-discovers ALL tables via `SHOW TABLES` (future-proof)
- Generates `CREATE TABLE` + batched `INSERT INTO` (50 rows per batch)
- `SET FOREIGN_KEY_CHECKS = 0/1` for safe restoration
- `DROP TABLE IF EXISTS` for idempotent restore
- Timestamped filename format: `mizerohub_backup_YYYY_MM_DD_HHMMSS.sql`
- Saved to `database backup/` folder + auto-download
- Activity logged with filename and user details

**Endpoint:** `GET /api/backups/database` (super_admin only)

**Error Handling:**
- Database connection failure: `{ success: false, message: "Database connection failed" }`
- Permission denied: 403 via authorize middleware

**Permissions:** super_admin: ONLY role with access

---

# 4. COMPLETE INVENTORY WORKFLOW

## Item Lifecycle

```
1. ITEM CREATION
   └─ User creates item with name, category, unit, type, department
   └─ SKU auto-generated (or supplied via CSV)
   └─ Image (optional)
   └─ Initial quantity = 0
        │
        ▼
2. STOCK IN (Purchase)
   └─ Record stock-in with quantity, unit_price, supplier
   └─ Item quantity INCREASED
   └─ AVCO recalculated (weighted average unit cost)
        │
        ▼
3. INVENTORY AVAILABLE
   └─ Item has quantity in stock
   └─ Can be: issued (stock-out), borrowed, requested, adjusted
        │
   ┌────┼────┬────┐
   ▼    ▼    ▼    ▼
Stock Borrow Adjust Request

4. STOCK OUT / ISSUANCE
   └─ Quantity taken from available stock
   └─ COGS snapshotted (unit_cost at time)
   └─ Leftover tracking begins
        │
        ▼
5. LEFTOVER RETURN / BORROWING RETURN
   └─ Unused stock returned → quantity INCREASED
   └─ Borrowed item returned (good) → quantity INCREASED
   └─ Borrowed item damaged → liability (50%), no restock
   └─ Borrowed item lost → liability (100%), no restock

6. FINANCIAL REPORTING
   └─ Inventory value = SUM(qty × unit_cost)
   └─ COGS = SUM(stock_out qty × unit_cost_at_time)
   └─ Budget consumption by department
```

---

# 5. INVENTORY BUSINESS RULES

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | SKU must be unique | Auto-generated + UNIQUE constraint |
| 2 | Inventory cannot become negative | Validated on stock-out, adjustment decrease, borrowing |
| 3 | Stock Out quantity cannot exceed available stock | `items[0].quantity < quantity` → reject |
| 4 | Adjustment decrease cannot exceed available stock | Same as stock-out |
| 5 | Quantity is NOT editable via item update | Only stock-in, stock-out, adjustments change qty |
| 6 | Items can only be soft-deleted (deleted_at) | UPDATE sets timestamp, row remains for JOINs |
| 7 | Only non-consumable items can be borrowed | Query filter: `item_type = 'non-consumable'` |
| 8 | Borrowers with overdue items cannot borrow again | COUNT overdue borrowings > 0 → reject |
| 9 | Damaged items go to liabilities (50%), not returns | Blocked in returns controller |
| 10 | Lost items go to liabilities (100%), not returns | Blocked in returns controller |
| 11 | AVCO only recalculated on stock-in | Adjustments do NOT change unit_cost |
| 12 | COGS snapshotted at stock-out time | unit_cost_at_time stored on stock_out record |
| 13 | Request state machine enforced | Invalid transitions blocked |
| 14 | Allocation auto-creates stock-out record | On 'allocated' status |
| 15 | Super Admin protections enforced (8 rules) | Centralized guard module |
| 16 | Department required when creating items | Backend validation + frontend required field |
| 17 | Departments with inventory cannot be deleted | COUNT(items) > 0 → reject |
| 18 | Staff cannot see item quantities or costs | Fields stripped from API responses |

---

# 6. BORROWING & LIABILITY WORKFLOW

```
┌──────────────┐
│ BORROW ITEM  │ (non-consumable only)
│ Item qty ↓   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ DUE DATE     │
│ APPROACHING  │
└──────┬───────┘
       │
   ┌───┴───┐
   ▼       ▼
RETURN  OVERDUE
  │       (manual check)
  ▼
┌────┬────┐
│    │    │
▼    ▼    ▼
GOOD DAMAGED LOST
│    │      │
│    ▼      ▼
│  50%    100%
│  liability liability
│
▼
Item qty ↑
```

---

# 7. DATABASE DESIGN

## Entity Relationship Overview

```
roles ──< users >── user_departments >── departments
  │        │                                  │
  │        │ (created_by)                     │ (manager_id)
  │        │                                  │
  │        ├── items <── stock_in              │
  │        │     │      ├── stock_out          │
  │        │     │      ├── stock_adjustments  │
  │        │     │      ├── borrowings         │
  │        │     │      │     └── returns      │
  │        │     │      │     └── damage_liabilities
  │        │     │      │           └── damage_payments
  │        │     │      ├── leftovers          │
  │        │     │      └── requests ────┘     │
  │        │     │                             │
  │        └── activity_logs                   │
  │        └── notifications                   │
  │        └── super_admin_audit_log           │
  │                                            │
  └── budgets ────────────────┘
```

## Core Tables

### roles
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| name | VARCHAR(50) | NOT NULL, UNIQUE |
| description | VARCHAR(255) | NULLABLE |
| created_at / updated_at | TIMESTAMP | Standard |

**Seed data:** super_admin, admin, stock_manager, staff

### departments
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| name | VARCHAR(100) | NOT NULL, UNIQUE |
| description | TEXT | NULLABLE |
| manager_id | INT | FK → users(id) ON DELETE SET NULL |

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| full_name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(100) | NOT NULL, UNIQUE |
| password | VARCHAR(255) | NOT NULL (bcrypt hash, 12 rounds) |
| role_id | INT | NOT NULL, FK → roles(id) |
| department_id | INT | NULLABLE, FK → departments(id) |
| status | ENUM('active','inactive') | DEFAULT 'active' |
| last_login | TIMESTAMP | NULLABLE |

### user_departments (Junction)
| Column | Type | Constraints |
|--------|------|-------------|
| user_id | INT | FK → users(id) ON DELETE CASCADE |
| department_id | INT | FK → departments(id) ON DELETE CASCADE |
| **UNIQUE KEY:** (user_id, department_id) |

### items
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| sku | VARCHAR(50) | **NOT NULL, UNIQUE** |
| name | VARCHAR(200) | NOT NULL |
| description | TEXT | NULLABLE |
| category | VARCHAR(100) | NULLABLE |
| unit | VARCHAR(50) | NOT NULL, DEFAULT 'pcs' |
| quantity | INT | NOT NULL, DEFAULT 0 |
| minimum_stock | INT | NOT NULL, DEFAULT 0 |
| unit_cost | DECIMAL(12,2) | NOT NULL, DEFAULT 0.00 (AVCO) |
| selling_price | DECIMAL(12,2) | NOT NULL, DEFAULT 0.00 |
| currency | VARCHAR(3) | NOT NULL, DEFAULT 'RWF' |
| item_type | ENUM('consumable','non-consumable') | NOT NULL |
| department_id | INT | FK → departments(id) |
| created_by | INT | FK → users(id) |
| image_url | VARCHAR(500) | NULLABLE |
| deleted_at | TIMESTAMP | NULLABLE (soft delete) |

**Indexes:** sku, name, category, department_id, item_type, low_stock (quantity, minimum_stock), deleted_at

### stock_in
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| item_id | INT | NOT NULL, FK → items(id) |
| quantity | INT | NOT NULL |
| unit_price | DECIMAL(12,2) | NOT NULL |
| total_cost | DECIMAL(14,2) | **GENERATED:** quantity × unit_price |
| supplier | VARCHAR(200) | NULLABLE |
| supplier_type | VARCHAR(50) | NULLABLE |
| reference_number | VARCHAR(100) | NULLABLE |
| notes | TEXT | NULLABLE |
| department_id | INT | NULLABLE |
| date | DATE | NOT NULL |
| created_by | INT | FK → users(id) |

### stock_out
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| item_id | INT | NOT NULL, FK → items(id) |
| quantity | INT | NOT NULL |
| unit_cost_at_time | DECIMAL(12,2) | NOT NULL (COGS snapshot) |
| selling_price_at_time | DECIMAL(12,2) | NOT NULL (margin snapshot) |
| total_cost | DECIMAL(14,2) | GENERATED: quantity × unit_cost_at_time |
| gross_margin | DECIMAL(12,2) | GENERATED: selling_price_at_time - unit_cost_at_time |
| gross_margin_pct | DECIMAL(5,2) | GENERATED (conditional) |
| recipient | VARCHAR(200) | NOT NULL |
| department | VARCHAR(100) | NULLABLE |
| reason | TEXT | NULLABLE |
| date | DATE | NOT NULL |
| created_by | INT | FK → users(id) |

### stock_adjustments
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| item_id | INT | NOT NULL, FK → items(id) |
| adjustment_type | ENUM('increase','decrease') | NOT NULL |
| quantity | INT | NOT NULL |
| unit_cost_at_time | DECIMAL(12,2) | NOT NULL |
| total_cost | DECIMAL(14,2) | GENERATED: quantity × unit_cost_at_time |
| reason | VARCHAR(255) | NOT NULL |
| notes | TEXT | NULLABLE |
| created_by | INT | FK → users(id) |

### borrowings
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| item_id | INT | NOT NULL, FK → items(id) |
| borrower_name | VARCHAR(200) | NOT NULL |
| borrower_phone | VARCHAR(50) | NULLABLE |
| quantity | INT | NOT NULL |
| unit_cost_at_time | DECIMAL(12,2) | NOT NULL |
| total_replacement_value | DECIMAL(14,2) | GENERATED: quantity × unit_cost_at_time |
| borrow_date | DATE | NOT NULL |
| due_date | DATE | NOT NULL |
| status | ENUM('borrowed','returned','overdue') | DEFAULT 'borrowed' |
| created_by | INT | FK → users(id) |

### returns
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| borrowing_id | INT | NOT NULL, FK → borrowings(id) |
| returned_quantity | INT | NOT NULL |
| unit_cost_at_time | DECIMAL(12,2) | NOT NULL |
| total_value | DECIMAL(14,2) | GENERATED |
| item_condition | ENUM('good','damaged','lost') | DEFAULT 'good' |
| notes | TEXT | NULLABLE |
| return_date | DATE | NOT NULL |
| created_by | INT | FK → users(id) |

### requests
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| requester_id | INT | NOT NULL, FK → users(id) |
| item_id | INT | NOT NULL, FK → items(id) |
| quantity | INT | NOT NULL |
| justification | TEXT | NULLABLE |
| status | ENUM('pending','approved','rejected','allocated') | DEFAULT 'pending' |
| reviewed_by | INT | FK → users(id) |
| reviewed_at | TIMESTAMP | NULLABLE |

### leftovers
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| stock_out_id | INT | NOT NULL, FK → stock_out(id) |
| returned_quantity | INT | NOT NULL |
| unit_cost_at_time | DECIMAL(12,2) | NOT NULL |
| total_value | DECIMAL(14,2) | GENERATED |
| notes | TEXT | NULLABLE |
| created_by | INT | FK → users(id) |

### damage_liabilities
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| liability_type | ENUM('damaged','lost') | NOT NULL |
| borrowing_id | INT | FK → borrowings(id) |
| item_id | INT | FK → items(id) |
| item_name | VARCHAR(200) | NOT NULL (denormalized) |
| item_sku | VARCHAR(50) | NOT NULL (denormalized) |
| borrower_name | VARCHAR(200) | NOT NULL (denormalized) |
| borrower_phone | VARCHAR(50) | NULLABLE |
| borrower_id | INT | NULLABLE |
| quantity | INT | NOT NULL |
| paid_quantity | INT | NOT NULL, DEFAULT 0 |
| remaining_quantity | INT | GENERATED: quantity - paid_quantity |
| unit_cost | DECIMAL(14,2) | NOT NULL |
| total_amount | DECIMAL(14,2) | NOT NULL |
| liability_percentage | DECIMAL(5,2) | NOT NULL (50.00=damaged, 100.00=lost) |
| replacement_cost | DECIMAL(14,2) | NOT NULL (full cost before %) |
| liability_amount | DECIMAL(14,2) | NOT NULL (what borrower owes) |
| amount_paid | DECIMAL(14,2) | NOT NULL, DEFAULT 0 |
| balance | DECIMAL(14,2) | **GENERATED:** liability_amount - amount_paid |
| status | ENUM('pending','unpaid','partially_paid','paid','waived') | DEFAULT 'pending' |
| notes | TEXT | NULLABLE |
| created_by | INT | FK → users(id) |
| paid_at | TIMESTAMP | NULLABLE |

### damage_payments
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| liability_id | INT | NOT NULL, FK → damage_liabilities(id) |
| payment_quantity | INT | NOT NULL |
| unit_cost | DECIMAL(14,2) | NOT NULL |
| amount | DECIMAL(14,2) | NOT NULL |
| notes | TEXT | NULLABLE |
| created_by | INT | FK → users(id) |
| paid_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### budgets
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| department_id | INT | NOT NULL, FK → departments(id) |
| fiscal_year | YEAR | NOT NULL |
| total_budget | DECIMAL(14,2) | NOT NULL |
| description | VARCHAR(255) | NULLABLE |
| created_by | INT | FK → users(id) |
| **UNIQUE KEY:** (department_id, fiscal_year) |

### notifications
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| user_id | INT | NOT NULL, FK → users(id) ON DELETE CASCADE |
| title | VARCHAR(255) | NOT NULL |
| message | TEXT | NOT NULL |
| module | VARCHAR(50) | NULLABLE |
| reference_id | INT | NULLABLE |
| is_read | TINYINT(1) | DEFAULT 0 |

### activity_logs
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| user_id | INT | FK → users(id) ON DELETE SET NULL |
| action | VARCHAR(100) | NOT NULL |
| module | VARCHAR(50) | NOT NULL |
| description | TEXT | NULLABLE |
| ip_address | VARCHAR(45) | NULLABLE |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### super_admin_audit_log
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| actor_id | INT | NOT NULL |
| action | VARCHAR(100) | NOT NULL |
| target_user_id | INT | NULLABLE |
| details | TEXT | NULLABLE |
| ip_address | VARCHAR(45) | NULLABLE |
| status | ENUM('blocked','allowed') | DEFAULT 'blocked' |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

# 8. API ENDPOINT REFERENCE

## Authentication
| Method | Endpoint | Auth | Rate Limited | Description |
|--------|----------|------|-------------|-------------|
| POST | `/api/auth/login` | Public | Yes (10/15min) | Login with email + password |
| GET | `/api/auth/me` | Bearer | — | Get current user profile |
| PUT | `/api/auth/change-password` | Bearer | — | Change own password |
| PUT | `/api/auth/reset-password` | Bearer + admin | — | Admin reset user password |
| PUT | `/api/auth/profile` | Bearer | — | Update own name/email |

## Dashboard
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/dashboard` | All | 20+ aggregated metrics + charts |

## Items / Inventory
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/items` | All | List with search/filter/pagination |
| GET | `/api/items/categories` | All | Distinct categories |
| GET | `/api/items/export/csv` | admin, stock_manager | Export as CSV |
| GET | `/api/items/export/csv/template` | admin, stock_manager | Download import template |
| GET | `/api/items/:id` | All | Get single item |
| POST | `/api/items` | admin, stock_manager | Create (multipart + image) |
| PUT | `/api/items/:id` | admin, stock_manager | Update (no qty changes) |
| DELETE | `/api/items/:id` | super_admin, admin | Soft-delete |
| POST | `/api/items/import/csv/preview` | admin, stock_manager | Preview CSV import |
| POST | `/api/items/import/csv` | admin, stock_manager | Execute CSV import (?strategy=skip\|update) |

## Stock In
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/stock-in` | All | List with filters |
| GET | `/api/stock-in/:id/receipt` | All | Receipt details |
| POST | `/api/stock-in` | admin, stock_manager | Record stock-in (+ AVCO) |

## Stock Out
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/stock-out` | All | List with leftover tracking |
| GET | `/api/stock-out/:id/receipt` | All | Receipt details |
| POST | `/api/stock-out` | admin, stock_manager | Record stock-out (+ COGS snapshot) |

## Adjustments
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/adjustments` | All | List |
| POST | `/api/adjustments` | admin, stock_manager | Create adjustment |

## Borrowings
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/borrowings` | All | List with remaining qty |
| GET | `/api/borrowings/:id/receipt` | All | Receipt details |
| POST | `/api/borrowings` | admin, stock_manager | Create (non-consumable only) |
| POST | `/api/borrowings/check-overdue` | super_admin, admin | Auto-mark overdue |

## Returns
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/returns` | All | List (good condition only) |
| POST | `/api/returns` | admin, stock_manager | Record return |

## Requests
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/requests` | All (staff: own only) | List |
| GET | `/api/requests/:id/receipt` | All | Receipt details |
| POST | `/api/requests` | All | Create |
| PUT | `/api/requests/:id/review` | admin, stock_manager | Review (approve/reject/allocate) |
| PUT | `/api/requests/:id/cancel` | All own + manager | Cancel pending |

## Leftovers
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/leftovers` | All | List |
| POST | `/api/leftovers` | admin, stock_manager | Record return |

## Damage & Loss Liabilities
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/damage-liabilities` | All | List with filters |
| GET | `/api/damage-liabilities/:id/receipt` | All | Receipt details |
| GET | `/api/damage-liabilities/:id/payments` | All | Payment history |
| POST | `/api/damage-liabilities` | admin, stock_manager | Create (damaged/lost) |
| POST | `/api/damage-liabilities/:id/pay` | admin, stock_manager | Record partial payment |
| PUT | `/api/damage-liabilities/:id/pay` | admin, stock_manager | Mark full paid |
| POST | `/api/damage-liabilities/:id/waive` | super_admin, admin | Waive liability |
| GET | `/api/damage-liabilities/reports/damage` | admin, stock_manager | Damage report |
| GET | `/api/damage-liabilities/reports/loss` | admin, stock_manager | Loss report |
| GET | `/api/damage-liabilities/reports/outstanding` | admin, stock_manager | Outstanding report |
| GET | `/api/damage-liabilities/reports/paid` | admin, stock_manager | Paid report |

## Departments
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/departments` | All | List |
| GET | `/api/departments/:id` | All | Get single |
| POST | `/api/departments` | super_admin, admin | Create |
| PUT | `/api/departments/:id` | super_admin, admin | Update |
| DELETE | `/api/departments/:id` | super_admin | Delete (if no items) |

## Users
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/users` | super_admin, admin | List with departments |
| GET | `/api/users/roles` | super_admin, admin | All roles |
| GET | `/api/users/:id/departments` | super_admin, admin | User's dept IDs |
| POST | `/api/users` | super_admin, admin | Create (+ multi-dept) |
| PUT | `/api/users/:id` | super_admin, admin | Update (+ multi-dept) |
| DELETE | `/api/users/:id` | super_admin, admin | Deactivate |

## Budgets
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/budgets` | super_admin, admin | List with amount_used |
| GET | `/api/budgets/summary` | super_admin, admin | Budget summary |
| POST | `/api/budgets` | super_admin, admin | Create |
| PUT | `/api/budgets/:id` | super_admin, admin | Update |
| DELETE | `/api/budgets/:id` | super_admin, admin | Delete |

## Reports (all GET, return JSON)
| Endpoint | Roles | Description |
|----------|-------|-------------|
| `/api/reports/inventory-status` | admin, stock_manager | Inventory status |
| `/api/reports/stock-in` | admin, stock_manager | Stock in report |
| `/api/reports/stock-out` | admin, stock_manager | Stock out report |
| `/api/reports/adjustments` | admin, stock_manager | Adjustments report |
| `/api/reports/borrowings` | admin, stock_manager | Borrowings report |
| `/api/reports/returns` | admin, stock_manager | Returns report |
| `/api/reports/requests` | admin, stock_manager | Requests report |
| `/api/reports/leftovers` | admin, stock_manager | Leftovers report |
| `/api/reports/damage-liabilities` | admin, stock_manager | Liabilities report |
| `/api/reports/budgets` | admin, stock_manager | Budget report |

## Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | User's notifications (latest 50) |
| GET | `/api/notifications/unread-count` | Unread count |
| PUT | `/api/notifications/:id/read` | Mark read |
| PUT | `/api/notifications/read-all` | Mark all read |
| DELETE | `/api/notifications/cleanup` | Cleanup old (admin+) |

## Activity Logs
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/activity-logs` | admin, stock_manager | List with filters |
| DELETE | `/api/activity-logs/cleanup` | super_admin, admin | Cleanup > 90 days |

## Database Backup
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/backups/database` | super_admin (only) | Generate & download SQL backup |

## System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

---

# 9. FRONTEND ROUTE MAP

| Route | Page Component | Auth | Roles |
|-------|---------------|------|-------|
| `/login` | Login.jsx | Public | All |
| `/dashboard` | Dashboard.jsx | Yes | All |
| `/analytics` | Analytics.jsx | Yes | super_admin, admin, stock_manager |
| `/inventory` | Inventory.jsx | Yes | super_admin, admin, stock_manager |
| `/stock-in` | StockIn.jsx | Yes | super_admin, admin, stock_manager |
| `/stock-out` | StockOut.jsx | Yes | super_admin, admin, stock_manager |
| `/adjustments` | Adjustments.jsx | Yes | super_admin, admin, stock_manager |
| `/borrowings` | Borrowings.jsx | Yes | super_admin, admin, stock_manager |
| `/returns` | Returns.jsx | Yes | super_admin, admin, stock_manager |
| `/requests` | Requests.jsx | Yes | All |
| `/leftovers` | Leftovers.jsx | Yes | super_admin, admin, stock_manager |
| `/damage-liabilities` | DamageLiabilities.jsx | Yes | super_admin, admin, stock_manager |
| `/budget` | Budget.jsx | Yes | super_admin, admin |
| `/reports` | Reports.jsx | Yes | super_admin, admin, stock_manager |
| `/departments` | Departments.jsx | Yes | super_admin, admin |
| `/users` | Users.jsx | Yes | super_admin, admin |
| `/activity-logs` | ActivityLogs.jsx | Yes | super_admin, admin, stock_manager |
| `/notifications` | Notifications.jsx | Yes | All |
| `/profile` | Profile.jsx | Yes | All |

---

# 10. TECHNOLOGY STACK

## Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.21
- **Database:** MySQL 8+ with mysql2 3.11
- **Auth:** jsonwebtoken + bcryptjs (12 rounds)
- **Validation:** express-validator 7.2
- **Rate Limiting:** express-rate-limit
- **File Upload:** multer (10MB CSV / 5MB image)
- **PDF:** PDFKit 0.15 (for receipts)
- **CSV:** csv-parse 5.5 + csv-stringify 6.5

## Frontend
- **Framework:** React 18.3
- **Build:** Vite 5.4
- **Routing:** react-router-dom 6.26
- **HTTP:** Axios 1.7
- **Charts:** Chart.js 4.4 + react-chartjs-2 5.2
- **Icons:** react-icons (Heroicons) 5.3
- **Styling:** Tailwind CSS 3.4
- **Forms:** react-hook-form 7.53
- **Toasts:** react-hot-toast 2.4
- **PDF Export (frontend):** jspdf + jspdf-autotable

## Development
- **Backend Dev:** nodemon
- **CSS:** PostCSS + autoprefixer

---

# 11. DEPLOYMENT CONFIGURATION

## Environment Variables
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=mizero_inventory
DB_USER=root
DB_PASSWORD=
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
FRONTEND_URL=http://localhost:5173
```

## Database Setup
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS mizero_inventory"

# Run schema
mysql -u root -p mizero_inventory < backend/database/schema.sql

# Run seed data (development)
mysql -u root -p mizero_inventory < backend/database/seed.sql
```

## Default Credentials (Development)
| Email | Password | Role |
|-------|----------|------|
| admin@mizero.com | password123 | super_admin |
| john@mizero.com | password123 | stock_manager (IT) |
| stock@mizero.com | password123 | stock_manager (General Store) |
| staff@mizero.com | password123 | staff |

---

# 12. SUPER ADMIN PROTECTION RULES

1. **Only one Super Admin allowed** — guarded on create and role-promote
2. **Cannot be deleted or deactivated** — guarded on delete and status change
3. **Role cannot be changed** — guarded on update
4. **Cannot be department-restricted** — blocks department_id changes
5. **Password only changeable by self** — guarded on password reset
6. **Users cannot self-delete** — blocked at controller level
7. **Cannot promote another user to Super Admin** — checked on role change
8. **All violations logged** — to both `super_admin_audit_log` and `activity_logs`

---

# 13. INVENTORY VALUATION SYSTEM

## Pricing Model: Weighted Average Cost (AVCO)

```
new_unit_cost = ((current_qty × current_cost) + (incoming_qty × price))
                / (current_qty + incoming_qty)
```

## Cost Fields by Table

| Field | Table | Purpose |
|-------|-------|---------|
| `unit_cost` | items | Current AVCO (updated on stock-in) |
| `unit_price` | stock_in | Purchase price per unit |
| `unit_cost_at_time` | stock_out | COGS snapshot |
| `unit_cost_at_time` | adjustments | Adjustment cost snapshot |
| `unit_cost_at_time` | borrowings | Replacement value basis |
| `unit_cost_at_time` | returns | Copied from borrowing |
| `unit_cost_at_time` | leftovers | Copied from stock-out |

## Key Financial Metrics

| Metric | Formula |
|--------|---------|
| Inventory Value | `SUM(items.quantity × items.unit_cost)` |
| COGS | `SUM(stock_out.quantity × stock_out.unit_cost_at_time)` |
| Revenue | `SUM(stock_out.quantity × stock_out.selling_price_at_time)` |
| Gross Margin | `SUM(quantity × (selling_price - unit_cost))` |
| Damaged Liability | `SUM(qty × unit_cost × 50%)` |
| Lost Liability | `SUM(qty × unit_cost × 100%)` |

---

*End of Document — Mizero Inventory Hub Complete Blueprint v1.1*
