// ========================================================
// BILLING BOOK - Inventory & Product Management Controller
// ========================================================

const Inventory = {
  productList: [],

  async load(filters = {}) {
    try {
      const data = await API.get('/products', filters);
      if (data.success) {
        this.productList = data.products;
        this.renderTable(data.products);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load inventory.', 'error');
    }
  },

  renderTable(products) {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    if (!products || products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <p>No products in inventory. Click "+ Add Product" to stock items.</p>
          </td>
        </tr>
      `;
      return;
    }

    const sym = window.appCurrency || '₹';

    tbody.innerHTML = products.map(p => {
      const isLowStock = p.stock_quantity <= p.reorder_level;
      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--gray-900);">${escapeHtml(p.name)}</div>
            <div style="font-size: 11.5px; color: var(--gray-500);">${escapeHtml(p.description || '')}</div>
          </td>
          <td><code style="font-size: 12px; background: var(--gray-100); padding: 2px 6px; border-radius: 4px;">${escapeHtml(p.sku)}</code></td>
          <td><span class="badge" style="background: var(--gray-100); color: var(--gray-700);">${escapeHtml(p.category || 'General')}</span></td>
          <td><strong>${sym}${Number(p.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> / ${p.unit}</td>
          <td>${p.tax_rate}%</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge ${isLowStock ? 'badge-low-stock' : 'badge-paid'}" style="font-size: 13px;">
                ${p.stock_quantity} ${p.unit}
              </span>
              <button class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 11px;" onclick="Inventory.adjustStock(${p.id}, 1)" title="Add +1 Stock">+</button>
              <button class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 11px;" onclick="Inventory.adjustStock(${p.id}, -1)" title="Remove -1 Stock">-</button>
            </div>
            ${isLowStock ? '<div style="font-size: 11px; color: var(--danger); font-weight: 600; margin-top: 2px;">⚠️ Low Stock Alert</div>' : ''}
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="Inventory.openEditModal(${p.id})" title="Edit">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="Inventory.deleteProduct(${p.id})" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddModal() {
    document.getElementById('product-modal-title').textContent = 'Add New Product / Service';
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-sku').value = 'SKU-' + Date.now().toString().slice(-5);
    document.getElementById('product-tax-rate').value = window.appDefaultTax || 18;
    openModal('product-modal');
  },

  openEditModal(id) {
    const p = this.productList.find(prod => prod.id === id);
    if (!p) return;

    document.getElementById('product-modal-title').textContent = 'Edit Product / Service';
    document.getElementById('product-id').value = p.id;
    document.getElementById('product-name').value = p.name || '';
    document.getElementById('product-sku').value = p.sku || '';
    document.getElementById('product-category').value = p.category || 'General';
    document.getElementById('product-unit').value = p.unit || 'pcs';
    document.getElementById('product-unit-price').value = p.unit_price || 0;
    document.getElementById('product-cost-price').value = p.cost_price || 0;
    document.getElementById('product-tax-rate').value = p.tax_rate !== undefined ? p.tax_rate : 18;
    document.getElementById('product-stock-qty').value = p.stock_quantity || 0;
    document.getElementById('product-reorder-level').value = p.reorder_level || 5;
    document.getElementById('product-desc').value = p.description || '';

    openModal('product-modal');
  },

  async saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const body = {
      name: document.getElementById('product-name').value.trim(),
      sku: document.getElementById('product-sku').value.trim(),
      category: document.getElementById('product-category').value.trim(),
      unit: document.getElementById('product-unit').value.trim(),
      unit_price: parseFloat(document.getElementById('product-unit-price').value || 0),
      cost_price: parseFloat(document.getElementById('product-cost-price').value || 0),
      tax_rate: parseFloat(document.getElementById('product-tax-rate').value || 0),
      stock_quantity: parseInt(document.getElementById('product-stock-qty').value || 0, 10),
      reorder_level: parseInt(document.getElementById('product-reorder-level').value || 0, 10),
      description: document.getElementById('product-desc').value.trim()
    };

    if (!body.name) {
      showToast('Product name is required.', 'error');
      return;
    }

    try {
      if (id) {
        await API.put(`/products/${id}`, body);
        showToast('Product updated successfully!', 'success');
      } else {
        await API.post('/products', body);
        showToast('Product created successfully!', 'success');
      }
      closeModal('product-modal');
      this.load();
    } catch (err) {
      showToast(err.message || 'Failed to save product.', 'error');
    }
  },

  async adjustStock(id, delta) {
    try {
      await API.post(`/products/${id}/stock`, { delta });
      showToast(`Stock updated (${delta > 0 ? '+' : ''}${delta})`, 'info');
      this.load();
    } catch (err) {
      showToast('Failed to adjust stock.', 'error');
    }
  },

  async deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await API.delete(`/products/${id}`);
      showToast('Product deleted.', 'success');
      this.load();
    } catch (err) {
      showToast(err.message || 'Failed to delete product.', 'error');
    }
  }
};

