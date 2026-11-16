const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { status, customer_id, search, from_date, to_date } = req.query;

    if (db.isMySQLConnected()) {
      let sql = `
        SELECT i.*, 
               c.name as customer_name, c.company as customer_company, c.email as customer_email, c.phone as customer_phone
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.user_id = ?
      `;
      const params = [userId];

      if (status && status !== 'All') {
        sql += ' AND i.status = ?';
        params.push(status);
      }

      if (customer_id) {
        sql += ' AND i.customer_id = ?';
        params.push(customer_id);
      }

      if (search) {
        sql += ' AND (i.invoice_number LIKE ? OR c.name LIKE ? OR c.company LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      if (from_date) {
        sql += ' AND i.invoice_date >= ?';
        params.push(from_date);
      }

      if (to_date) {
        sql += ' AND i.invoice_date <= ?';
        params.push(to_date);
      }

      sql += ' ORDER BY i.invoice_date DESC, i.id DESC';
      const [invoices] = await db.pool.query(sql, params);
      return res.json({ success: true, invoices });
    } else {
      let invoices = db.fallbackStore.invoices.filter(i => i.user_id === userId);

      if (status && status !== 'All') {
        invoices = invoices.filter(i => i.status === status);
      }

      if (customer_id) {
        invoices = invoices.filter(i => i.customer_id === parseInt(customer_id, 10));
      }

      if (search) {
        const term = search.toLowerCase();
        invoices = invoices.filter(i => {
          const cust = db.fallbackStore.customers.find(c => c.id === i.customer_id);
          const custName = cust ? cust.name.toLowerCase() : '';
          const custComp = cust && cust.company ? cust.company.toLowerCase() : '';
          return i.invoice_number.toLowerCase().includes(term) || custName.includes(term) || custComp.includes(term);
        });
      }

      const enriched = invoices.map(i => {
        const cust = db.fallbackStore.customers.find(c => c.id === i.customer_id) || {};
        return {
          ...i,
          customer_name: cust.name || 'Unknown',
          customer_company: cust.company || '',
          customer_email: cust.email || '',
          customer_phone: cust.phone || ''
        };
      }).sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));

      return res.json({ success: true, invoices: enriched });
    }
  } catch (err) {
    console.error('Invoice getAll error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch invoices.', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;

    if (db.isMySQLConnected()) {
      const [invs] = await db.pool.query(`
        SELECT i.*, 
               c.name as customer_name, c.company as customer_company, c.email as customer_email, 
               c.phone as customer_phone, c.billing_address, c.shipping_address, c.gstin as customer_gstin, c.pan as customer_pan
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.id = ? AND i.user_id = ?
      `, [id, userId]);

      if (!invs || invs.length === 0) {
        return res.status(404).json({ success: false, message: 'Invoice not found.' });
      }

      const invoice = invs[0];
      const [items] = await db.pool.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC', [id]);
      invoice.items = items;

      // Also get settings for invoice header / footer / print
      const [settings] = await db.pool.query('SELECT * FROM settings WHERE user_id = ? LIMIT 1', [userId]);
      invoice.company = settings && settings.length > 0 ? settings[0] : {};

      return res.json({ success: true, invoice });
    } else {
      const invoice = db.fallbackStore.invoices.find(i => i.id === parseInt(id, 10) && i.user_id === userId);
      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Invoice not found.' });
      }

      const cust = db.fallbackStore.customers.find(c => c.id === invoice.customer_id) || {};
      const fullInvoice = {
        ...invoice,
        customer_name: cust.name || '',
        customer_company: cust.company || '',
        customer_email: cust.email || '',
        customer_phone: cust.phone || '',
        billing_address: cust.billing_address || '',
        shipping_address: cust.shipping_address || '',
        customer_gstin: cust.gstin || '',
        customer_pan: cust.pan || '',
        items: invoice.items || [],
        company: db.fallbackStore.settings
      };

      return res.json({ success: true, invoice: fullInvoice });
    }
  } catch (err) {
    console.error('Invoice getById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch invoice.', error: err.message });
  }
};

exports.getNextNumber = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    let prefix = 'INV-';
    let count = 1;

    if (db.isMySQLConnected()) {
      const [settings] = await db.pool.query('SELECT invoice_prefix FROM settings WHERE user_id = ? LIMIT 1', [userId]);
      if (settings.length > 0 && settings[0].invoice_prefix) {
        prefix = settings[0].invoice_prefix;
      }

      const [rows] = await db.pool.query('SELECT COUNT(*) as count FROM invoices WHERE user_id = ?', [userId]);
      count = (rows[0].count || 0) + 1;
    } else {
      prefix = db.fallbackStore.settings.invoice_prefix || 'INV-';
      count = db.fallbackStore.invoices.length + 1;
    }

    const currentYear = new Date().getFullYear();
    const formattedNum = `${prefix}${currentYear}-${String(count).padStart(3, '0')}`;
    return res.json({ success: true, nextNumber: formattedNum });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate invoice number.' });
  }
};

exports.create = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    let {
      customer_id,
      invoice_number,
      invoice_date,
      due_date,
      status,
      discount_percent,
      notes,
      payment_terms,
      amount_paid,
      items
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'Please select a customer.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one line item is required.' });
    }

    invoice_date = invoice_date || new Date().toISOString().split('T')[0];
    status = status || 'Draft';
    discount_percent = parseFloat(discount_percent || 0);
    amount_paid = parseFloat(amount_paid || 0);

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;

    const processedItems = items.map(item => {
      const qty = parseFloat(item.quantity || 1);
      const price = parseFloat(item.unit_price || 0);
      const taxRate = parseFloat(item.tax_rate || 0);
      const itemDiscount = parseFloat(item.discount_percent || 0);

      const baseAmount = qty * price;
      const discountVal = (baseAmount * itemDiscount) / 100;
      const taxableAmount = baseAmount - discountVal;
      const taxAmount = (taxableAmount * taxRate) / 100;
      const lineTotal = taxableAmount + taxAmount;

      subtotal += baseAmount;
      totalTax += taxAmount;

      return {
        product_id: item.product_id || null,
        description: item.description || 'Custom Item',
        quantity: qty,
        unit_price: price,
        tax_rate: taxRate,
        tax_amount: parseFloat(taxAmount.toFixed(2)),
        discount_percent: itemDiscount,
        total: parseFloat(lineTotal.toFixed(2))
      };
    });

    const discountAmount = parseFloat(((subtotal * discount_percent) / 100).toFixed(2));
    const grandTotal = parseFloat((subtotal - discountAmount + totalTax).toFixed(2));

    if (!invoice_number) {
      const currentYear = new Date().getFullYear();
      invoice_number = `INV-${currentYear}-${Date.now().toString().slice(-4)}`;
    }

    if (amount_paid >= grandTotal && grandTotal > 0) {
      status = 'Paid';
    }

    if (db.isMySQLConnected()) {
      const connection = await db.pool.getConnection();
      try {
        await connection.beginTransaction();

        const [invResult] = await connection.query(`
          INSERT INTO invoices (
            user_id, customer_id, invoice_number, invoice_date, due_date, status,
            subtotal, discount_percent, discount_amount, tax_amount, grand_total, amount_paid, notes, payment_terms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          userId, customer_id, invoice_number, invoice_date, due_date || null, status,
          subtotal, discount_percent, discountAmount, totalTax, grandTotal, amount_paid, notes || '', payment_terms || ''
        ]);

        const invoiceId = invResult.insertId;

        for (const item of processedItems) {
          await connection.query(`
            INSERT INTO invoice_items (
              invoice_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, discount_percent, total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoiceId, item.product_id, item.description, item.quantity, item.unit_price, item.tax_rate, item.tax_amount, item.discount_percent, item.total
          ]);

          // Deduct stock if product_id is specified
          if (item.product_id) {
            await connection.query(`
              UPDATE products 
              SET stock_quantity = GREATEST(0, stock_quantity - ?)
              WHERE id = ? AND user_id = ?
            `, [item.quantity, item.product_id, userId]);
          }
        }

        await connection.commit();
        connection.release();

        return res.status(201).json({
          success: true,
          message: 'Invoice created successfully.',
          invoice_id: invoiceId,
          invoice_number
        });
      } catch (err) {
        await connection.rollback();
        connection.release();
        throw err;
      }
    } else {
      const newInvoice = {
        id: db.fallbackStore.invoices.length + 1,
        user_id: userId,
        customer_id: parseInt(customer_id, 10),
        invoice_number,
        invoice_date,
        due_date,
        status,
        subtotal,
        discount_percent,
        discount_amount: discountAmount,
        tax_amount: totalTax,
        grand_total: grandTotal,
        amount_paid,
        notes: notes || '',
        payment_terms: payment_terms || '',
        items: processedItems.map((itm, idx) => ({ id: idx + 1, ...itm }))
      };

      db.fallbackStore.invoices.push(newInvoice);

      // Deduct stock in fallback
      processedItems.forEach(item => {
        if (item.product_id) {
          const p = db.fallbackStore.products.find(prod => prod.id === item.product_id);
          if (p) p.stock_quantity = Math.max(0, p.stock_quantity - item.quantity);
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Invoice created successfully.',
        invoice_id: newInvoice.id,
        invoice_number
      });
    }
  } catch (err) {
    console.error('Invoice create error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create invoice.', error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;
    const { status, amount_paid } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    if (db.isMySQLConnected()) {
      let sql = 'UPDATE invoices SET status = ?';
      const params = [status];

      if (amount_paid !== undefined) {
        sql += ', amount_paid = ?';
        params.push(amount_paid);
      }

      sql += ' WHERE id = ? AND user_id = ?';
      params.push(id, userId);

      await db.pool.query(sql, params);
      return res.json({ success: true, message: `Invoice updated to ${status}.` });
    } else {
      const inv = db.fallbackStore.invoices.find(i => i.id === parseInt(id, 10) && i.user_id === userId);
      if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found.' });

      inv.status = status;
      if (amount_paid !== undefined) inv.amount_paid = parseFloat(amount_paid);
      if (status === 'Paid') inv.amount_paid = inv.grand_total;

      return res.json({ success: true, message: `Invoice updated to ${status}.` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update invoice status.' });
  }
};

exports.delete = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;

    if (db.isMySQLConnected()) {
      await db.pool.query('DELETE FROM invoices WHERE id = ? AND user_id = ?', [id, userId]);
      return res.json({ success: true, message: 'Invoice deleted successfully.' });
    } else {
      const idx = db.fallbackStore.invoices.findIndex(i => i.id === parseInt(id, 10) && i.user_id === userId);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Invoice not found.' });
      db.fallbackStore.invoices.splice(idx, 1);
      return res.json({ success: true, message: 'Invoice deleted successfully.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete invoice.' });
  }
};

