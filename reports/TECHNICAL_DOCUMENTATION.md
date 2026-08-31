# Mizero Inventory Hub — Technical Documentation

> **Version:** 1.0.0  
> **Stack:** Node.js + Express (Backend) · React + Vite + Tailwind CSS (Frontend)  
> **Database:** MySQL 8+ with mysql2 driver  
> **Last Updated:** June 14, 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Project Structure](#2-project-structure)
3. [Database Schema](#3-database-schema)
4. [Backend Architecture](#4-backend-architecture)
   - 4.1 [Server Entry Point](#41-server-entry-point)
   - 4.2 [Configuration](#42-configuration)
   - 4.3 [Middleware Layer](#43-middleware-layer)
   - 4.4 [Utility Modules](#44-utility-modules)
   - 4.5 [API Routes](#45-api-routes)
   - 4.6 [Controllers](#46-controllers)
5. [Frontend Architecture](#5-frontend-architecture)
   - 5.1 [Application Entry & Routing](#51-application-entry--routing)
   - 5.2 [Authentication Context](#52-authentication-context)
   - 5.3 [Layout & Navigation](#53-layout--navigation)
   - 5.4 [Shared Components](#54-shared-components)
   - 5.5 [Pages](#55-pages)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)
7. [Super Admin Protection System](#7-super-admin-protection-system)
8. [API Endpoint Reference](#8-api-endpoint-reference)
9. [CSV Import/Export System](#9-csv-importexport-system)
10. [Database Backup System](#10-database-backup-system)
11. [Notifications System](#11-notifications-system)
12. [Activity Logging](#12-activity-logging)
13. [Security Considerations](#13-security-considerations)
14. [Seed Data & Default Accounts](#14-seed-data--default-accounts)
15. [Development & Deployment](#15-development--deployment)

---

## 1. System Overview

Mizero Inventory Hub is a full-stack inventory management system designed for organizational asset tracking, stock control, borrowing management, and financial accountability. The system supports four user roles with granular permissions, department-based scoping, and comprehensive audit logging.

### Core Capabilities

| Module | Description |
|--------|-------------|
| **Inventory** | CRUD operations, SKU generation, soft-delete, categories, image upload |
| **Stock In** | Receive inventory with Weighted Average Cost (AVCO) recalculation |
| **Stock Out** | Issue inventory with COGS and margin tracking |
| **Adjustments** | Increase/decrease stock corrections (non-AVCO affecting) |
| **Borrowings** | Track borrowed items (non-consumable), overdue checking |
| **Returns** | Record returned borrowings in good condition |
| **Damage & Loss Liabilities** | 50% (damaged) / 100% (lost) liability, payment tracking, waivers |
| **Stock Requests** | Staff can request items; managers approve/reject/allocate |
| **Leftovers** | Return unused stock from stock-outs back to inventory |
| **Departments** | Multi-department management with scoped access |
| **Users** | Role-based user management with department assignments |
| **Budgets** | Fiscal-year department budgets with spend tracking |
| **Reports** | 10 report types covering all modules |
| **Activity Logs** | Full audit trail with cleanup (90-day retention) |
| **Notifications** | In-app notifications for low stock, requests, liabilities |
| **Database Backup** | One-click full SQL export (super_admin only) |
| **CSV Import/Export** | Template download, row-level validation, skip/update strategy |

---

## 2. Project Structure

```
freebuff/
├── backend/
│   ├── config/
│   │   └── db.js                    # MySQL connection pool
│   ├── controllers/
│   │   ├── activityLogController.js # Activity log retrieval & cleanup
│   │   ├── authController.js        # Login, password management, profile
│   │   ├── backupController.js      # Full database SQL export
│   │   ├── borrowingController.js   # Borrow/return tracking, overdue
│   │   ├── budgetController.js      # Department budget CRUD + summary
│   │   ├── damageLiabilityController.js # Liabilities, payments, waivers, reports
│   │   ├── dashboardController.js   # Dashboard aggregation queries
│   │   ├── departmentController.js  # Department CRUD
│   │   ├── itemController.js        # Items, CSV import/export, templates
│   │   ├── leftoverController.js    # Unused stock returns
│   │   ├── notificationController.js # In-app notifications
│   │   ├── reportController.js      # 10 report types
│   │   ├── requestController.js     # Stock requests state machine
│   │   ├── returnController.js      # Good-condition borrowing returns
│   │   ├── stockAdjustmentController.js # Stock corrections
│   │   ├── stockInController.js     # Receiving inventory + AVCO
│   │   ├── stockOutController.js    # Issuing inventory + COGS
│   │   └── userController.js        # User CRUD, multi-department
│   ├── database/
│   │   ├── schema.sql               # Full database schema (CREATE TABLE)
│   │   ├── seed.sql                 # Seed data with sample records
│   │   ├── migration-001-soft-delete.sql
│   │   ├── migration-002-user-departments.sql
│   │   ├── migration-004-super-admin-protection.sql
│   │   ├── migration-005-unit-price.sql
│   │   ├── migration-006-selling-price.sql
│   │   ├── migration-007-budget-and-reports.sql
│   │   ├── migration-008-item-images.sql
│   │   ├── migration-009-damage-liabilities.sql
│   │   ├── migration-010-partial-payments.sql
│   │   ├── migration-011-liability-type.sql
│   │   ├── migration-012-borrowing-status-enum.sql
│   │   └── migration-013-liability-status-enum.sql
│   ├── middleware/
│   │   ├── auth.js                  # JWT authentication
│   │   ├── rbac.js                  # Role-based authorization
│   │   └── validate.js             # Express-validator error handler
│   ├── routes/
│   │   ├── activityLogs.js
│   │   ├── adjustments.js
│   │   ├── auth.js                  # Login rate-limiting included
│   │   ├── backup.js
│   │   ├── borrowings.js
│   │   ├── budgets.js
│   │   ├── damageLiabilities.js
│   │   ├── dashboard.js
│   │   ├── departments.js
│   │   ├── items.js                 # Multer config for images + CSVs
│   │   ├── leftovers.js
│   │   ├── notifications.js
│   │   ├── reports.js
│   │   ├── requests.js
│   │   ├── returns.js
│   │   ├── stockIn.js
│   │   ├── stockOut.js
│   │   └── users.js
│   ├── scripts/
│   │   ├── migrate-passwords.js
│   │   ├── run-migration-005.js
│   │   ├── run-migration.js
│   │   └── setup-admin.js
│   ├── utils/
│   │   ├── activityLogger.js        # Audit log writer
│   │   ├── notificationHelper.js    # Notification dispatcher
│   │   └── superAdminGuard.js       # Protection orchestration
│   ├── server.js                    # Express app entry point
│   ├── package.json                 # Dependencies & scripts
│   └── .env                         # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx                 # React DOM entry
│   │   ├── App.jsx                  # Route definitions & guards
│   │   ├── index.css                # Tailwind directives + custom utilities
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Auth state, login/logout, role checks
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx       # Sidebar, header, command palette
│   │   ├── components/
│   │   │   ├── DataTable.jsx        # Reusable table with sort/search/filter
│   │   │   ├── Modal.jsx            # Modal dialog (sm/md/lg/xl)
│   │   │   ├── Pagination.jsx       # Page navigation component
│   │   │   ├── SearchBar.jsx        # Search with filter chips
│   │   │   ├── LoadingSkeleton.jsx  # Skeleton loading states
│   │   │   └── CommandPalette.jsx   # Ctrl+K quick navigation
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Inventory.jsx        # Includes CSV import modal
│   │   │   ├── StockIn.jsx
│   │   │   ├── StockOut.jsx
│   │   │   ├── Adjustments.jsx
│   │   │   ├── Borrowings.jsx
│   │   │   ├── Returns.jsx
│   │   │   ├── Requests.jsx
│   │   │   ├── Leftovers.jsx
│   │   │   ├── DamageLiabilities.jsx
│   │   │   ├── Budget.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── Departments.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── ActivityLogs.jsx
│   │   │   ├── Notifications.jsx
│   │   │   └── Profile.jsx          # Includes database backup
│   │   ├── services/
│   │   │   └── api.js               # Axios instance with auth interceptor
│   │   └── utils/
│   │       └── toastUtils.jsx       # toastSuccess, toastError, toastPromise
│   ├── vite.config.js               # Vite config with API proxy
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
└── TECHINCAL_DOCUMENTATION.md       # This document
```

---

## 3. Database Schema

### 3.1 Entity Relationship Summary

```
roles ──< users ──> user_departments >── departments
 │         │
 │         ├──< activity_logs
 │         ├──< notifications
 │         ├──< items (created_by)
 │         └──< stock_in, stock_out, adjustments, borrowings, etc.
 │
departments ──< items
             ──< budgets
             ──< user_departments
             ──< stock_in
```

### 3.2 Core Tables

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `roles` | `id` | User roles: super_admin, admin, stock_manager, staff |
| `departments` | `id` | Organizational departments with optional manager |
| `users` | `id` | System users with bcrypt passwords, role FK, status |
| `user_departments` | — | Many-to-many user-department assignments |
| `items` | `id` | Inventory items with SKU, quantities, costs, soft-delete |
| `stock_in` | `id` | Receiving records with unit_price, AVCO triggers |
| `stock_out` | `id` | Issue records with COGS/margin snapshots |
| `stock_adjustments` | `id` | Quantity corrections (increase/decrease) |
| `borrowings` | `id` | Item loans with status (borrowed/returned/overdue) |
| `returns` | `id` | Good-condition return of borrowed items |
| `requests` | `id` | Stock requests with state machine (pending→approved/allocated/rejected) |
| `leftovers` | `id` | Unused stock returns from stock-outs |
| `notifications` | `id` | In-app notifications, user-scoped, is_read flag |
| `activity_logs` | `id` | Full audit trail with action, module, description |
| `damage_liabilities` | `id` | Damage/loss liabilities, payment tracking, statuses |
| `damage_payments` | `id` | Payment installments against liabilities |
| `budgets` | `id` | Department fiscal-year budgets with spend tracking |

### 3.3 Key Schema Details

#### Items Table (Inventory)
- **Soft-delete:** `deleted_at TIMESTAMP NULL` — records are marked as deleted, never physically removed, preserving historical JOIN integrity
- **SKU generation:** Auto-generated format: `INV-{timestamp_base36}-{random_4chars}` or user-supplied via CSV
- **unit_cost:** Updated via Weighted Average Cost (AVCO) on stock-in only
- **selling_price:** Used for margin calculation on stock-out
- **Indexes:** sku (UNIQUE), name, category, department_id, item_type, low_stock (quantity, minimum_stock)

#### Stock In Table
- **AVCO recalculation:** `new_avg = ((current_qty * current_cost) + (incoming_qty * incoming_price)) / (current_qty + incoming_qty)` — weighted average cost is recalculated after every stock-in transaction
- **total_cost:** Computed column: `quantity * unit_price`
- **department_id:** Optional department-specific stock-in

#### Stock Out Table
- **Cost snapshots:** `unit_cost_at_time` and `selling_price_at_time` are captured from the item at the moment of stock-out for accurate COGS and margin reporting
- **COGS:** `quantity * unit_cost_at_time`
- **Margin:** `quantity * (selling_price_at_time - unit_cost_at_time)`

#### Borrowings Table
- **Statuses:** `borrowed` → `returned` (via returns) or `overdue` / `damaged` / `lost` (via auto-check or liability creation)
- **Remaining quantity:** Computed via LEFT JOINs on returns and damage_liabilities
- **Overdue detection:** Manual `POST /borrowings/check-overdue` endpoint marks past-due borrowings

#### Damage Liabilities Table
- **Liability calculation:** Damaged = 50% of replacement cost, Lost = 100% of replacement cost
- **Statuses:** `pending` → `unpaid` → `partially_paid` → `paid` | `waived`
- **Payment tracking:** `liability_amount`, `amount_paid`, `balance`, `paid_quantity`
- **Payment history:** Separate `damage_payments` table for installment tracking

#### Requests Table (State Machine)
- **Valid transitions:**
  - `pending` → `approved`, `rejected`, `allocated`
  - `approved` → `allocated`
  - `rejected` / `allocated` — terminal states (no further transitions)
- **Allocation:** Creating an allocation automatically creates a stock-out record and decrements inventory

#### Activity Logs
- **Retention:** configurable cleanup (90 days via DELETE)
- **Storage:** Lightweight log with user_id, action, module, description, ip_address

---

## 4. Backend Architecture

### 4.1 Server Entry Point

**File:** `backend/server.js`

The Express application is initialized with:

```javascript
// Middleware stack (order matters):
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// All route modules mounted:
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/items', require('./routes/items'));
// ... 15 additional route modules ...

// Global error handler (catch-all)
app.use((err, req, res, next) => {
  res.status(500).json({ message: 'Internal server error.' });
});
```

**Key design decisions:**
- CORS is configured from `FRONTEND_URL` env var (defaults to `http://localhost:5173`)
- Static `/uploads` serves item images
- Global error handler prevents stack traces from leaking to clients
- Health check at `GET /api/health`

### 4.2 Configuration

**File:** `backend/config/db.js`

MySQL connection pool (mysql2/promise) with the following defaults:

| Variable | Default |
|----------|---------|
| `DB_HOST` | localhost |
| `DB_PORT` | 3306 |
| `DB_NAME` | mizero_inventory |
| `DB_USER` | root |
| `DB_PASSWORD` | (empty) |

Pool settings: 10 connection limit, queue enabled, keep-alive enabled.

### 4.3 Middleware Layer

#### Authentication (`middleware/auth.js`)
- Extracts JWT from `Authorization: Bearer <token>` header or `?token=` query parameter
- Verifies token with `JWT_SECRET` (from `.env`)
- Validates user exists and is active (`status = 'active'`)
- Loads user's department assignments from `user_departments` table into `req.user.department_ids`
- Attaches full user object (id, full_name, email, role_id, role_name, department_ids) to `req.user`
- Returns 401 for missing/invalid/expired tokens

#### Authorization/RBAC (`middleware/rbac.js`)
- Accepts variadic role names: `authorize('super_admin', 'admin')`
- Checks `req.user.role_name` against allowed roles
- Returns 403 with the user's role and required roles on failure

#### Validation (`middleware/validate.js`)
- Processes `express-validator` validation results
- Returns 400 with structured errors: `[{ field, message }]`

### 4.4 Utility Modules

#### Activity Logger (`utils/activityLogger.js`)
```javascript
logActivity(userId, action, module, description, ipAddress = null)
```
- Inserts a row into `activity_logs`
- Silent failure (logs error to console, does not throw) — non-critical path

#### Notification Helper (`utils/notificationHelper.js`)
Three functions:
1. **`createNotification(userId, title, message, module, referenceId)`** — Single user notification
2. **`notifyManagement(title, message, module, referenceId, excludeUserId)`** — All super_admin/admin/stock_manager users
3. **`notifyLowStock(item)`** — Low stock alert to management users

#### Super Admin Guard (`utils/superAdminGuard.js`)
Comprehensive protection system (see Section 7 for full details). Provides guard functions:
- `guardCreateSuperAdmin(roleId, adminUserId, ipAddress)`
- `guardUpdateSuperAdmin(targetUserId, changes, adminUserId, ipAddress)`
- `guardDeleteSuperAdmin(targetUserId, adminUserId, ipAddress)`
- `guardResetSuperAdminPassword(targetUserId, adminUserId, ipAddress)`

Plus audit logging via `super_admin_audit_log` table.

### 4.5 API Routes

All routes follow the pattern:
```javascript
router.use(authenticate);           // JWT required
router.get('/', getX);              // Public within auth
router.post('/', authorize('role'), [...validation], validate, createX);
router.put('/:id', authorize('role'), [...validation], validate, updateX);
router.delete('/:id', authorize('role'), deleteX);
```

| Route Module | Base Path | Allowed Roles (Create/Write) | Special Features |
|-------------|-----------|------------------------------|------------------|
| `auth` | `/api/auth` | Public (login), all (profile) | Rate limiting (10/15min), password strength validation |
| `items` | `/api/items` | super_admin, admin, stock_manager | Image upload (multer), CSV import/export, template download |
| `stockIn` | `/api/stock-in` | super_admin, admin, stock_manager | PDF receipt |
| `stockOut` | `/api/stock-out` | super_admin, admin, stock_manager | PDF receipt |
| `adjustments` | `/api/adjustments` | super_admin, admin, stock_manager | — |
| `borrowings` | `/api/borrowings` | super_admin, admin, stock_manager | Overdue checking, PDF receipt |
| `returns` | `/api/returns` | super_admin, admin, stock_manager | Only 'good' condition allowed |
| `requests` | `/api/requests` | All (create), manager (review) | State machine, auto stock-out on allocate |
| `leftovers` | `/api/leftovers` | super_admin, admin, stock_manager | — |
| `damageLiabilities` | `/api/damage-liabilities` | super_admin, admin, stock_manager | Payments, waivers, 4 report types |
| `departments` | `/api/departments` | super_admin, admin (C/U), super_admin (D) | — |
| `users` | `/api/users` | super_admin, admin | Multi-department assignments |
| `budgets` | `/api/budgets` | super_admin, admin | — |
| `dashboard` | `/api/dashboard` | All authenticated | Aggregated metrics |
| `reports` | `/api/reports` | super_admin, admin, stock_manager | 10 report endpoints |
| `notifications` | `/api/notifications` | All authenticated | Unread count, bulk read, cleanup |
| `activityLogs` | `/api/activity-logs` | super_admin, admin, stock_manager (R) | Cleanup (admin+) |
| `backup` | `/api/backups` | super_admin (only) | Full SQL export |

### 4.6 Controllers

Each controller follows consistent patterns:

- **Try-catch at controller level** — all errors return 500 with generic message
- **Pagination support** — most list endpoints accept `page`, `limit`, `search`, `from`, `to`, `sortBy`, `sortOrder`
- **Sort whitelist** — `sortBy` parameter is validated against an allowed column map to prevent SQL injection
- **Department scoping** — `stock_manager` role is scoped to their assigned departments via `department_ids`
- **Staff restrictions** — `staff` role cannot see item quantities, costs, or prices (fields are stripped from responses)
- **Activity logging** — every mutation logs to `activity_logs`
- **Notification triggers** — low stock, requests, liabilities all trigger notifications

#### Inventory Controller (`itemController.js`) — Key Details

- **SKU generation:** `INV-{base36_timestamp}-{random_4_uppercase_chars}`
- **Quantity immutability via PUT:** The `updateItem` endpoint explicitly does NOT allow quantity changes. All quantity changes go through stock-in, stock-out, or adjustments to maintain audit trail integrity
- **Soft-delete:** Items are soft-deleted (set `deleted_at = NOW()`), never physically removed
- **CSV Import:** Full validation engine with per-row errors, department name→ID lookup, duplicate strategy (skip/update), transaction safety
- **CSV Export:** Filters by department/category, computes `total_value`
- **Template:** Auto-fills department names from database

#### Dashboard Controller (`dashboardController.js`) — Metrics

The dashboard aggregates 20+ metrics in a single query batch:

| Metric | Source |
|--------|--------|
| Total items | `COUNT(*) FROM items` |
| Total stock quantity | `SUM(quantity)` |
| Total inventory value | `SUM(quantity * unit_cost)` |
| Low stock items | `COUNT WHERE quantity <= minimum_stock` |
| Borrowed items | `COUNT WHERE status='borrowed'` |
| Pending requests | `COUNT WHERE status='pending'` |
| COGS this month | `SUM(quantity * unit_cost_at_time) FROM stock_out` |
| Gross margin | `SUM(quantity * (selling_price - unit_cost))` |
| Revenue | `SUM(quantity * selling_price)` |
| Borrowed asset value | `SUM(total_replacement_value)` |
| Damaged/lost costs | `SUM(replacement_cost)` by liability_type |
| Liability metrics | Outstanding, paid, damage cases, loss cases |
| Budget summary | Total budget vs used for current fiscal year |
| 7-day stock in/out chart | UNION ALL of stock_in/stock_out grouped by date |
| Category distribution | GROUP BY category |

#### Stock In Controller (`stockInController.js`) — AVCO

The AVCO (Weighted Average Cost) recalculation happens after every stock-in:

```sql
UPDATE items i
JOIN (
  SELECT item_id,
    ROUND(COALESCE(SUM(quantity * unit_price) / NULLIF(SUM(quantity), 0), 0), 2) AS new_avg
  FROM stock_in
  WHERE item_id = ?
  GROUP BY item_id
) avg ON avg.item_id = i.id
SET i.unit_cost = avg.new_avg
WHERE i.id = ?
```

This ensures that `unit_cost` always reflects the weighted average purchase price. Stock adjustments do NOT recalculate AVCO — they only correct quantities.

#### Damage Liability Controller (`damageLiabilityController.js`) — Payment Logic

The liability system enforces:
1. **Liability creation:** When a borrowed item is returned damaged (50% of replacement cost) or lost (100%)
2. **Quantity validation:** Total accounted (returned + damaged) cannot exceed borrowed quantity
3. **Payment processing:** Partial payments are supported via `recordPayment` with balance tracking
4. **Status transitions:** `pending` → `partially_paid` → `paid` | `waived`
5. **Borrowing status update:** When all items are accounted for, the borrowing status changes to 'damaged' or 'lost'
6. **Notifications:** Both the creator and management users are notified on every payment/status change

#### Request Controller (`requestController.js`) — State Machine

The request system implements a strict state machine:

```
                ┌───→ approved ───→ allocated
pending ────────┤
                ├───→ rejected (terminal)
                └───→ allocated (terminal)
```

- Only `pending` requests can be cancelled (by requester or manager)
- `approved` requests can only transition to `allocated`
- `rejected` and `allocated` are terminal states
- Allocation automatically creates a `stock_out` record and decrements inventory

---

## 5. Frontend Architecture

### 5.1 Application Entry & Routing

**File:** `frontend/src/main.jsx`
```javascript
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

**File:** `frontend/src/App.jsx` — Route definitions:

| Path | Page Component | Access |
|------|---------------|--------|
| `/login` | `Login` | Public (redirects to /dashboard if logged in) |
| `/dashboard` | `Dashboard` | Authenticated |
| `/analytics` | `Analytics` | Authenticated |
| `/inventory` | `Inventory` | Authenticated |
| `/stock-in` | `StockIn` | Authenticated |
| `/stock-out` | `StockOut` | Authenticated |
| `/adjustments` | `Adjustments` | Authenticated |
| `/borrowings` | `Borrowings` | Authenticated |
| `/returns` | `Returns` | Authenticated |
| `/requests` | `Requests` | Authenticated |
| `/leftovers` | `Leftovers` | Authenticated |
| `/damage-liabilities` | `DamageLiabilities` | Authenticated |
| `/budget` | `Budget` | Authenticated |
| `/reports` | `Reports` | Authenticated |
| `/departments` | `Departments` | Authenticated |
| `/users` | `Users` | Authenticated |
| `/activity-logs` | `ActivityLogs` | Authenticated |
| `/notifications` | `Notifications` | Authenticated |
| `/profile` | `Profile` | Authenticated |
| `/` | Redirect to `/dashboard` | — |
| `*` | Redirect to `/dashboard` | — |

**Route guards:**
- `ProtectedRoute` — checks `useAuth()` for user, shows spinner while loading, redirects to `/login` if not authenticated
- `PublicRoute` — redirects to `/dashboard` if user is already authenticated

### 5.2 Authentication Context

**File:** `frontend/src/context/AuthContext.jsx`

Provides:
- **`user`**: Current user object (id, full_name, email, role, role_id, department_ids)
- **`loading`**: Boolean, true during initial auth check
- **`login(email, password)`**: POST to `/auth/login`, stores token + user in localStorage
- **`logout()`**: Clears localStorage, resets user to null
- **`hasRole(...roles)`**: Checks if current user has one of the specified roles
- **`getUserDepartments()`**: Returns array of department IDs the user belongs to

**Initialization flow:**
1. On mount, checks localStorage for existing token/user
2. If found, calls `GET /auth/me` to validate the token and get fresh user data
3. On failure, auto-logs out

### 5.3 Layout & Navigation

**File:** `frontend/src/layouts/MainLayout.jsx`

- **Sidebar:** 64-column width, responsive (overlay on mobile, fixed on desktop)
- **Menu items filtered by role:** Each menu item has a `roles` array; items only show if the user has a matching role
- **Header:** Mobile hamburger menu, search shortcut hint (Ctrl+K), notification bell
- **Command Palette:** Ctrl+K opens a fuzzy-search palette for navigating to any page or creating new records
- **User section:** Avatar (first letter), user name, role, logout button

### 5.4 Shared Components

#### DataTable (`components/DataTable.jsx`)
A highly reusable table component with:
- **Column definition:** `[{ key, label, sortable, render, className, hideOnMobile }]`
- **Sorting:** Client-side sorting with ascending/descending toggle
- **Search:** Integrated search input with debounced onChange
- **Filters:** Filter button that toggles filter selects
- **Bulk actions:** Checkbox selection with action buttons (configurable colors)
- **Pagination:** Page navigation with ellipsis for large page sets
- **Export:** Integrated export button
- **Row click:** Optional row click handler
- **Loading state:** Animated skeleton rows
- **Empty state:** Icon + message display

#### Modal (`components/Modal.jsx`)
- Sizes: `sm` (max-w-md), `md` (max-w-lg), `lg` (max-w-2xl), `xl` (max-w-4xl)
- Backdrop click to close
- Header with title and close button
- Scrollable body (max-height 90vh)

#### Pagination (`components/Pagination.jsx`)
- Simple Prev/Next with page number buttons
- Ellipsis for large page counts
- Hidden when pages <= 1

#### SearchBar (`components/SearchBar.jsx`)
- Search input with loading spinner
- Clear button when value is present
- Quick filter buttons (toggleable)
- Active filter chips with remove buttons
- Ctrl+L keyboard shortcut to focus
- Focus ring animation

#### LoadingSkeleton (`components/LoadingSkeleton.jsx`)
- `Skeleton` — base pulse animation element
- `SkeletonTable` — table-shaped skeleton (rows × columns)
- `SkeletonCard` — card grid skeleton (configurable count)
- `SkeletonChart` — bar chart skeleton
- `SkeletonLine` — single line skeleton

#### CommandPalette (`components/CommandPalette.jsx`)
- Ctrl+K / Cmd+K keyboard shortcut
- Fuzzy search across all pages and actions
- Keyboard navigation (↑↓ to move, Enter to select, Esc to close)
- Results organized as pages and shortcuts
- Footer with keyboard shortcut hints

### 5.5 Pages

Each page follows consistent patterns:
- **Fetch on mount:** `useEffect` + `api.get()` pattern
- **Loading state:** Skeleton components during fetch
- **Error state:** Toast notifications on API errors
- **CRUD via modals:** Create/Edit forms in Modal components
- **Data display:** DataTable for tabular data
- **Pagination:** Server-side pagination via query params

Key pages with special features:

| Page | Special Features |
|------|-----------------|
| **Inventory** | CSV import modal (3-step: upload → preview → result), template download, column visibility toggles |
| **Dashboard** | Stat cards, 7-day stock chart, category pie chart, recent activity, low stock alerts |
| **Stock In** | Receipt download (PDF), AVCO cost display |
| **Stock Out** | Insufficient stock validation, COGS/margin display |
| **Borrowings** | Overdue detection, borrowing receipt, remaining quantity tracking |
| **Returns** | Quantity validation against borrowed amount, only 'good' condition accepted |
| **Requests** | Status badges, review modal (approve/reject/allocate), state machine enforcement |
| **Damage Liabilities** | Multi-step: select return → liability type → amounts, partial payment, waive |
| **Users** | Multi-department assignment via checkboxes, role selection |
| **Profile** | Password change, profile edit, database backup (System Admin card) |
| **Reports** | 10 report types with generated-by metadata, JSON display |

---

## 6. Role-Based Access Control (RBAC)

### 6.1 Roles & Capabilities

| Role | Level | Description | Can |
|------|-------|-------------|-----|
| `super_admin` | 1 (highest) | Full system access | Everything, including database backup, department deletion, user management |
| `admin` | 2 | Manage users, departments, inventory | Everything except super_admin-protected operations |
| `stock_manager` | 3 | Full inventory operations | Stock in/out, adjustments, borrowing, requests, activity logs — **scoped to assigned departments** |
| `staff` | 4 (lowest) | View & request | Create requests, view assigned inventory (**without quantities/costs**), notifications |

### 6.2 Department Scoping

`stock_manager` users are restricted to their assigned departments:
- They can only see items/transactions in departments they belong to (via `user_departments` join table)
- This is enforced through `department_ids` array on `req.user` and SQL `WHERE department_id IN (?)` conditions
- Applied in: items, stock-in, stock-out, borrowings, returns queries

### 6.3 Staff Restrictions

`staff` users cannot see sensitive inventory data:
- Item quantities, minimum_stock, unit_cost, selling_price are stripped from responses
- They can only see item names, descriptions, categories, and departments
- They can only see their own requests

---

## 7. Super Admin Protection System

### 7.1 Overview

The Super Admin protection system (`utils/superAdminGuard.js`) ensures the integrity of the highest-privilege account through multiple layers of protection:

### 7.2 Guards

| Guard | What it prevents | Error Message |
|-------|-----------------|---------------|
| `guardCreateSuperAdmin` | Creating a second Super Admin account | "Only one Super Admin is permitted" |
| `guardUpdateSuperAdmin` | Changing Super Admin's role, status, or department | "Super Admin role is protected" / "cannot be deactivated" |
| `guardDeleteSuperAdmin` | Deactivating/deleting the Super Admin | "Super Admin account is protected and cannot be deleted" |
| `guardResetSuperAdminPassword` | Any user except Super Admin resetting their password | "Only the Super Admin can change their own password" |

### 7.3 Audit Trail

All blocked attempts are logged to both:
1. **`super_admin_audit_log`** — Detailed audit with actor, action, target, status ('blocked'/'allowed')
2. **`activity_logs`** — Standard activity log with 'super_admin_violation' action and 'security' module

---

## 8. API Endpoint Reference

### Authentication

| Method | Endpoint | Auth | Rate Limited | Description |
|--------|----------|------|-------------|-------------|
| POST | `/api/auth/login` | Public | Yes (10/15min) | Login with email + password |
| GET | `/api/auth/me` | Bearer | — | Get current user profile |
| PUT | `/api/auth/change-password` | Bearer | — | Change own password (requires current) |
| PUT | `/api/auth/reset-password` | Bearer + admin | — | Admin reset another user's password |
| PUT | `/api/auth/profile` | Bearer | — | Update own name/email |

### Dashboard

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/dashboard` | All | Aggregated dashboard metrics |

### Items / Inventory

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/items` | All | List items with search/filter/pagination |
| GET | `/api/items/categories` | All | Get distinct categories |
| GET | `/api/items/export/csv` | admin, stock_manager | Export inventory as CSV |
| GET | `/api/items/export/csv/template` | admin, stock_manager | Download import template |
| GET | `/api/items/:id` | All | Get single item |
| POST | `/api/items` | admin, stock_manager | Create item (multipart with optional image) |
| PUT | `/api/items/:id` | admin, stock_manager | Update item (no quantity changes) |
| DELETE | `/api/items/:id` | super_admin, admin | Soft-delete item |
| POST | `/api/items/import/csv/preview` | admin, stock_manager | Preview CSV import (validate only) |
| POST | `/api/items/import/csv` | admin, stock_manager | Execute CSV import (?strategy=skip\|update) |

### Stock In

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/stock-in` | All | List stock-in records |
| GET | `/api/stock-in/:id/receipt` | All | Get stock-in receipt details |
| POST | `/api/stock-in` | admin, stock_manager | Record stock-in (+ AVCO recalculation) |

### Stock Out

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/stock-out` | All | List stock-out records |
| GET | `/api/stock-out/:id/receipt` | All | Get stock-out receipt details |
| POST | `/api/stock-out` | admin, stock_manager | Record stock-out (+ COGS snapshot) |

### Adjustments

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/adjustments` | All | List adjustments |
| POST | `/api/adjustments` | admin, stock_manager | Create adjustment (+ low stock check) |

### Borrowings

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/borrowings` | All | List borrowings with remaining qty |
| GET | `/api/borrowings/:id/receipt` | All | Get borrowing receipt |
| POST | `/api/borrowings` | admin, stock_manager | Create borrowing (non-consumable only) |
| POST | `/api/borrowings/check-overdue` | super_admin, admin | Auto-mark overdue borrowings |

### Returns

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/returns` | All | List returns (good condition only) |
| POST | `/api/returns` | admin, stock_manager | Record return (good condition → inventory restore) |

### Requests

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/requests` | All (staff: own only) | List requests |
| GET | `/api/requests/:id/receipt` | All | Get request receipt |
| POST | `/api/requests` | All | Create request (staff, admin, manager) |
| PUT | `/api/requests/:id/review` | admin, stock_manager | Review request (approve/reject/allocate) |
| PUT | `/api/requests/:id/cancel` | All own + manager | Cancel pending request |

### Leftovers

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/leftovers` | All | List leftover returns |
| POST | `/api/leftovers` | admin, stock_manager | Record leftover return (+ inventory restore) |

### Damage & Loss Liabilities

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/damage-liabilities` | All | List liabilities |
| GET | `/api/damage-liabilities/:id/receipt` | All | Get liability receipt |
| GET | `/api/damage-liabilities/:id/payments` | All | Get payment history |
| POST | `/api/damage-liabilities` | admin, stock_manager | Create liability (damaged/lost) |
| POST | `/api/damage-liabilities/:id/pay` | admin, stock_manager | Record partial payment |
| PUT | `/api/damage-liabilities/:id/pay` | admin, stock_manager | Mark as paid (full remaining) |
| POST | `/api/damage-liabilities/:id/waive` | super_admin, admin | Waive liability |
| GET | `/api/damage-liabilities/reports/damage` | admin, stock_manager | Damage report |
| GET | `/api/damage-liabilities/reports/loss` | admin, stock_manager | Loss report |
| GET | `/api/damage-liabilities/reports/outstanding` | admin, stock_manager | Outstanding report |
| GET | `/api/damage-liabilities/reports/paid` | admin, stock_manager | Paid report |

### Departments

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/departments` | All | List departments |
| GET | `/api/departments/:id` | All | Get department |
| POST | `/api/departments` | super_admin, admin | Create department |
| PUT | `/api/departments/:id` | super_admin, admin | Update department |
| DELETE | `/api/departments/:id` | super_admin | Delete department (if no items) |

### Users

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/users` | super_admin, admin | List users with department assignments |
| GET | `/api/users/roles` | super_admin, admin | Get all roles |
| GET | `/api/users/:id/departments` | super_admin, admin | Get user's department IDs |
| POST | `/api/users` | super_admin, admin | Create user (+ multi-dept assignment) |
| PUT | `/api/users/:id` | super_admin, admin | Update user (+ multi-dept) |
| DELETE | `/api/users/:id` | super_admin, admin | Deactivate user (soft-delete via status) |

### Budgets

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/budgets` | super_admin, admin | List budgets with amount_used |
| GET | `/api/budgets/summary` | super_admin, admin | Budget summary (total, used, remaining %) |
| POST | `/api/budgets` | super_admin, admin | Create budget |
| PUT | `/api/budgets/:id` | super_admin, admin | Update budget |
| DELETE | `/api/budgets/:id` | super_admin, admin | Delete budget |

### Reports

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/reports/inventory-status` | admin, stock_manager | Inventory status report |
| GET | `/api/reports/stock-in` | admin, stock_manager | Stock in report |
| GET | `/api/reports/stock-out` | admin, stock_manager | Stock out report |
| GET | `/api/reports/adjustments` | admin, stock_manager | Adjustments report |
| GET | `/api/reports/borrowings` | admin, stock_manager | Borrowings report |
| GET | `/api/reports/returns` | admin, stock_manager | Returns report |
| GET | `/api/reports/requests` | admin, stock_manager | Requests report |
| GET | `/api/reports/leftovers` | admin, stock_manager | Leftovers report |
| GET | `/api/reports/damage-liabilities` | admin, stock_manager | Damage liabilities report |
| GET | `/api/reports/budgets` | admin, stock_manager | Budget report |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user's notifications (last 50) |
| GET | `/api/notifications/unread-count` | Get unread count |
| PUT | `/api/notifications/:id/read` | Mark notification as read |
| PUT | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/cleanup` | Delete read notifications > 30 days (admin+) |

### Activity Logs

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/activity-logs` | admin, stock_manager | List activity logs |
| DELETE | `/api/activity-logs/cleanup` | super_admin, admin | Delete logs > 90 days |

### Database Backup

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/backups/database` | super_admin (only) | Generate and download full SQL backup |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (status, timestamp) |

---

## 9. CSV Import/Export System

### 9.1 Template Download

**Endpoint:** `GET /api/items/export/csv/template`

Downloads a CSV template (`inventory-import-template.csv`) with:
- Header row: `sku,name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency`
- Example data rows with department names auto-filled from the database
- Valid department names from the live database

### 9.2 Import Preview

**Endpoint:** `POST /api/items/import/csv/preview`

- Parses CSV with `csv-parse/sync` (supports relaxed column count)
- Validates every row against the validation engine
- Checks for: required fields, SKU uniqueness (DB + intra-CSV), department name validity, numeric ranges, currency/enum values
- Returns: `{ totalRows, validCount, invalidCount, validRows[], invalidRows[] }`
- Row-level errors with field name and descriptive message

### 9.3 Import Execution

**Endpoint:** `POST /api/items/import/csv?strategy=skip|update`

- Transaction-safe: all-or-nothing via `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`
- Two strategies:
  - **`skip` (default):** Rows with existing SKUs are skipped (counted, not inserted)
  - **`update`:** Rows with existing SKUs are updated (name, category, quantity, costs, etc.)
- New items use the CSV SKU (no auto-generation if SKU is provided)
- Department lookup by **name** (not numeric ID)
- Returns: `{ totalRows, inserted, updated, skipped, invalidSkipped, errors[] }`

### 9.4 Validation Engine (`validateImportRow`)

| Field | Validation Rules |
|-------|-----------------|
| `sku` | Required, must be unique in DB (checked per strategy) |
| `name` | Required |
| `quantity` | Required, must be non-negative integer |
| `minimum_stock` | Required, must be non-negative integer |
| `unit_cost` | Required, must be non-negative number |
| `currency` | Required, must be RWF/USD/EUR |
| `item_type` | Required, must be "consumable" or "non-consumable" |
| `department` | Required, must match an existing department **name** |

### 9.5 CSV Export

**Endpoint:** `GET /api/items/export/csv`

- Exports all items (with optional department/category filters)
- Includes computed `total_value` column: `quantity * unit_cost`
- Downloads as `inventory.csv` with Content-Disposition header

---

## 10. Database Backup System

### 10.1 Overview

The backup system uses **pure Node.js** to generate SQL exports (no `mysqldump` dependency). Implemented in `backend/controllers/backupController.js`.

### 10.2 Process

1. Connect to database via connection pool
2. Query `SHOW TABLES` to auto-discover all tables (future-proof)
3. For each table:
   - `SHOW CREATE TABLE` to get the CREATE statement
   - `SELECT *` to get all data
   - Batch INSERTs (50 rows per batch) for manageable file sizes
4. Wrap in `SET FOREIGN_KEY_CHECKS = 0/1` for safe restoration
5. Prepend `DROP TABLE IF EXISTS` for idempotent restore
6. Save file to `database backup/` directory
7. Send as download with `Content-Type: application/sql`

### 10.3 File Naming

Format: `mizerohub_backup_YYYY_MM_DD_HHMMSS.sql`

Example: `mizerohub_backup_2026_06_14_154500.sql`

### 10.4 Security

- **Only `super_admin`** can trigger backups (via `authorize('super_admin')`)
- Activity is logged to `activity_logs` with filename and user details

---

## 11. Notifications System

### 11.1 Trigger Points

| Trigger | Module | Recipients | Message Template |
|---------|--------|------------|------------------|
| Low stock | `inventory` | Management | "Item X has low stock. Current: Y, Min: Z" |
| New request | `requests` | Management | "User requested Qty of Item" |
| Request reviewed | `requests` | Requester | "Your request has been approved/rejected/allocated" |
| Request cancelled | `requests` | Requester | "Your request has been cancelled" |
| Damage reported | `damage_liabilities` | Creator + Management | "Qty of item reported damaged" |
| Loss reported | `damage_liabilities` | Creator + Management | "Qty of item reported lost" |
| Payment recorded | `damage_liabilities` | Creator + Management | "Payment recorded, status: partially paid" |
| Liability paid | `damage_liabilities` | Creator + Management | "Liability fully paid" |
| Liability waived | `damage_liabilities` | Creator | "Liability waived" |

### 11.2 Cleanup

Old read notifications are automatically cleaned: `DELETE WHERE is_read = 1 AND created_at < NOW() - 30 DAYS`

---

## 12. Activity Logging

Every data mutation in the system is logged to the `activity_logs` table via the `logActivity()` utility:

```javascript
logActivity(userId, action, module, description, ipAddress)
```

| Module | Sample Actions |
|--------|---------------|
| `auth` | login, change_password, reset_password, update_profile |
| `inventory` | create, update, delete, stock_in, stock_out, adjustment, import_csv |
| `departments` | create, update, delete |
| `users` | create_user, update_user, deactivate_user |
| `borrowing` | borrow |
| `returns` | return |
| `requests` | create_request, review_request, cancel_request |
| `damage_liabilities` | damage_report, loss_report, liability_payment, liability_waived |
| `budgets` | create_budget, update_budget, delete_budget |
| `admin` | backup_database |
| `security` | super_admin_violation |

**Retention:** Logs older than 90 days are cleaned up via the cleanup endpoint.

---

## 13. Security Considerations

### 13.1 Authentication
- JWT-based with configurable expiry (default: 24h)
- Password hashing with bcrypt (12 rounds)
- Rate limiting on login endpoint (10 attempts per 15 minutes per IP)
- Password strength requirements: 8+ chars, uppercase, number, special character

### 13.2 Authorization
- Role-based middleware on every write endpoint
- Department-scoped access for stock_manager role
- Super Admin protection guards on all user management operations
- Staff role cannot see inventory quantities or costs

### 13.3 Input Validation
- `express-validator` for all JSON/form inputs
- SQL injection prevention via parameterized queries (mysql2 prepared statements)
- Sort column whitelisting prevents injection via `sortBy`/`sortOrder`
- Multer file size limits: 10MB for CSVs, 5MB for images
- Multer file type validation: images restricted to jpg/png/gif/webp

### 13.4 Data Integrity
- Soft-delete for items preserves historical relationships
- AVCO recalculation only on stock-in (not adjustments)
- Quantity changes only through stock-in/out/adjustments (not direct item edit)
- Transaction safety for CSV import (all-or-nothing rollback)
- Borrowing status enforcement via returns + liabilities accounting
- Request state machine prevents invalid transitions

### 13.5 Audit
- Every mutation logged to activity_logs
- Super Admin violations logged to dedicated audit table
- Activity log retention: 90 days
- Notification cleanup: 30 days

---

## 14. Seed Data & Default Accounts

All seeded users have password: **`password123`**

| Name | Email | Role | Department |
|------|-------|------|------------|
| Super Admin | `admin@mizero.com` | super_admin | None |
| John Stock Manager | `john@mizero.com` | stock_manager | IT Department |
| Sarah Stock | `stock@mizero.com` | stock_manager | General Store |
| Mike Staff | `staff@mizero.com` | staff | HR |

### Sample Data
- 5 departments: General Store, IT, HR, Finance, Operations
- 8 sample items across 4 categories (Office Supplies, Electronics, Cleaning, Furniture)
- 4 stock-in records, 3 stock-out records
- 2 active borrowings, 2 pending requests
- Sample activity logs and notifications

---

## 15. Development & Deployment

### 15.1 Prerequisites
- Node.js 18+
- MySQL 8+
- npm

### 15.2 Environment Variables

Create `backend/.env`:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=mizero_inventory
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h
FRONTEND_URL=http://localhost:5173
```

### 15.3 Setup

```bash
# 1. Database setup
mysql -u root -p < backend/database/schema.sql
mysql -u root -p < backend/database/seed.sql

# 2. Backend
cd backend
npm install
npm run dev    # or: npm start

# 3. Frontend
cd frontend
npm install
npm run dev    # starts at http://localhost:5173
```

### 15.4 Available Scripts

**Backend:**
| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `node server.js` | Production start |
| `npm run dev` | `nodemon server.js` | Development with auto-restart |

**Frontend:**
| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `vite` | Development server (port 5173) |
| `npm run build` | `vite build` | Production build to `dist/` |
| `npm run preview` | `vite preview` | Preview production build |

### 15.5 API Proxy

During development, Vite proxies `/api` requests to `http://localhost:5000` (configured in `vite.config.js`), so the frontend can make API calls without CORS issues.

### 15.6 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express | 4.21 |
| Database | MySQL | 8+ |
| ORM/Driver | mysql2 | 3.11 |
| Auth | jsonwebtoken + bcryptjs | Latest |
| Validation | express-validator | 7.2 |
| CSV | csv-parse + csv-stringify | 5.5/6.5 |
| PDF | pdfkit | 0.15 |
| File Upload | multer | 1.4 |
| Frontend | React | 18.3 |
| Routing | react-router-dom | 6.26 |
| Styling | Tailwind CSS | 3.4 |
| HTTP Client | Axios | 1.7 |
| Charts | Chart.js + react-chartjs-2 | 4.4/5.2 |
| Icons | react-icons (Heroicons) | 5.3 |
| Forms | react-hook-form | 7.53 |
| Toasts | react-hot-toast | 2.4 |
| Build | Vite | 5.4 |

---

*Documentation generated from the codebase on June 14, 2026.*
