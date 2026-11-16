const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { search, category, lowStock } = req.query;

    if (db.isMySQLConnected()) {
      let sql = 'SELECT * FROM products WHERE user_id = ?';
      const params = [userId];

      if (search) {
        sql += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      if (category && category !== 'All') {
        sql += ' AND category = ?';
        params.push(category);
      }

      if (lowStock === 'true') {
        sql += ' AND stock_quantity <= reorder_level';
      }

      sql += ' ORDER BY name ASC';
      const [products] = await db.pool.query(sql, params);
      return res.json({ success: true, products });
    } else {
      let products = db.fallbackStore.products.filter(p => p.user_id === userId);

      if (search) {
        const term = search.toLowerCase();
        products = products.filter(p => 
          (p.name && p.name.toLowerCase().includes(term)) ||
          (p.sku && p.sku.toLowerCase().includes(term))
        );
      }

      if (category && category !== 'All') {
        products = products.filter(p => p.category === category);
      }

      if (lowStock === 'true') {
        products = products.filter(p => p.stock_quantity <= p.reorder_level);
      }

      return res.json({ success: true, products });
    }
  } catch (err) {
    console.error('Product getAll error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory.', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;

    if (db.isMySQLConnected()) {
      const [products] = await db.pool.query('SELECT * FROM products WHERE id = ? AND user_id = ?', [id, userId]);
      if (!products || products.length === 0) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.json({ success: true, product: products[0] });
    } else {
      const product = db.fallbackStore.products.find(p => p.id === parseInt(id, 10) && p.user_id === userId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.json({ success: true, product });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch product.', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    let { name, sku, category, unit, unit_price, cost_price, tax_rate, stock_quantity, reorder_level, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }

    if (!sku || sku.trim() === '') {
      sku = 'SKU-' + Date.now().toString().slice(-6);
    }

    unit_price = parseFloat(unit_price || 0);
    cost_price = parseFloat(cost_price || 0);
    tax_rate = parseFloat(tax_rate !== undefined ? tax_rate : 18.00);
    stock_quantity = parseInt(stock_quantity || 0, 10);
    reorder_level = parseInt(reorder_level !== undefined ? reorder_level : 5, 10);

    if (db.isMySQLConnected()) {
      const [result] = await db.pool.query(`
        INSERT INTO products (user_id, name, sku, category, unit, unit_price, cost_price, tax_rate, stock_quantity, reorder_level, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [userId, name, sku, category || 'General', unit || 'pcs', unit_price, cost_price, tax_rate, stock_quantity, reorder_level, description || '']);

      const [newProd] = await db.pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
      return res.status(201).json({ success: true, message: 'Product added successfully.', product: newProd[0] });
    } else {
      const newProd = {
        id: db.fallbackStore.products.length + 1,
        user_id: userId,
        name,
        sku,
        category: category || 'General',
        unit: unit || 'pcs',
        unit_price,
        cost_price,
        tax_rate,
        stock_quantity,
        reorder_level,
        description: description || '',
        created_at: new Date().toISOString()
      };
      db.fallbackStore.products.push(newProd);
      return res.status(201).json({ success: true, message: 'Product added successfully.', product: newProd });
    }
  } catch (err) {
    console.error('Product create error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create product.', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;
    let { name, sku, category, unit, unit_price, cost_price, tax_rate, stock_quantity, reorder_level, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }

    unit_price = parseFloat(unit_price || 0);
    cost_price = parseFloat(cost_price || 0);
    tax_rate = parseFloat(tax_rate !== undefined ? tax_rate : 18.00);
    stock_quantity = parseInt(stock_quantity || 0, 10);
    reorder_level = parseInt(reorder_level !== undefined ? reorder_level : 5, 10);

    if (db.isMySQLConnected()) {
      await db.pool.query(`
        UPDATE products
        SET name = ?, sku = ?, category = ?, unit = ?, unit_price = ?, cost_price = ?, tax_rate = ?, stock_quantity = ?, reorder_level = ?, description = ?
        WHERE id = ? AND user_id = ?
      `, [name, sku, category || 'General', unit || 'pcs', unit_price, cost_price, tax_rate, stock_quantity, reorder_level, description || '', id, userId]);

      const [updated] = await db.pool.query('SELECT * FROM products WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Product updated successfully.', product: updated[0] });
    } else {
      const idx = db.fallbackStore.products.findIndex(p => p.id === parseInt(id, 10) && p.user_id === userId);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      db.fallbackStore.products[idx] = {
        ...db.fallbackStore.products[idx],
        name,
        sku,
        category: category || 'General',
        unit: unit || 'pcs',
        unit_price,
        cost_price,
        tax_rate,
        stock_quantity,
        reorder_level,
        description: description || ''
      };
      return res.json({ success: true, message: 'Product updated successfully.', product: db.fallbackStore.products[idx] });
    }
  } catch (err) {
    console.error('Product update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update product.', error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;

    if (db.isMySQLConnected()) {
      await db.pool.query('DELETE FROM products WHERE id = ? AND user_id = ?', [id, userId]);
      return res.json({ success: true, message: 'Product deleted successfully.' });
    } else {
      const idx = db.fallbackStore.products.findIndex(p => p.id === parseInt(id, 10) && p.user_id === userId);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      db.fallbackStore.products.splice(idx, 1);
      return res.json({ success: true, message: 'Product deleted successfully.' });
    }
  } catch (err) {
    console.error('Product delete error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete product.', error: err.message });
  }
};

exports.adjustStock = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const { id } = req.params;
    const { delta } = req.body; // e.g. +5 or -2

    const change = parseInt(delta, 10);
    if (isNaN(change)) {
      return res.status(400).json({ success: false, message: 'Invalid delta value.' });
    }

    if (db.isMySQLConnected()) {
      await db.pool.query('UPDATE products SET stock_quantity = GREATEST(0, stock_quantity + ?) WHERE id = ? AND user_id = ?', [change, id, userId]);
      const [updated] = await db.pool.query('SELECT * FROM products WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Stock updated.', product: updated[0] });
    } else {
      const prod = db.fallbackStore.products.find(p => p.id === parseInt(id, 10) && p.user_id === userId);
      if (!prod) return res.status(404).json({ success: false, message: 'Product not found.' });
      prod.stock_quantity = Math.max(0, prod.stock_quantity + change);
      return res.json({ success: true, message: 'Stock updated.', product: prod });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to adjust stock.' });
  }
};

