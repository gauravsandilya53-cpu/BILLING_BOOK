const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const search = req.query.search ? `%${req.query.search}%` : null;

    if (db.isMySQLConnected()) {
      let sql = `
        SELECT c.*,
          COUNT(DISTINCT i.id) as invoice_count,
          COALESCE(SUM(i.grand_total), 0) as total_billed,
          COALESCE(SUM(CASE WHEN i.status != 'Paid' THEN (i.grand_total - i.amount_paid) ELSE 0 END), 0) as outstanding_balance
        FROM customers c
        LEFT JOIN invoices i ON c.id = i.customer_id
        WHERE c.user_id = ?
      `;
      const params = [userId];

      if (search) {
        sql += ` AND (c.name LIKE ? OR c.company LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.gstin LIKE ?)`;
        params.push(search, search, search, search, search);
      }

      sql += ` GROUP BY c.id ORDER BY c.name ASC`;
      const [customers] = await db.pool.query(sql, params);
      return res.json({ success: true, customers });
    } else {
      let customers = db.fallbackStore.customers.filter(c => c.user_id === userId);
      if (req.query.search) {
        const term = req.query.search.toLowerCase();
        customers = customers.filter(c => 
          (c.name && c.name.toLowerCase().includes(term)) ||
          (c.company && c.company.toLowerCase().includes(term)) ||
          (c.email && c.email.toLowerCase().includes(term)) ||
          (c.phone && c.phone.includes(term))
        );
      }

      const enriched = customers.map(c => {
        const invoices = db.fallbackStore.invoices.filter(i => i.customer_id === c.id);
        const totalBilled = invoices.reduce((acc, i) => acc + Number(i.grand_total || 0), 0);
        const outstanding = invoices.reduce((acc, i) => {
          if (i.status === 'Paid') return acc;
          return acc + (Number(i.grand_total || 0) - Number(i.amount_paid || 0));
        }, 0);
        return {
          ...c,
          invoice_count: invoices.length,
          total_billed: totalBilled,
          outstanding_balance: outstanding
        };
      });

      return res.json({ success: true, customers: enriched });
    }
  } catch (err) {
    console.error('Customer getAll error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch customers.', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;

    if (db.isMySQLConnected()) {
      const [customers] = await db.pool.query('SELECT * FROM customers WHERE id = ? AND user_id = ?', [id, userId]);
      if (!customers || customers.length === 0) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }

      const [invoices] = await db.pool.query(
        'SELECT id, invoice_number, invoice_date, due_date, status, grand_total, amount_paid FROM invoices WHERE customer_id = ? ORDER BY invoice_date DESC',
        [id]
      );

      return res.json({ success: true, customer: customers[0], invoices });
    } else {
      const customer = db.fallbackStore.customers.find(c => c.id === parseInt(id, 10) && c.user_id === userId);
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
      const invoices = db.fallbackStore.invoices.filter(i => i.customer_id === parseInt(id, 10));
      return res.json({ success: true, customer, invoices });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customer.', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { name, company, email, phone, billing_address, shipping_address, gstin, pan, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Customer name is required.' });
    }

    if (db.isMySQLConnected()) {
      const [result] = await db.pool.query(`
        INSERT INTO customers (user_id, name, company, email, phone, billing_address, shipping_address, gstin, pan, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [userId, name, company || '', email || '', phone || '', billing_address || '', shipping_address || '', gstin || '', pan || '', notes || '']);

      const [newCust] = await db.pool.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
      return res.status(201).json({ success: true, message: 'Customer created successfully.', customer: newCust[0] });
    } else {
      const newCust = {
        id: db.fallbackStore.customers.length + 1,
        user_id: userId,
        name,
        company: company || '',
        email: email || '',
        phone: phone || '',
        billing_address: billing_address || '',
        shipping_address: shipping_address || '',
        gstin: gstin || '',
        pan: pan || '',
        notes: notes || '',
        created_at: new Date().toISOString()
      };
      db.fallbackStore.customers.push(newCust);
      return res.status(201).json({ success: true, message: 'Customer created successfully.', customer: newCust });
    }
  } catch (err) {
    console.error('Customer create error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create customer.', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;
    const { name, company, email, phone, billing_address, shipping_address, gstin, pan, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Customer name is required.' });
    }

    if (db.isMySQLConnected()) {
      await db.pool.query(`
        UPDATE customers
        SET name = ?, company = ?, email = ?, phone = ?, billing_address = ?, shipping_address = ?, gstin = ?, pan = ?, notes = ?
        WHERE id = ? AND user_id = ?
      `, [name, company || '', email || '', phone || '', billing_address || '', shipping_address || '', gstin || '', pan || '', notes || '', id, userId]);

      const [updated] = await db.pool.query('SELECT * FROM customers WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Customer updated successfully.', customer: updated[0] });
    } else {
      const idx = db.fallbackStore.customers.findIndex(c => c.id === parseInt(id, 10) && c.user_id === userId);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
      db.fallbackStore.customers[idx] = {
        ...db.fallbackStore.customers[idx],
        name,
        company: company || '',
        email: email || '',
        phone: phone || '',
        billing_address: billing_address || '',
        shipping_address: shipping_address || '',
        gstin: gstin || '',
        pan: pan || '',
        notes: notes || ''
      };
      return res.json({ success: true, message: 'Customer updated successfully.', customer: db.fallbackStore.customers[idx] });
    }
  } catch (err) {
    console.error('Customer update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update customer.', error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;

    if (db.isMySQLConnected()) {
      await db.pool.query('DELETE FROM customers WHERE id = ? AND user_id = ?', [id, userId]);
      return res.json({ success: true, message: 'Customer deleted successfully.' });
    } else {
      const idx = db.fallbackStore.customers.findIndex(c => c.id === parseInt(id, 10) && c.user_id === userId);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
      db.fallbackStore.customers.splice(idx, 1);
      return res.json({ success: true, message: 'Customer deleted successfully.' });
    }
  } catch (err) {
    console.error('Customer delete error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete customer.', error: err.message });
  }
};

