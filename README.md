# 📑 BILLING BOOK - Smart Invoicing & Accounting Web Application

**BILLING BOOK** is a modern, full-stack invoicing, estimates/quotations, inventory tracking, customer management, and billing system.

Built strictly with:
- **Frontend:** Pure **HTML5**, **CSS3**, and **Vanilla JavaScript** (Zero bloated frameworks, lightning-fast SPA architecture).
- **Backend:** **Node.js** with **Express.js** providing a modular RESTful API architecture.
- **Database:** **MySQL / MariaDB** (with complete relational tables, indexing, transactions, and automated fallback/reconnect mechanism).

---

## 🌟 Key Features & Modules

### 1. 🔐 Authentication & Session Security
- Dedicated Login & Registration views.
- **1-Click Quick Demo Login** button (`admin@billingbook.com` / `admin123`).
- **JWT (JSON Web Token)** Bearer token authentication with auto-expiration and session recovery.
- Role-based design (Admin/Manager).

### 2. 📊 Executive Dashboard
- **4 Real-time KPI Metric Cards:**
  - **Total Revenue:** Aggregate billed amount across all invoices.
  - **Total Received / Paid:** Cleared collections.
  - **Unpaid / Due:** Active pending receivables.
  - **Total Customers:** Registered clients.
- **Secondary Metric Badges:** Total Products in stock, Quotations issued, Overdue amounts.
- **Interactive Sales Trends:** Visual monthly revenue bar chart generated cleanly with CSS/SVG.
- **Quick Action Launchers:** Instant 1-click modal shortcuts to Create Invoice, Create Quotation, Add Customer, Add Product.
- **Recent Invoices Table:** Instant overview with status badges and quick view/print buttons.
- **Low Stock Alert Widget:** Real-time indicator for products reaching reorder levels.

### 3. 📄 Tax Invoices Module
- Search invoices by customer name, company, or invoice number.
- Filter invoices by status: `Draft`, `Sent`, `Paid`, `Partially Paid`, `Overdue`, `Cancelled`.
- **Dynamic Invoice Creator:**
  - Customer selection with inline "+ New Customer" shortcut.
  - Auto-generated consecutive invoice numbers (e.g., `INV-2026-001`).
  - Due date calculation.
  - **Dynamic Line Items Generator:** Select items directly from Inventory (auto-populates unit rate, tax rate, and description) or type custom items.
  - Live mathematical calculation of quantity, unit price, item discount %, GST/Tax %, and line totals.
  - Global invoice discount calculation.
  - Automated inventory stock deduction upon issuing invoice.
- **Document Preview & High-Res Print / Save as PDF:**
  - A4 formatted tax invoice compliant with standard invoicing standards.
  - Company branding, address, GSTIN, PAN, and contact details.
  - Bill-To & Ship-To client blocks.
  - Clean itemized tax breakdown.
  - Bank Account, IFSC, and UPI receiving details.
  - Terms & Conditions and Authorized Signatory box.
  - Dedicated `@media print` CSS so clicking **"Print / Save as PDF"** or pressing `Ctrl + P` generates a clean PDF without browser UI elements.

### 4. 📋 Quotations / Estimates Module
- Issue client estimates and formal quotations.
- Track quotation status: `Draft`, `Sent`, `Accepted`, `Rejected`, `Converted`, `Expired`.
- **⚡ 1-Click "Convert to Invoice" Action:** Converts an accepted quotation directly into an active Tax Invoice, transfers all line items, deducts inventory stock, marks quotation as `Converted`, and immediately opens the printable invoice!

### 5. 📦 Inventory & Stock Management
- Add and manage products and billable services.
- Tracks: SKU / Item Code, Category, Unit of Measurement (e.g., `pcs`, `hrs`, `kg`, `month`), Selling Price, Cost Price, Tax Rate %, Current Stock Quantity, and Low-Stock Reorder Level.
- **Inline Quick Stock Adjustment:** Quick `+` and `-` buttons in the table for rapid stock adjustments.
- Low-stock badge warnings for items at or below reorder thresholds.

### 6. 👥 Customer Management & Client Ledger
- Client profiles: Name, Company, Phone, Email, GSTIN, PAN, Billing Address, Shipping Address, and Notes.
- Computes aggregate metrics: Total Invoices Count, Total Billed Amount, and Outstanding Balance.
- **Customer Account Ledger Modal:** Click the ledger icon on any customer to see their complete chronological invoice history and running statement.

### 7. ⚙️ Business Settings & Configuration
- **Company Profile:** Business name, tagline, email, phone, physical address, GSTIN, and PAN.
- **Invoicing Defaults:** Currency Symbol (`₹`, `$`, `€`, `£`), Currency Code (`INR`, `USD`), Default Tax Rate (e.g., 18%), Invoice prefix (`INV-`), Quotation prefix (`QT-`).
- **Payment & Banking:** Bank name, Account number, IFSC code, and UPI ID.
- **Terms & Conditions:** Customizable standard terms printed on all client documents.
- **Live Database Connection Status:** Displays live MySQL connection parameters and health diagnostics.

---

## 🏗️ Project Architecture & File Structure

```
BILLING_BOOK/
├── backend/
│   ├── config/
│   │   ├── db.js                 # MySQL pool connection + auto-reconnect + auto table init
│   │   └── schema.sql            # MySQL schema DDL script and seed data
│   ├── controllers/
│   │   ├── authController.js     # User login, registration, JWT session verification
│   │   ├── dashboardController.js# Aggregates KPI metrics, revenue stats, trends
│   │   ├── invoiceController.js  # Invoice CRUD, item rows, stock updates, number generation
│   │   ├── quotationController.js# Quotation CRUD & 1-click convert to invoice
│   │   ├── customerController.js # Client CRUD & ledger statements
│   │   ├── productController.js  # Inventory CRUD & stock adjustments
│   │   └── settingsController.js # Business configuration & bank details
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT Bearer token validator
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── invoiceRoutes.js
│   │   ├── quotationRoutes.js
│   │   ├── customerRoutes.js
│   │   ├── productRoutes.js
│   │   └── settingsRoutes.js
│   ├── server.js                 # Express server & static frontend host
│   └── .env                      # Database credentials and environment variables
│
├── public/                       # FRONTEND (ONLY HTML, CSS, JAVASCRIPT)
│   ├── index.html                # Single-page web application UI
│   ├── css/
│   │   ├── style.css             # Layout, responsive sidebar, typography, color palette
│   │   ├── components.css        # Buttons, cards, modals, tables, badges, toast notifications
│   │   └── print.css             # A4 Tax invoice print & PDF export styling
│   └── js/
│       ├── api.js                # Fetch wrapper with JWT headers and error handling
│       ├── auth.js               # Login, registration, 1-click demo login, session state
│       ├── dashboard.js          # Dashboard KPIs, recent invoices, SVG trend chart
│       ├── invoices.js           # Invoice generator, dynamic line items, print preview
│       ├── quotations.js         # Quotation generator, 1-click convert to invoice
│       ├── inventory.js          # Product management & inline stock adjustments
│       ├── customers.js          # Customer management & client ledger
│       ├── settings.js           # Business configuration loader & saver
│       └── app.js                # Tab router, modals, mobile drawer, toasts
│
├── schema.sql                    # Standalone MySQL import script
├── package.json                  # Node.js dependencies and run scripts
└── README.md                     # Comprehensive documentation
```

---

## 🗄️ MySQL Database Setup

The app connects to **MySQL / MariaDB** (standard port `3306`).

### Method 1: Automatic Setup via App
1. Make sure MySQL is running (e.g., start **MySQL** in **XAMPP Control Panel**, or start MySQL Windows service).
2. The application's `backend/config/db.js` **automatically**:
   - Creates the database `billing_book_db` if it doesn't already exist.
   - Executes `schema.sql` to create all tables and initial seed data.

### Method 2: Manual Import via phpMyAdmin or MySQL Workbench
1. Open **phpMyAdmin** (`http://localhost/phpmyadmin`) or **MySQL Workbench**.
2. Click on the **Import** tab.
3. Choose the file `schema.sql` from `e:\BILLING_BOOK\schema.sql`.
4. Click **Go** / **Execute**.

### Database Configuration (`.env`)
You can customize database connection credentials in `e:\BILLING_BOOK\.env`:
```env
PORT=5000
NODE_ENV=development

# MySQL Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=billing_book_db

# JWT Secret
JWT_SECRET=billing_book_super_secret_jwt_key_2026_xyz
JWT_EXPIRES_IN=7d
```

> **Resilient Connection Feature:** If your local MySQL service is temporarily offline or being started, the app runs in **Resilient Mode** with memory persistence and automatically reconnects in the background every few seconds without crashing. The UI status badge in the header displays live connection status!

---

## 🚀 How to Run the Application

### 1. Install Dependencies
```powershell
npm install
```

### 2. Start the Server
```powershell
npm start
```
The server will output:
```
=======================================================
🚀 BILLING BOOK SERVER RUNNING ON: http://localhost:5000
📊 Mode: development
🗄️  Database Host: 127.0.0.1:3306
📁 Static Frontend: /public
=======================================================
```

### 3. Open in Browser
Visit in Google Chrome, Microsoft Edge, or any modern web browser:
```
http://localhost:5000
```

### 4. Sign In
- **Email:** `admin@billingbook.com`
- **Password:** `admin123`
*(Or simply click the **"⚡ 1-Click Quick Demo Login"** button on the login screen!)*

---

## 🔌 Complete REST API Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/health` | GET | No | Server status & MySQL connection diagnostics |
| `/api/auth/login` | POST | No | User login (returns JWT token & user payload) |
| `/api/auth/register` | POST | No | Register new business user |
| `/api/auth/me` | GET | Yes | Current user session profile |
| `/api/dashboard/stats` | GET | Yes | Real-time KPI summaries, revenue stats & trends |
| `/api/customers` | GET | Yes | Get all customers with balances and billing totals |
| `/api/customers/:id` | GET | Yes | Customer profile with invoice ledger |
| `/api/customers` | POST | Yes | Create a new customer |
| `/api/customers/:id` | PUT | Yes | Update customer details |
| `/api/customers/:id` | DELETE | Yes | Delete customer |
| `/api/products` | GET | Yes | Get inventory products (search, category, low stock) |
| `/api/products/:id` | GET | Yes | Get product by ID |
| `/api/products` | POST | Yes | Create product / service |
| `/api/products/:id` | PUT | Yes | Update product |
| `/api/products/:id` | DELETE | Yes | Delete product |
| `/api/products/:id/stock`| POST | Yes | Adjust stock quantity (`+delta` or `-delta`) |
| `/api/invoices` | GET | Yes | Get invoices with customer join & status filter |
| `/api/invoices/next-number`| GET | Yes | Generate consecutive invoice number |
| `/api/invoices/:id` | GET | Yes | Full invoice details, line items & company info |
| `/api/invoices` | POST | Yes | Create invoice, insert line items & deduct stock |
| `/api/invoices/:id/status`| PATCH | Yes | Update invoice status (`Paid`, `Sent`, etc.) |
| `/api/invoices/:id` | DELETE | Yes | Delete invoice |
| `/api/quotations` | GET | Yes | Get all quotations |
| `/api/quotations/next-number`| GET | Yes | Generate consecutive quotation number |
| `/api/quotations/:id` | GET | Yes | Full quotation preview data |
| `/api/quotations` | POST | Yes | Create new quotation / estimate |
| `/api/quotations/:id/convert`| POST| Yes | **1-Click Convert quotation into formal Invoice** |
| `/api/quotations/:id` | DELETE | Yes | Delete quotation |
| `/api/settings` | GET | Yes | Get company profile, GSTIN, bank & print settings |
| `/api/settings` | PUT | Yes | Update business profile, prefixes and bank details |

