-- =======================================================
-- BILLING BOOK - Relational Database Schema (MySQL / MariaDB)
-- Database: billing_book_db
-- =======================================================

CREATE DATABASE IF NOT EXISTS `billing_book_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `billing_book_db`;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) DEFAULT 'admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. SETTINGS TABLE (Business Profile, GST, Prefixes & Print Defaults)
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT 1,
  `company_name` VARCHAR(150) NOT NULL DEFAULT 'Billing Book Solutions',
  `company_tagline` VARCHAR(255) DEFAULT 'Smart Invoicing, Inventory & Accounting',
  `email` VARCHAR(120) DEFAULT 'billing@mycompany.com',
  `phone` VARCHAR(50) DEFAULT '+91 98765 43210',
  `address` TEXT,
  `gstin` VARCHAR(50) DEFAULT '27AAAAA0000A1Z5',
  `pan` VARCHAR(50) DEFAULT 'AAAAA0000A',
  `logo_url` TEXT,
  `currency_symbol` VARCHAR(10) DEFAULT '₹',
  `currency_code` VARCHAR(10) DEFAULT 'INR',
  `default_tax_rate` DECIMAL(5,2) DEFAULT 18.00,
  `invoice_prefix` VARCHAR(20) DEFAULT 'INV-',
  `quotation_prefix` VARCHAR(20) DEFAULT 'QT-',
  `default_terms` TEXT,
  `bank_name` VARCHAR(100) DEFAULT 'HDFC Bank',
  `bank_account_no` VARCHAR(50) DEFAULT '50200012345678',
  `bank_ifsc` VARCHAR(50) DEFAULT 'HDFC0001234',
  `bank_upi` VARCHAR(100) DEFAULT 'billingbook@upi',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT 1,
  `name` VARCHAR(150) NOT NULL,
  `company` VARCHAR(150),
  `email` VARCHAR(120),
  `phone` VARCHAR(50),
  `billing_address` TEXT,
  `shipping_address` TEXT,
  `gstin` VARCHAR(50),
  `pan` VARCHAR(50),
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. PRODUCTS & INVENTORY TABLE
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT 1,
  `name` VARCHAR(150) NOT NULL,
  `sku` VARCHAR(50) UNIQUE,
  `category` VARCHAR(100) DEFAULT 'General',
  `unit` VARCHAR(30) DEFAULT 'pcs',
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cost_price` DECIMAL(12,2) DEFAULT 0.00,
  `tax_rate` DECIMAL(5,2) DEFAULT 18.00,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `reorder_level` INT NOT NULL DEFAULT 5,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. INVOICES TABLE
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT 1,
  `customer_id` INT NOT NULL,
  `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
  `invoice_date` DATE NOT NULL,
  `due_date` DATE,
  `status` ENUM('Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled') DEFAULT 'Draft',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_percent` DECIMAL(5,2) DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) DEFAULT 0.00,
  `grand_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `amount_paid` DECIMAL(12,2) DEFAULT 0.00,
  `notes` TEXT,
  `payment_terms` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. INVOICE ITEMS TABLE
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_id` INT NOT NULL,
  `product_id` INT NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_rate` DECIMAL(5,2) DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) DEFAULT 0.00,
  `discount_percent` DECIMAL(5,2) DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS `quotations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT 1,
  `customer_id` INT NOT NULL,
  `quotation_number` VARCHAR(50) NOT NULL UNIQUE,
  `quotation_date` DATE NOT NULL,
  `valid_until` DATE,
  `status` ENUM('Draft', 'Sent', 'Accepted', 'Rejected', 'Converted', 'Expired') DEFAULT 'Draft',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_percent` DECIMAL(5,2) DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) DEFAULT 0.00,
  `grand_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `converted_invoice_id` INT NULL,
  `notes` TEXT,
  `terms` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. QUOTATION ITEMS TABLE
CREATE TABLE IF NOT EXISTS `quotation_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quotation_id` INT NOT NULL,
  `product_id` INT NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_rate` DECIMAL(5,2) DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) DEFAULT 0.00,
  `discount_percent` DECIMAL(5,2) DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================
-- INITIAL SEED DATA
-- Default Admin User: admin@billingbook.com / admin123
-- Password hash generated with bcrypt (10 rounds)
-- =======================================================
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`)
VALUES (1, 'Admin User', 'admin@billingbook.com', '$2a$10$wTqS8QoX08xV91VjEegkbeFp7E3i98oN.Zq64oJSmB/L0gN6dC/3W', 'admin')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

INSERT INTO `settings` (
  `id`, `user_id`, `company_name`, `company_tagline`, `email`, `phone`, `address`, `gstin`, `pan`,
  `currency_symbol`, `currency_code`, `default_tax_rate`, `invoice_prefix`, `quotation_prefix`,
  `default_terms`, `bank_name`, `bank_account_no`, `bank_ifsc`, `bank_upi`
) VALUES (
  1, 1, 'Billing Book Tech Pvt Ltd', 'Next-Gen Invoicing & Financial Operations',
  'support@billingbook.com', '+91 98765 43210',
  '402, Trade Pinnacle Hub, Bandra-Kurla Complex, Mumbai, MH - 400051',
  '27AABCB1234F1Z9', 'AABCB1234F',
  '₹', 'INR', 18.00, 'INV-', 'QT-',
  '1. Payment is due within 15 days of invoice date.\n2. Interest @ 18% p.a. will be levied on overdue invoices.\n3. Goods once sold will not be accepted back.',
  'HDFC Bank Ltd', '50200078945612', 'HDFC0000123', 'billingbook@upi'
) ON DUPLICATE KEY UPDATE `company_name`=VALUES(`company_name`);

-- Sample Customers
INSERT INTO `customers` (`id`, `user_id`, `name`, `company`, `email`, `phone`, `billing_address`, `shipping_address`, `gstin`, `notes`)
VALUES
(1, 1, 'Rahul Sharma', 'Sharma Infotech Pvt Ltd', 'rahul@sharmainfotech.com', '+91 98200 11223', 'Suite 101, Cyber City, Gurgaon, Haryana', 'Suite 101, Cyber City, Gurgaon, Haryana', '06AAACS1429B1ZT', 'Key Enterprise Client'),
(2, 1, 'Priya Patel', 'Aura Retail Enterprises', 'priya@auraretail.in', '+91 97123 45678', 'Plot 45, SG Highway, Ahmedabad, Gujarat', 'Plot 45, SG Highway, Ahmedabad, Gujarat', '24AAACP5566C1ZY', 'Retail distributor'),
(3, 1, 'David Miller', 'Apex Cloud Services', 'david@apexcloud.io', '+1 415 555 2671', '500 Howard Street, San Francisco, CA 94105', '500 Howard Street, San Francisco, CA 94105', '', 'International client')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Sample Products & Inventory
INSERT INTO `products` (`id`, `user_id`, `name`, `sku`, `category`, `unit`, `unit_price`, `cost_price`, `tax_rate`, `stock_quantity`, `reorder_level`, `description`)
VALUES
(1, 1, 'Web Development & UI Design Package', 'SRV-WEB-01', 'Services', 'hrs', 2500.00, 1000.00, 18.00, 100, 10, 'Full stack web application development and UI design services'),
(2, 1, 'Enterprise Cloud Server (Monthly)', 'SRV-CLD-02', 'Cloud Hosting', 'months', 4500.00, 2800.00, 18.00, 50, 5, 'High performance 8-core CPU 32GB RAM dedicated cloud instance'),
(3, 1, 'Logitech MX Master 3S Wireless Mouse', 'HW-LOG-03', 'Hardware', 'pcs', 7999.00, 5800.00, 18.00, 18, 5, 'Quiet clicks ergonomic performance mouse'),
(4, 1, 'Dell UltraSharp 27 4K Monitor', 'HW-DEL-04', 'Hardware', 'pcs', 38500.00, 29000.00, 18.00, 4, 5, 'U2723QE 4K UHD USB-C Hub Monitor (Low Stock Alert)'),
(5, 1, 'Annual Maintenance & Support Contract', 'SRV-AMC-05', 'Support', 'yr', 15000.00, 6000.00, 18.00, 30, 5, '24/7 dedicated engineering support contract')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Sample Invoices
INSERT INTO `invoices` (`id`, `user_id`, `customer_id`, `invoice_number`, `invoice_date`, `due_date`, `status`, `subtotal`, `discount_percent`, `discount_amount`, `tax_amount`, `grand_total`, `amount_paid`, `notes`, `payment_terms`)
VALUES
(1, 1, 1, 'INV-2026-001', '2026-11-01', '2026-11-16', 'Paid', 25000.00, 5.00, 1250.00, 4275.00, 28025.00, 28025.00, 'Project milestone 1 completed successfully.', 'Payment received via NEFT'),
(2, 1, 2, 'INV-2026-002', '2026-11-05', '2026-11-20', 'Sent', 46499.00, 0.00, 0.00, 8369.82, 54868.82, 0.00, 'Hardware equipment dispatched with warranty documents.', 'Net 15 days'),
(3, 1, 3, 'INV-2026-003', '2026-10-15', '2026-10-30', 'Overdue', 15000.00, 0.00, 0.00, 2700.00, 17700.00, 0.00, 'Quarterly cloud maintenance billing.', 'Net 15 days')
ON DUPLICATE KEY UPDATE `invoice_number`=VALUES(`invoice_number`);

-- Sample Invoice Items
INSERT INTO `invoice_items` (`id`, `invoice_id`, `product_id`, `description`, `quantity`, `unit_price`, `tax_rate`, `tax_amount`, `discount_percent`, `total`)
VALUES
(1, 1, 1, 'Web Development & UI Design Package', 10.00, 2500.00, 18.00, 4275.00, 5.00, 28025.00),
(2, 2, 3, 'Logitech MX Master 3S Wireless Mouse', 1.00, 7999.00, 18.00, 1439.82, 0.00, 9438.82),
(3, 2, 4, 'Dell UltraSharp 27 4K Monitor', 1.00, 38500.00, 18.00, 6930.00, 0.00, 45430.00),
(4, 3, 5, 'Annual Maintenance & Support Contract', 1.00, 15000.00, 18.00, 2700.00, 0.00, 17700.00)
ON DUPLICATE KEY UPDATE `description`=VALUES(`description`);

-- Sample Quotation
INSERT INTO `quotations` (`id`, `user_id`, `customer_id`, `quotation_number`, `quotation_date`, `valid_until`, `status`, `subtotal`, `discount_percent`, `discount_amount`, `tax_amount`, `grand_total`, `notes`, `terms`)
VALUES
(1, 1, 1, 'QT-2026-001', '2026-11-10', '2026-11-25', 'Pending', 50000.00, 10.00, 5000.00, 8100.00, 53100.00, 'Proposal for phase 2 system architecture and scalability testing.', 'Valid for 15 calendar days.')
ON DUPLICATE KEY UPDATE `quotation_number`=VALUES(`quotation_number`);

INSERT INTO `quotation_items` (`id`, `quotation_id`, `product_id`, `description`, `quantity`, `unit_price`, `tax_rate`, `tax_amount`, `discount_percent`, `total`)
VALUES
(1, 1, 1, 'Web Development & UI Design Package (Phase 2)', 20.00, 2500.00, 18.00, 8100.00, 10.00, 53100.00)
ON DUPLICATE KEY UPDATE `description`=VALUES(`description`);

