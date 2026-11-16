const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { status, search } = req.query;

    if (db.isMySQLConnected()) {
      let sql = `
        SELECT q.*, 
               c.name as customer_name, c.company as customer_company, c.email as customer_email, c.phone as customer_phone
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        WHERE q.user_id = ?
      `;
      const params = [userId];

      if (status && status !== 'All') {
        sql += ' AND q.status = ?';
        params.push(status);
      }

      if (search) {
        sql += ' AND (q.quotation_number LIKE ? OR c.name LIKE ? OR c.company LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      sql += ' ORDER BY q.quotation_date DESC, q.id DESC';
      const [quotations] = await db.pool.query(sql, params);
      return res.json({ success: true, quotations });
    } else {
      let quotes = db.fallbackStore.quotations.filter(q => q.user_id === userId);

      if (status && status !== 'All') {
        quotes = quotes.filter(q => q.status === status);
      }

      if (search) {
        const term = search.toLowerCase();
        quotes = quotes.filter(q => {
          const cust = db.fallbackStore.customers.find(c => c.id === q.customer_id);
          const custName = cust ? cust.name.toLowerCase() : '';
          return q.quotation_number.toLowerCase().includes(term) || custName.includes(term);
        });
      }

      const enriched = quotes.map(q => {
        const cust = db.fallbackStore.customers.find(c => c.id === q.customer_id) || {};
        return {
          ...q,
          customer_name: cust.name || 'Unknown',
          customer_company: cust.company || '',
          customer_email: cust.email || '',
          customer_phone: cust.phone || ''
        };
      }).sort((a, b) => new Date(b.quotation_date) - new Date(a.quotation_date));

      return res.json({ success: true, quotations: enriched });
    }
  } catch (err) {
    console.error('Quotation getAll error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch quotations.', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;

    if (db.isMySQLConnected()) {
      const [quotes] = await db.pool.query(`
        SELECT q.*, 
               c.name as customer_name, c.company as customer_company, c.email as customer_email, 
               c.phone as customer_phone, c.billing_address, c.shipping_address, c.gstin as customer_gstin, c.pan as customer_pan
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        WHERE q.id = ? AND q.user_id = ?
      `, [id, userId]);

      if (!quotes || quotes.length === 0) {
        return res.status(404).json({ success: false, message: 'Quotation not found.' });
      }

      const quote = quotes[0];
      const [items] = await db.pool.query('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC', [id]);
      quote.items = items;

      const [settings] = await db.pool.query('SELECT * FROM settings WHERE user_id = ? LIMIT 1', [userId]);
      quote.company = settings && settings.length > 0 ? settings[0] : {};

      return res.json({ success: true, quotation: quote });
    } else {
      const quote = db.fallbackStore.quotations.find(q => q.id === parseInt(id, 10) && q.user_id === userId);
      if (!quote) return res.status(404).json({ success: false, message: 'Quotation not found.' });

      const cust = db.fallbackStore.customers.find(c => c.id === quote.customer_id) || {};
      const fullQuote = {
        ...quote,
        customer_name: cust.name || '',
        customer_company: cust.company || '',
        customer_email: cust.email || '',
        customer_phone: cust.phone || '',
        billing_address: cust.billing_address || '',
        shipping_address: cust.shipping_address || '',
        customer_gstin: cust.gstin || '',
        customer_pan: cust.pan || '',
        items: quote.items || [],
        company: db.fallbackStore.settings
      };

      return res.json({ success: true, quotation: fullQuote });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch quotation.' });
  }
};

exports.getNextNumber = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    let prefix = 'QT-';
    let count = 1;

    if (db.isMySQLConnected()) {
      const [settings] = await db.pool.query('SELECT quotation_prefix FROM settings WHERE user_id = ? LIMIT 1', [userId]);
      if (settings.length > 0 && settings[0].quotation_prefix) {
        prefix = settings[0].quotation_prefix;
      }
      const [rows] = await db.pool.query('SELECT COUNT(*) as count FROM quotations WHERE user_id = ?', [userId]);
      count = (rows[0].count || 0) + 1;
    } else {
      prefix = db.fallbackStore.settings.quotation_prefix || 'QT-';
      count = db.fallbackStore.quotations.length + 1;
    }

    const currentYear = new Date().getFullYear();
    const formattedNum = `${prefix}${currentYear}-${String(count).padStart(3, '0')}`;
    return res.json({ success: true, nextNumber: formattedNum });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate quotation number.' });
  }
};

exports.create = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    let {
      customer_id,
      quotation_number,
      quotation_date,
      valid_until,
      status,
      discount_percent,
      notes,
      terms,
      items
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'Customer is required.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one line item is required.' });
    }

    quotation_date = quotation_date || new Date().toISOString().split('T')[0];
    status = status || 'Draft';
    discount_percent = parseFloat(discount_percent || 0);

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
        description: item.description || 'Service/Item',
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

    if (!quotation_number) {
      const currentYear = new Date().getFullYear();
      quotation_number = `QT-${currentYear}-${Date.now().toString().slice(-4)}`;
    }

    if (db.isMySQLConnected()) {
      const connection = await db.pool.getConnection();
      try {
        await connection.beginTransaction();

        const [qResult] = await connection.query(`
          INSERT INTO quotations (
            user_id, customer_id, quotation_number, quotation_date, valid_until, status,
            subtotal, discount_percent, discount_amount, tax_amount, grand_total, notes, terms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          userId, customer_id, quotation_number, quotation_date, valid_until || null, status,
          subtotal, discount_percent, discountAmount, totalTax, grandTotal, notes || '', terms || ''
        ]);

        const quotationId = qResult.insertId;

        for (const item of processedItems) {
          await connection.query(`
            INSERT INTO quotation_items (
              quotation_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, discount_percent, total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            quotationId, item.product_id, item.description, item.quantity, item.unit_price, item.tax_rate, item.tax_amount, item.discount_percent, item.total
          ]);
        }

        await connection.commit();
        connection.release();

        return res.status(201).json({
          success: true,
          message: 'Quotation created successfully.',
          quotation_id: quotationId,
          quotation_number
        });
      } catch (err) {
        await connection.rollback();
        connection.release();
        throw err;
      }
    } else {
      const newQuote = {
        id: db.fallbackStore.quotations.length + 1,
        user_id: userId,
        customer_id: parseInt(customer_id, 10),
        quotation_number,
        quotation_date,
        valid_until,
        status,
        subtotal,
        discount_percent,
        discount_amount: discountAmount,
        tax_amount: totalTax,
        grand_total: grandTotal,
        notes: notes || '',
        terms: terms || '',
        items: processedItems.map((itm, idx) => ({ id: idx + 1, ...itm }))
      };

      db.fallbackStore.quotations.push(newQuote);

      return res.status(201).json({
        success: true,
        message: 'Quotation created successfully.',
        quotation_id: newQuote.id,
        quotation_number
      });
    }
  } catch (err) {
    console.error('Quotation create error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create quotation.', error: err.message });
  }
};

// 1-Click Convert Quotation into Formal Invoice!
exports.convertToInvoice = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;

    if (db.isMySQLConnected()) {
      const [quotes] = await db.pool.query('SELECT * FROM quotations WHERE id = ? AND user_id = ?', [id, userId]);
      if (!quotes || quotes.length === 0) {
        return res.status(404).json({ success: false, message: 'Quotation not found.' });
      }

      const quote = quotes[0];
      const [items] = await db.pool.query('SELECT * FROM quotation_items WHERE quotation_id = ?', [id]);

      // Generate invoice number
      const [settings] = await db.pool.query('SELECT invoice_prefix FROM settings WHERE user_id = ? LIMIT 1', [userId]);
      const prefix = settings.length > 0 && settings[0].invoice_prefix ? settings[0].invoice_prefix : 'INV-';
      const [countRows] = await db.pool.query('SELECT COUNT(*) as count FROM invoices WHERE user_id = ?', [userId]);
      const invoiceNumber = `${prefix}${new Date().getFullYear()}-${String((countRows[0].count || 0) + 1).padStart(3, '0')}`;

      const conn = await db.pool.getConnection();
      try {
        await conn.beginTransaction();

        const [invResult] = await conn.query(`
          INSERT INTO invoices (
            user_id, customer_id, invoice_number, invoice_date, due_date, status,
            subtotal, discount_percent, discount_amount, tax_amount, grand_total, notes, payment_terms
          ) VALUES (?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'Sent', ?, ?, ?, ?, ?, ?, ?)
        `, [
          userId, quote.customer_id, invoiceNumber, quote.subtotal, quote.discount_percent,
          quote.discount_amount, quote.tax_amount, quote.grand_total,
          `Converted from Quotation #${quote.quotation_number}. ${quote.notes || ''}`,
          quote.terms || 'Net 15 days'
        ]);

        const invoiceId = invResult.insertId;

        for (const itm of items) {
          await conn.query(`
            INSERT INTO invoice_items (
              invoice_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, discount_percent, total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoiceId, itm.product_id, itm.description, itm.quantity, itm.unit_price, itm.tax_rate, itm.tax_amount, itm.discount_percent, itm.total
          ]);

          if (itm.product_id) {
            await conn.query('UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?', [itm.quantity, itm.product_id]);
          }
        }

        // Update quotation status
        await conn.query('UPDATE quotations SET status = "Converted", converted_invoice_id = ? WHERE id = ?', [invoiceId, id]);

        await conn.commit();
        conn.release();

        return res.json({
          success: true,
          message: `Quotation converted successfully into Invoice #${invoiceNumber}!`,
          invoice_id: invoiceId,
          invoice_number: invoiceNumber
        });
      } catch (err) {
        await conn.rollback();
        conn.release();
        throw err;
      }
    } else {
      const quote = db.fallbackStore.quotations.find(q => q.id === parseInt(id, 10) && q.user_id === userId);
      if (!quote) return res.status(404).json({ success: false, message: 'Quotation not found.' });

      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(db.fallbackStore.invoices.length + 1).padStart(3, '0')}`;
      const newInvoice = {
        id: db.fallbackStore.invoices.length + 1,
        user_id: userId,
        customer_id: quote.customer_id,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        status: 'Sent',
        subtotal: quote.subtotal,
        discount_percent: quote.discount_percent,
        discount_amount: quote.discount_amount,
        tax_amount: quote.tax_amount,
        grand_total: quote.grand_total,
        amount_paid: 0,
        notes: `Converted from Quotation #${quote.quotation_number}. ${quote.notes || ''}`,
        payment_terms: quote.terms || 'Net 15 days',
        items: (quote.items || []).map((itm, idx) => ({ id: idx + 1, ...itm }))
      };

      db.fallbackStore.invoices.push(newInvoice);
      quote.status = 'Converted';
      quote.converted_invoice_id = newInvoice.id;

      return res.json({
        success: true,
        message: `Quotation converted successfully into Invoice #${invoiceNumber}!`,
        invoice_id: newInvoice.id,
        invoice_number: invoiceNumber
      });
    }
  } catch (err) {
    console.error('Convert quotation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to convert quotation.', error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ success: false, message: 'Status is required.' });

    if (db.isMySQLConnected()) {
      await db.pool.query('UPDATE quotations SET status = ? WHERE id = ? AND user_id = ?', [status, id, userId]);
      return res.json({ success: true, message: `Quotation status updated to ${status}.` });
    } else {
      const q = db.fallbackStore.quotations.find(quote => quote.id === parseInt(id, 10) && quote.user_id === userId);
      if (!q) return res.status(404).json({ success: false, message: 'Quotation not found.' });
      q.status = status;
      return res.json({ success: true, message: `Quotation status updated to ${status}.` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update quotation status.' });
  }
};

exports.delete = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;

    if (db.isMySQLConnected()) {
      await db.pool.query('DELETE FROM quotations WHERE id = ? AND user_id = ?', [id, userId]);
      return res.json({ success: true, message: 'Quotation deleted successfully.' });
    } else {
      const idx = db.fallbackStore.quotations.findIndex(q => q.id === parseInt(id, 10) && q.user_id === userId);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Quotation not found.' });
      db.fallbackStore.quotations.splice(idx, 1);
      return res.json({ success: true, message: 'Quotation deleted successfully.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete quotation.' });
  }
};

