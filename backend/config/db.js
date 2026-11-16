const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'billing_book_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  dateStrings: true
};

let pool = null;
let isConnected = false;
let connectionError = null;

// Built-in Seed fallback storage if MySQL service is not yet started in XAMPP
const fallbackStore = {
  users: [
    {
      id: 1,
      name: 'Admin User',
      email: 'admin@billingbook.com',
      password_hash: '$2a$10$wTqS8QoX08xV91VjEegkbeFp7E3i98oN.Zq64oJSmB/L0gN6dC/3W',
      role: 'admin',
      created_at: new Date().toISOString()
    }
  ],
  settings: {
    id: 1,
    user_id: 1,
    company_name: 'Billing Book Tech Pvt Ltd',
    company_tagline: 'Smart Invoicing, Inventory & Accounting',
    email: 'support@billingbook.com',
    phone: '+91 98765 43210',
    address: '402, Trade Pinnacle Hub, Bandra-Kurla Complex, Mumbai, MH - 400051',
    gstin: '27AABCB1234F1Z9',
    pan: 'AABCB1234F',
    logo_url: '',
    currency_symbol: '₹',
    currency_code: 'INR',
    default_tax_rate: 18.00,
    invoice_prefix: 'INV-',
    quotation_prefix: 'QT-',
    default_terms: '1. Payment is due within 15 days of invoice date.\n2. Interest @ 18% p.a. will be levied on overdue invoices.\n3. Goods once sold will not be accepted back.',
    bank_name: 'HDFC Bank Ltd',
    bank_account_no: '50200078945612',
    bank_ifsc: 'HDFC0000123',
    bank_upi: 'billingbook@upi'
  },
  customers: [
    {
      id: 1,
      user_id: 1,
      name: 'Rahul Sharma',
      company: 'Sharma Infotech Pvt Ltd',
      email: 'rahul@sharmainfotech.com',
      phone: '+91 98200 11223',
      billing_address: 'Suite 101, Cyber City, Gurgaon, Haryana',
      shipping_address: 'Suite 101, Cyber City, Gurgaon, Haryana',
      gstin: '06AAACS1429B1ZT',
      pan: 'AAACS1429B',
      notes: 'Key Enterprise Client',
      created_at: '2026-11-01 10:00:00'
    },
    {
      id: 2,
      user_id: 1,
      name: 'Priya Patel',
      company: 'Aura Retail Enterprises',
      email: 'priya@auraretail.in',
      phone: '+91 97123 45678',
      billing_address: 'Plot 45, SG Highway, Ahmedabad, Gujarat',
      shipping_address: 'Plot 45, SG Highway, Ahmedabad, Gujarat',
      gstin: '24AAACP5566C1ZY',
      pan: 'AAACP5566C',
      notes: 'Retail distributor',
      created_at: '2026-11-02 11:30:00'
    },
    {
      id: 3,
      user_id: 1,
      name: 'David Miller',
      company: 'Apex Cloud Services',
      email: 'david@apexcloud.io',
      phone: '+1 415 555 2671',
      billing_address: '500 Howard Street, San Francisco, CA 94105',
      shipping_address: '500 Howard Street, San Francisco, CA 94105',
      gstin: '',
      pan: '',
      notes: 'International client',
      created_at: '2026-11-03 14:00:00'
    }
  ],
  products: [
    {
      id: 1,
      user_id: 1,
      name: 'Web Development & UI Design Package',
      sku: 'SRV-WEB-01',
      category: 'Services',
      unit: 'hrs',
      unit_price: 2500.00,
      cost_price: 1000.00,
      tax_rate: 18.00,
      stock_quantity: 100,
      reorder_level: 10,
      description: 'Full stack web application development and UI design services'
    },
    {
      id: 2,
      user_id: 1,
      name: 'Enterprise Cloud Server (Monthly)',
      sku: 'SRV-CLD-02',
      category: 'Cloud Hosting',
      unit: 'months',
      unit_price: 4500.00,
      cost_price: 2800.00,
      tax_rate: 18.00,
      stock_quantity: 50,
      reorder_level: 5,
      description: 'High performance 8-core CPU 32GB RAM dedicated cloud instance'
    },
    {
      id: 3,
      user_id: 1,
      name: 'Logitech MX Master 3S Wireless Mouse',
      sku: 'HW-LOG-03',
      category: 'Hardware',
      unit: 'pcs',
      unit_price: 7999.00,
      cost_price: 5800.00,
      tax_rate: 18.00,
      stock_quantity: 18,
      reorder_level: 5,
      description: 'Quiet clicks ergonomic performance mouse'
    },
    {
      id: 4,
      user_id: 1,
      name: 'Dell UltraSharp 27 4K Monitor',
      sku: 'HW-DEL-04',
      category: 'Hardware',
      unit: 'pcs',
      unit_price: 38500.00,
      cost_price: 29000.00,
      tax_rate: 18.00,
      stock_quantity: 4,
      reorder_level: 5,
      description: 'U2723QE 4K UHD USB-C Hub Monitor (Low Stock Alert)'
    },
    {
      id: 5,
      user_id: 1,
      name: 'Annual Maintenance & Support Contract',
      sku: 'SRV-AMC-05',
      category: 'Support',
      unit: 'yr',
      unit_price: 15000.00,
      cost_price: 6000.00,
      tax_rate: 18.00,
      stock_quantity: 30,
      reorder_level: 5,
      description: '24/7 dedicated engineering support contract'
    }
  ],
  invoices: [
    {
      id: 1,
      user_id: 1,
      customer_id: 1,
      invoice_number: 'INV-2026-001',
      invoice_date: '2026-11-01',
      due_date: '2026-11-16',
      status: 'Paid',
      subtotal: 25000.00,
      discount_percent: 5.00,
      discount_amount: 1250.00,
      tax_amount: 4275.00,
      grand_total: 28025.00,
      amount_paid: 28025.00,
      notes: 'Project milestone 1 completed successfully.',
      payment_terms: 'Payment received via NEFT',
      items: [
        {
          id: 1,
          invoice_id: 1,
          product_id: 1,
          description: 'Web Development & UI Design Package',
          quantity: 10,
          unit_price: 2500.00,
          tax_rate: 18.00,
          tax_amount: 4275.00,
          discount_percent: 5.00,
          total: 28025.00
        }
      ]
    },
    {
      id: 2,
      user_id: 1,
      customer_id: 2,
      invoice_number: 'INV-2026-002',
      invoice_date: '2026-11-05',
      due_date: '2026-11-20',
      status: 'Sent',
      subtotal: 46499.00,
      discount_percent: 0.00,
      discount_amount: 0.00,
      tax_amount: 8369.82,
      grand_total: 54868.82,
      amount_paid: 0.00,
      notes: 'Hardware equipment dispatched with warranty documents.',
      payment_terms: 'Net 15 days',
      items: [
        {
          id: 2,
          invoice_id: 2,
          product_id: 3,
          description: 'Logitech MX Master 3S Wireless Mouse',
          quantity: 1,
          unit_price: 7999.00,
          tax_rate: 18.00,
          tax_amount: 1439.82,
          discount_percent: 0.00,
          total: 9438.82
        },
        {
          id: 3,
          invoice_id: 2,
          product_id: 4,
          description: 'Dell UltraSharp 27 4K Monitor',
          quantity: 1,
          unit_price: 38500.00,
          tax_rate: 18.00,
          tax_amount: 6930.00,
          discount_percent: 0.00,
          total: 45430.00
        }
      ]
    },
    {
      id: 3,
      user_id: 1,
      customer_id: 3,
      invoice_number: 'INV-2026-003',
      invoice_date: '2026-10-15',
      due_date: '2026-10-30',
      status: 'Overdue',
      subtotal: 15000.00,
      discount_percent: 0.00,
      discount_amount: 0.00,
      tax_amount: 2700.00,
      grand_total: 17700.00,
      amount_paid: 0.00,
      notes: 'Quarterly cloud maintenance billing.',
      payment_terms: 'Net 15 days',
      items: [
        {
          id: 4,
          invoice_id: 3,
          product_id: 5,
          description: 'Annual Maintenance & Support Contract',
          quantity: 1,
          unit_price: 15000.00,
          tax_rate: 18.00,
          tax_amount: 2700.00,
          discount_percent: 0.00,
          total: 17700.00
        }
      ]
    }
  ],
  quotations: [
    {
      id: 1,
      user_id: 1,
      customer_id: 1,
      quotation_number: 'QT-2026-001',
      quotation_date: '2026-11-10',
      valid_until: '2026-11-25',
      status: 'Pending',
      subtotal: 50000.00,
      discount_percent: 10.00,
      discount_amount: 5000.00,
      tax_amount: 8100.00,
      grand_total: 53100.00,
      notes: 'Proposal for phase 2 system architecture and scalability testing.',
      terms: 'Valid for 15 calendar days.',
      items: [
        {
          id: 1,
          quotation_id: 1,
          product_id: 1,
          description: 'Web Development & UI Design Package (Phase 2)',
          quantity: 20,
          unit_price: 2500.00,
          tax_rate: 18.00,
          tax_amount: 8100.00,
          discount_percent: 10.00,
          total: 53100.00
        }
      ]
    }
  ]
};

async function initDatabase() {
  try {
    console.log(`[DB] Attempting MySQL connection to ${dbConfig.host}:${dbConfig.port}...`);
    
    // Connect without database first to ensure it exists
    const rootConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true
    });

    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConnection.end();

    // Now initialize pool with database
    pool = mysql.createPool(dbConfig);
    const testConn = await pool.getConnection();
    testConn.release();

    // Execute schema if needed
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      console.log('[DB] Schema and initial seed verified/executed successfully.');
    } else {
      // Fallback check root schema.sql
      const rootSchema = path.join(__dirname, '../../schema.sql');
      if (fs.existsSync(rootSchema)) {
        const sql = fs.readFileSync(rootSchema, 'utf8');
        await pool.query(sql);
        console.log('[DB] Root schema verified/executed successfully.');
      }
    }

    isConnected = true;
    connectionError = null;
    console.log(`[DB] Connected successfully to MySQL database "${dbConfig.database}"!`);
  } catch (err) {
    isConnected = false;
    connectionError = err.message;
    console.warn(`[DB] MySQL not currently reachable (${err.message}).`);
    console.warn('[DB] Operating in resilient mode. To use MySQL, start XAMPP / MariaDB on port 3306.');
    
    // Auto-retry connection every 8 seconds in background
    setTimeout(initDatabase, 8000);
  }
}

// Initial attempt
initDatabase();

async function query(sql, params = []) {
  if (isConnected && pool) {
    try {
      const [results] = await pool.query(sql, params);
      return results;
    } catch (err) {
      console.error('[DB Query Error]:', err.message);
      throw err;
    }
  }
  return null;
}

function getStatus() {
  return {
    isMySQLConnected: isConnected,
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    error: connectionError,
    activeMode: isConnected ? 'MySQL' : 'Local Resilient Fallback'
  };
}

module.exports = {
  pool,
  query,
  getStatus,
  fallbackStore,
  initDatabase,
  isMySQLConnected: () => isConnected
};

