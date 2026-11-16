const db = require('../config/db');

exports.getSettings = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;

    if (db.isMySQLConnected()) {
      const [rows] = await db.pool.query('SELECT * FROM settings WHERE user_id = ? LIMIT 1', [userId]);
      if (rows && rows.length > 0) {
        return res.json({ success: true, settings: rows[0] });
      }
      // Insert default if not present
      await db.pool.query('INSERT INTO settings (user_id) VALUES (?)', [userId]);
      const [newRows] = await db.pool.query('SELECT * FROM settings WHERE user_id = ? LIMIT 1', [userId]);
      return res.json({ success: true, settings: newRows[0] });
    } else {
      return res.json({ success: true, settings: db.fallbackStore.settings });
    }
  } catch (err) {
    console.error('Settings get error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch settings.', error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const {
      company_name, company_tagline, email, phone, address, gstin, pan,
      logo_url, currency_symbol, currency_code, default_tax_rate,
      invoice_prefix, quotation_prefix, default_terms,
      bank_name, bank_account_no, bank_ifsc, bank_upi
    } = req.body;

    if (!company_name) {
      return res.status(400).json({ success: false, message: 'Company name is required.' });
    }

    if (db.isMySQLConnected()) {
      await db.pool.query(`
        UPDATE settings SET
          company_name = ?, company_tagline = ?, email = ?, phone = ?, address = ?,
          gstin = ?, pan = ?, logo_url = ?, currency_symbol = ?, currency_code = ?,
          default_tax_rate = ?, invoice_prefix = ?, quotation_prefix = ?, default_terms = ?,
          bank_name = ?, bank_account_no = ?, bank_ifsc = ?, bank_upi = ?
        WHERE user_id = ?
      `, [
        company_name, company_tagline || '', email || '', phone || '', address || '',
        gstin || '', pan || '', logo_url || '', currency_symbol || '₹', currency_code || 'INR',
        parseFloat(default_tax_rate || 18.00), invoice_prefix || 'INV-', quotation_prefix || 'QT-', default_terms || '',
        bank_name || '', bank_account_no || '', bank_ifsc || '', bank_upi || '',
        userId
      ]);

      const [updated] = await db.pool.query('SELECT * FROM settings WHERE user_id = ? LIMIT 1', [userId]);
      return res.json({ success: true, message: 'Settings saved successfully.', settings: updated[0] });
    } else {
      db.fallbackStore.settings = {
        ...db.fallbackStore.settings,
        company_name,
        company_tagline: company_tagline || '',
        email: email || '',
        phone: phone || '',
        address: address || '',
        gstin: gstin || '',
        pan: pan || '',
        logo_url: logo_url || '',
        currency_symbol: currency_symbol || '₹',
        currency_code: currency_code || 'INR',
        default_tax_rate: parseFloat(default_tax_rate || 18.00),
        invoice_prefix: invoice_prefix || 'INV-',
        quotation_prefix: quotation_prefix || 'QT-',
        default_terms: default_terms || '',
        bank_name: bank_name || '',
        bank_account_no: bank_account_no || '',
        bank_ifsc: bank_ifsc || '',
        bank_upi: bank_upi || ''
      };

      return res.json({ success: true, message: 'Settings saved successfully.', settings: db.fallbackStore.settings });
    }
  } catch (err) {
    console.error('Settings update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update settings.', error: err.message });
  }
};

