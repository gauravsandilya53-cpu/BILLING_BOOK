// ========================================================
// BILLING BOOK - Customers & Client Ledger Controller
// ========================================================

const Customers = {
  customerList: [],

  async load(search = '') {
    try {
      const data = await API.get('/customers', search ? { search } : {});
      if (data.success) {
        this.customerList = data.customers;
        this.renderTable(data.customers);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load customers.', 'error');
    }
  },

  renderTable(customers) {
    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;

    if (!customers || customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <p>No customers found. Click "+ Add Customer" to add your first client.</p>
          </td>
        </tr>
      `;
      return;
    }

    const sym = window.appCurrency || '₹';

    tbody.innerHTML = customers.map(c => `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--gray-900);">${escapeHtml(c.name)}</div>
          <div style="font-size: 12px; color: var(--gray-500);">${escapeHtml(c.company || 'Individual')}</div>
        </td>
        <td>
          <div style="font-size: 13px;">${escapeHtml(c.phone || '-')}</div>
          <div style="font-size: 12px; color: var(--gray-500);">${escapeHtml(c.email || '-')}</div>
        </td>
        <td>
          <span style="font-size: 12px; font-family: monospace; background: var(--gray-100); padding: 2px 6px; border-radius: 4px;">
            ${escapeHtml(c.gstin || 'Unregistered')}
          </span>
        </td>
        <td><strong>${c.invoice_count || 0}</strong> invoices</td>
        <td>
          <div style="font-weight: 700; color: ${Number(c.outstanding_balance) > 0 ? 'var(--danger)' : 'var(--success)'};">
            ${sym}${Number(c.outstanding_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style="font-size: 11px; color: var(--gray-500);">Total: ${sym}${Number(c.total_billed || 0).toLocaleString('en-IN')}</div>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="Customers.openEditModal(${c.id})" title="Edit">
              ✏️
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Customers.viewLedger(${c.id})" title="View Ledger">
              📋
            </button>
            <button class="btn btn-danger btn-sm" onclick="Customers.deleteCustomer(${c.id})" title="Delete">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  openAddModal() {
    document.getElementById('customer-modal-title').textContent = 'Add New Customer';
    document.getElementById('customer-form').reset();
    document.getElementById('customer-id').value = '';
    openModal('customer-modal');
  },

  openEditModal(id) {
    const c = this.customerList.find(cust => cust.id === id);
    if (!c) return;

    document.getElementById('customer-modal-title').textContent = 'Edit Customer';
    document.getElementById('customer-id').value = c.id;
    document.getElementById('customer-name').value = c.name || '';
    document.getElementById('customer-company').value = c.company || '';
    document.getElementById('customer-email').value = c.email || '';
    document.getElementById('customer-phone').value = c.phone || '';
    document.getElementById('customer-gstin').value = c.gstin || '';
    document.getElementById('customer-pan').value = c.pan || '';
    document.getElementById('customer-billing-address').value = c.billing_address || '';
    document.getElementById('customer-shipping-address').value = c.shipping_address || '';
    document.getElementById('customer-notes').value = c.notes || '';

    openModal('customer-modal');
  },

  async saveCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('customer-id').value;
    const body = {
      name: document.getElementById('customer-name').value.trim(),
      company: document.getElementById('customer-company').value.trim(),
      email: document.getElementById('customer-email').value.trim(),
      phone: document.getElementById('customer-phone').value.trim(),
      gstin: document.getElementById('customer-gstin').value.trim(),
      pan: document.getElementById('customer-pan').value.trim(),
      billing_address: document.getElementById('customer-billing-address').value.trim(),
      shipping_address: document.getElementById('customer-shipping-address').value.trim(),
      notes: document.getElementById('customer-notes').value.trim()
    };

    if (!body.name) {
      showToast('Customer name is required', 'error');
      return;
    }

    try {
      if (id) {
        await API.put(`/customers/${id}`, body);
        showToast('Customer updated successfully!', 'success');
      } else {
        await API.post('/customers', body);
        showToast('Customer created successfully!', 'success');
      }
      closeModal('customer-modal');
      this.load();
    } catch (err) {
      showToast(err.message || 'Failed to save customer.', 'error');
    }
  },

  async deleteCustomer(id) {
    if (!confirm('Are you sure you want to delete this customer? This will also remove associated invoices.')) {
      return;
    }

    try {
      await API.delete(`/customers/${id}`);
      showToast('Customer deleted successfully.', 'success');
      this.load();
    } catch (err) {
      showToast(err.message || 'Failed to delete customer.', 'error');
    }
  },

  async viewLedger(id) {
    try {
      const data = await API.get(`/customers/${id}`);
      if (!data.success) return;

      const c = data.customer;
      const invoices = data.invoices || [];
      const sym = window.appCurrency || '₹';

      const content = `
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 18px; color: var(--gray-900);">${escapeHtml(c.name)}</h3>
          <p style="font-size: 13px; color: var(--gray-500);">${escapeHtml(c.company || '')} | ${escapeHtml(c.phone || '')} | ${escapeHtml(c.email || '')}</p>
          <p style="font-size: 12px; color: var(--gray-600); margin-top: 4px;"><strong>GSTIN:</strong> ${escapeHtml(c.gstin || 'None')}</p>
          <p style="font-size: 12px; color: var(--gray-600);"><strong>Address:</strong> ${escapeHtml(c.billing_address || 'None')}</p>
        </div>

        <h4 style="font-size: 14px; margin-bottom: 12px; border-bottom: 1px solid var(--gray-200); padding-bottom: 6px;">Invoice History</h4>
        <div class="table-container">
          <table class="app-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.length === 0 ? '<tr><td colspan="5" class="empty-state">No invoices for this customer yet.</td></tr>' : invoices.map(i => `
                <tr>
                  <td><strong>${escapeHtml(i.invoice_number)}</strong></td>
                  <td>${i.invoice_date}</td>
                  <td>${i.due_date || '-'}</td>
                  <td><strong>${sym}${Number(i.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                  <td><span class="badge badge-${i.status.toLowerCase()}">${i.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      document.getElementById('ledger-modal-body').innerHTML = content;
      openModal('ledger-modal');
    } catch (err) {
      showToast('Failed to load customer details.', 'error');
    }
  }
};

