# Mizero Inventory Hub

A complete Inventory Management System built with React, Node.js, Express, and MySQL.

## Features

- **Authentication**: JWT-based login with bcrypt password hashing
- **Role-Based Access Control**: Super Admin, Admin, Manager, Stock Manager, Staff
- **Dashboard**: Stats cards, charts (Stock In vs Out, Category distribution), recent activity
- **Inventory Management**: CRUD, search, filter, pagination, CSV import/export
- **Stock Operations**: Stock In, Stock Out, Adjustments with automatic inventory updates
- **Borrowing System**: Borrow non-consumable items with PDF receipt generation
- **Returns**: Full/partial returns with condition tracking (Good, Damaged, Lost)
- **Stock Requests**: Workflow with approve/reject/allocate
- **Leftover Management**: Return unused issued stock
- **User Management**: Create/edit/deactivate users, assign roles and departments
- **Department Management**: Create/edit/delete departments with manager assignment
- **Notifications**: Low stock alerts, request updates, mark as read
- **Activity Logs**: Track all important actions across modules

## Tech Stack

### Frontend
- React 18 + Vite
- Tailwind CSS
- React Router v6
- Axios
- React Hook Form
- Chart.js + react-chartjs-2
- React Hot Toast
- React Icons

### Backend
- Node.js + Express.js
- MySQL2
- JWT Authentication
- bcryptjs
- PDFKit (PDF generation)
- csv-parse / csv-stringify (CSV import/export)
- express-validator
- multer (file upload)

## Prerequisites

- Node.js 18+ and npm
- MySQL 8+ running locally
- Git (optional)

## Installation

### 1. Clone or Download

```bash
git clone <repository-url>
cd mizero-inventory-hub
```

### 2. Database Setup

Open MySQL command line or MySQL Workbench and run:

```bash
mysql -u root -p < backend/database/schema.sql
mysql -u root -p < backend/database/seed.sql
```

Or run the SQL files in order:
1. `backend/database/schema.sql` - Creates database, tables, and default roles
2. `backend/database/seed.sql` - Inserts sample departments, users, and inventory items

### 3. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and configure your database credentials:

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=mizero_inventory
DB_USER=root
DB_PASSWORD=your_mysql_password
JWT_SECRET=your-random-secret-key-here
```

Then update the user passwords in the database:

```bash
# Start the backend server
npm run dev
```

Use the API to reset passwords for seeded users:
- `POST /api/auth/login` - Login with default credentials
- `PUT /api/auth/reset-password` - Reset user passwords

### 4. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api



> **Note**: Seeded users don't have proper bcrypt hashes. After starting the backend, use the `/api/auth/reset-password` endpoint (accessible by Super Admin) to set passwords for these users. Or log in as a Super Admin via a freshly created user.

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `PUT /api/auth/change-password` - Change password
- `PUT /api/auth/reset-password` - Admin reset password

### Dashboard
- `GET /api/dashboard` - Dashboard stats

### Departments
- `GET /api/departments` - List departments
- `POST /api/departments` - Create department
- `PUT /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Delete department

### Inventory
- `GET /api/items` - List items (search, filter, paginate)
- `GET /api/items/:id` - Get item
- `POST /api/items` - Create item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `GET /api/items/export/csv` - Export CSV
- `POST /api/items/import/csv` - Import CSV
- `GET /api/items/categories` - List categories

### Stock Operations
- `GET/POST /api/stock-in` - Stock In
- `GET/POST /api/stock-out` - Stock Out
- `GET/POST /api/adjustments` - Stock Adjustments

### Borrowing & Returns
- `GET/POST /api/borrowings` - Borrowings
- `GET /api/borrowings/:id/receipt` - Download PDF receipt
- `GET/POST /api/returns` - Returns

### Requests
- `GET/POST /api/requests` - Stock requests
- `PUT /api/requests/:id/review` - Review request

### Leftovers
- `GET/POST /api/leftovers` - Leftover management

### Users
- `GET/POST /api/users` - User management
- `GET /api/users/roles` - List roles
- `PUT/DELETE /api/users/:id` - Update/Deactivate user

### Notifications
- `GET /api/notifications` - List notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read

### Activity Logs
- `GET /api/activity-logs` - List activity logs

## Project Structure

```
mizero-inventory-hub/
├── backend/
│   ├── config/          # Database configuration
│   ├── controllers/     # Route handlers
│   ├── database/        # SQL schema and seed data
│   ├── middleware/      # Auth, RBAC, validation
│   ├── routes/          # Express routes
│   ├── utils/           # Helpers (activity logger, notifications)
│   ├── uploads/         # File upload directory
│   ├── .env.example     # Environment variables template
│   └── server.js        # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components (Modal, Pagination)
│   │   ├── context/     # Auth context
│   │   ├── layouts/     # Main layout with sidebar
│   │   ├── pages/       # All page components
│   │   └── services/    # Axios API service
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

## Upgrading

The project is structured for easy upgrades:

- **Add new module**: Create controller, routes, model query functions, and frontend page
- **Add new role**: Insert into roles table and update RBAC middleware calls
- **Customize UI**: Modify Tailwind config and styles in `index.css`
