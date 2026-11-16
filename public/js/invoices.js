// ========================================================
// BILLING BOOK - Invoices Controller & Generator
// ========================================================

const Invoices = {
  invoiceList: [],

  async load(filters = {}) {
    try {
      const data = await API.get('/invoices', filters);
      if (data.success) {
        this.invoiceList = data.invoices;
        this.renderTable(data.invoices);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load invoices.', 'error');
    }
  },

  renderTable(invoices) {
    const tbody = document.getElementById('invoices-table-body');
    if (!tbody) return;

    if (!invoices || invoices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <p>No invoices match your criteria. Click "+ New Invoice" to create one.</p>
          </td>
        </tr>
      `;
      return;
    }

    const sym = window.appCurrency || '₹';

    tbody.innerHTML = invoices.map(i => {
      const statusClass = `badge-${i.status.toLowerCase().replace(' ', '-')}`;
      const isPaid = i.status === 'Paid';
      return `
        <tr>
          <td>
            <strong>${escapeHtml(i.invoice_number)}</strong>
          </td>
          <td>${i.invoice_date}</td>
          <td>
            <div style="font-weight: 600; color: var(--gray-900);">${escapeHtml(i.customer_name)}</div>
            <div style="font-size: 11px; color: var(--gray-500);">${escapeHtml(i.customer_company || '')}</div>
          </td>
          <td>${i.due_date || '-'}</td>
          <td>
            <strong>${sym}${Number(i.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </td>
          <td>
            <span class="badge ${statusClass}">${i.status}</span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="Invoices.viewInvoice(${i.id})" title="View / Print">
                📄 View
              </button>
              ${!isPaid ? `
                <button class="btn btn-success btn-sm" onclick="Invoices.markPaid(${i.id})" title="Mark as Paid">
                  ✓ Paid
                </button>
              ` : ''}
              <button class="btn btn-danger btn-sm" onclick="Invoices.deleteInvoice(${i.id})" title="Delete">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async openCreateModal() {
    // Populate customer dropdown
    await Customers.load();
    const custSelect = document.getElementById('inv-customer-select');
    custSelect.innerHTML = '<option value="">-- Choose Customer --</option>' + 
      Customers.customerList.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.company || 'Individual')})</option>`).join('');

    // Load products for line items
    await Inventory.load();

    // Fetch next invoice number
    try {
      const numData = await API.get('/invoices/next-number');
      if (numData.success) {
        document.getElementById('inv-number').value = numData.nextNumber;
      }
    } catch {
      document.getElementById('inv-number').value = 'INV-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-4);
    }

    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    document.getElementById('inv-date').value = today;
    document.getElementById('inv-due-date').value = due;

    // Reset items container
    document.getElementById('inv-items-body').innerHTML = '';
    this.addItemRow();

    // Reset notes & discount
    document.getElementById('inv-discount-percent').value = 0;
    document.getElementById('inv-notes').value = '';
    document.getElementById('inv-status').value = 'Draft';
    document.getElementById('inv-paid-amount').value = 0;

    this.calculateTotals();
    openModal('create-invoice-modal');
  },

  addItemRow(itemData = {}) {
    const tbody = document.getElementById('inv-items-body');
    const rowId = 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.className = 'invoice-item-row';

    const defaultTax = window.appDefaultTax !== undefined ? window.appDefaultTax : 18;

    tr.innerHTML = `
      <td>
        <select class="form-control item-product-select" onchange="Invoices.onProductSelect('${rowId}', this.value)" style="margin-bottom: 4px;">
          <option value="">-- Select from Inventory (Optional) --</option>
          ${Inventory.productList.map(p => `<option value="${p.id}" data-price="${p.unit_price}" data-tax="${p.tax_rate}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)} (${p.unit}) - ₹${p.unit_price}</option>`).join('')}
        </select>
        <input type="text" class="form-control item-desc" placeholder="Item name & description" value="${escapeHtml(itemData.description || '')}" required />
      </td>
      <td style="width: 100px;">
        <input type="number" class="form-control item-qty" value="${itemData.quantity || 1}" min="0.1" step="any" oninput="Invoices.calculateTotals()" required />
      </td>
      <td style="width: 130px;">
        <input type="number" class="form-control item-price" value="${itemData.unit_price || 0}" min="0" step="any" oninput="Invoices.calculateTotals()" required />
      </td>
      <td style="width: 100px;">
        <input type="number" class="form-control item-tax" value="${itemData.tax_rate !== undefined ? itemData.tax_rate : defaultTax}" min="0" max="100" step="any" oninput="Invoices.calculateTotals()" />
      </td>
      <td style="width: 100px;">
        <input type="number" class="form-control item-discount" value="${itemData.discount_percent || 0}" min="0" max="100" step="any" oninput="Invoices.calculateTotals()" />
      </td>
      <td style="width: 120px; text-align: right; font-weight: 700;">
        <span class="item-line-total">₹0.00</span>
      </td>
      <td style="width: 40px; text-align: center;">
        <button type="button" class="btn btn-danger btn-sm" onclick="Invoices.removeItemRow('${rowId}')" title="Remove Item">✕</button>
      </td>
    `;

    tbody.appendChild(tr);
    this.calculateTotals();
  },

  onProductSelect(rowId, productId) {
    if (!productId) return;
    const row = document.getElementById(rowId);
    if (!row) return;

    const prod = Inventory.productList.find(p => p.id === parseInt(productId, 10));
    if (prod) {
      row.querySelector('.item-desc').value = prod.name;
      row.querySelector('.item-price').value = prod.unit_price;
      row.querySelector('.item-tax').value = prod.tax_rate;
      this.calculateTotals();
    }
  },

  removeItemRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
      row.remove();
      this.calculateTotals();
    }
  },

  calculateTotals() {
    const rows = document.querySelectorAll('.invoice-item-row');
    let subtotal = 0;
    let totalTax = 0;

    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.item-qty').value || 0);
      const price = parseFloat(row.querySelector('.item-price').value || 0);
      const taxRate = parseFloat(row.querySelector('.item-tax').value || 0);
      const itemDisc = parseFloat(row.querySelector('.item-discount').value || 0);

      const baseAmount = qty * price;
      const discAmount = (baseAmount * itemDisc) / 100;
      const taxable = baseAmount - discAmount;
      const taxAmount = (taxable * taxRate) / 100;
      const lineTotal = taxable + taxAmount;

      subtotal += baseAmount;
      totalTax += taxAmount;

      const totalSpan = row.querySelector('.item-line-total');
      const sym = window.appCurrency || '₹';
      if (totalSpan) {
        totalSpan.textContent = `${sym}${lineTotal.toFixed(2)}`;
      }
    });

    const globalDiscPct = parseFloat(document.getElementById('inv-discount-percent').value || 0);
    const globalDiscAmount = (subtotal * globalDiscPct) / 100;
    const grandTotal = Math.max(0, subtotal - globalDiscAmount + totalTax);

    const sym = window.appCurrency || '₹';
    document.getElementById('inv-summary-subtotal').textContent = `${sym}${subtotal.toFixed(2)}`;
    document.getElementById('inv-summary-discount').textContent = `${sym}${globalDiscAmount.toFixed(2)}`;
    document.getElementById('inv-summary-tax').textContent = `${sym}${totalTax.toFixed(2)}`;
    document.getElementById('inv-summary-grand-total').textContent = `${sym}${grandTotal.toFixed(2)}`;
  },

  async saveInvoice(e) {
    e.preventDefault();

    const customer_id = document.getElementById('inv-customer-select').value;
    if (!customer_id) {
      showToast('Please select a customer.', 'error');
      return;
    }

    const rows = document.querySelectorAll('.invoice-item-row');
    if (rows.length === 0) {
      showToast('Please add at least one line item.', 'error');
      return;
    }

    const items = [];
    let hasInvalid = false;

    rows.forEach(row => {
      const desc = row.querySelector('.item-desc').value.trim();
      const qty = parseFloat(row.querySelector('.item-qty').value || 0);
      const price = parseFloat(row.querySelector('.item-price').value || 0);
      const taxRate = parseFloat(row.querySelector('.item-tax').value || 0);
      const discount = parseFloat(row.querySelector('.item-discount').value || 0);
      const prodSelect = row.querySelector('.item-product-select');
      const productId = prodSelect && prodSelect.value ? parseInt(prodSelect.value, 10) : null;

      if (!desc || qty <= 0) {
        hasInvalid = true;
      }

      items.push({
        product_id: productId,
        description: desc,
        quantity: qty,
        unit_price: price,
        tax_rate: taxRate,
        discount_percent: discount
      });
    });

    if (hasInvalid) {
      showToast('Please provide valid descriptions and quantities for all items.', 'error');
      return;
    }

    const body = {
      customer_id: parseInt(customer_id, 10),
      invoice_number: document.getElementById('inv-number').value.trim(),
      invoice_date: document.getElementById('inv-date').value,
      due_date: document.getElementById('inv-due-date').value,
      discount_percent: parseFloat(document.getElementById('inv-discount-percent').value || 0),
      status: document.getElementById('inv-status').value,
      amount_paid: parseFloat(document.getElementById('inv-paid-amount').value || 0),
      notes: document.getElementById('inv-notes').value.trim(),
      items
    };

    try {
      const data = await API.post('/invoices', body);
      showToast(data.message || 'Invoice created successfully!', 'success');
      closeModal('create-invoice-modal');
      this.load();
      Dashboard.load();
    } catch (err) {
      showToast(err.message || 'Failed to create invoice.', 'error');
    }
  },

  async viewInvoice(id) {
    try {
      const data = await API.get(`/invoices/${id}`);
      if (!data.success) return;

      const inv = data.invoice;
      const co = inv.company || {};
      const sym = co.currency_symbol || window.appCurrency || '₹';

      const html = `
        <div id="invoice-print-wrapper" class="invoice-print-container">
          <!-- Header -->
          <div class="invoice-print-header">
            <div class="company-brand-details">
              <h2>${escapeHtml(co.company_name || 'Billing Book')}</h2>
              <div class="company-tagline">${escapeHtml(co.company_tagline || '')}</div>
              <div class="company-meta-line">${escapeHtml(co.address || '')}</div>
              <div class="company-meta-line">Phone: ${escapeHtml(co.phone || '')} | Email: ${escapeHtml(co.email || '')}</div>
              ${co.gstin ? `<div class="company-meta-line"><strong>GSTIN:</strong> ${escapeHtml(co.gstin)}</div>` : ''}
              ${co.pan ? `<div class="company-meta-line"><strong>PAN:</strong> ${escapeHtml(co.pan)}</div>` : ''}
            </div>
            <div class="invoice-badge-title">
              <h1>TAX INVOICE</h1>
              <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px;"># ${escapeHtml(inv.invoice_number)}</div>
              <div style="margin-top: 6px;">
                <span class="badge badge-${inv.status.toLowerCase().replace(' ', '-')}">${inv.status}</span>
              </div>
            </div>
          </div>

          <!-- Meta Grid (Bill To & Invoice Details) -->
          <div class="invoice-meta-grid">
            <div class="meta-block">
              <h4>Billed To (Client):</h4>
              <div class="name">${escapeHtml(inv.customer_name || 'Client')}</div>
              ${inv.customer_company ? `<div class="meta-text"><strong>${escapeHtml(inv.customer_company)}</strong></div>` : ''}
              <div class="meta-text">${escapeHtml(inv.billing_address || 'No billing address specified')}</div>
              <div class="meta-text">Phone: ${escapeHtml(inv.customer_phone || '-')} | Email: ${escapeHtml(inv.customer_email || '-')}</div>
              ${inv.customer_gstin ? `<div class="meta-text"><strong>Client GSTIN:</strong> ${escapeHtml(inv.customer_gstin)}</div>` : ''}
            </div>
            <div class="meta-block">
              <h4>Invoice Meta:</h4>
              <div class="meta-text"><strong>Invoice Date:</strong> ${inv.invoice_date}</div>
              <div class="meta-text"><strong>Payment Due:</strong> ${inv.due_date || 'Due upon receipt'}</div>
              <div class="meta-text"><strong>Payment Terms:</strong> ${escapeHtml(inv.payment_terms || 'Net 15 days')}</div>
            </div>
          </div>

          <!-- Items Table -->
          <table class="invoice-items-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 45%;">Item / Description</th>
                <th class="text-center" style="width: 10%;">Qty</th>
                <th class="text-right" style="width: 14%;">Rate</th>
                <th class="text-center" style="width: 10%;">Tax %</th>
                <th class="text-right" style="width: 16%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${(inv.items || []).map((itm, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${escapeHtml(itm.description)}</strong></td>
                  <td class="text-center">${itm.quantity}</td>
                  <td class="text-right">${sym}${Number(itm.unit_price).toFixed(2)}</td>
                  <td class="text-center">${itm.tax_rate}%</td>
                  <td class="text-right"><strong>${sym}${Number(itm.total).toFixed(2)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Totals Calculation -->
          <div class="invoice-totals-wrapper">
            <div class="totals-card">
              <div class="totals-row">
                <span>Subtotal:</span>
                <span>${sym}${Number(inv.subtotal).toFixed(2)}</span>
              </div>
              ${Number(inv.discount_amount) > 0 ? `
                <div class="totals-row">
                  <span>Discount (${inv.discount_percent}%):</span>
                  <span>-${sym}${Number(inv.discount_amount).toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="totals-row">
                <span>Total Tax (GST):</span>
                <span>+${sym}${Number(inv.tax_amount).toFixed(2)}</span>
              </div>
              <div class="totals-row grand-total-row">
                <span>Grand Total:</span>
                <span>${sym}${Number(inv.grand_total).toFixed(2)}</span>
              </div>
              ${Number(inv.amount_paid) > 0 ? `
                <div class="totals-row" style="color: var(--success); font-weight: 600;">
                  <span>Amount Paid:</span>
                  <span>${sym}${Number(inv.amount_paid).toFixed(2)}</span>
                </div>
                <div class="totals-row" style="font-weight: 700; color: var(--danger);">
                  <span>Balance Due:</span>
                  <span>${sym}${Math.max(0, Number(inv.grand_total) - Number(inv.amount_paid)).toFixed(2)}</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Footer / Bank Details & Signature -->
          <div class="invoice-footer-notes">
            <div>
              <div class="bank-details-box">
                <h5>Bank & Payment Details:</h5>
                <div><strong>Bank:</strong> ${escapeHtml(co.bank_name || 'HDFC Bank Ltd')}</div>
                <div><strong>A/C No:</strong> ${escapeHtml(co.bank_account_no || '-')}</div>
                <div><strong>IFSC:</strong> ${escapeHtml(co.bank_ifsc || '-')}</div>
                ${co.bank_upi ? `<div><strong>UPI ID:</strong> ${escapeHtml(co.bank_upi)}</div>` : ''}
              </div>
              ${inv.notes ? `
                <div style="margin-top: 10px; font-size: 11.5px; color: #475569;">
                  <strong>Notes:</strong> ${escapeHtml(inv.notes)}
                </div>
              ` : ''}
              ${co.default_terms ? `
                <div style="margin-top: 6px; font-size: 10.5px; color: #64748b; white-space: pre-line;">
                  <strong>Terms & Conditions:</strong><br/>${escapeHtml(co.default_terms)}
                </div>
              ` : ''}
            </div>
            <div class="signature-box">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 30px;">For ${escapeHtml(co.company_name || 'Billing Book')}</div>
              <div class="signature-line">Authorized Signatory</div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('view-invoice-modal-body').innerHTML = html;
      openModal('view-invoice-modal');
    } catch (err) {
      showToast('Failed to load invoice preview.', 'error');
    }
  },

  async markPaid(id) {
    try {
      await API.patch(`/invoices/${id}/status`, { status: 'Paid' });
      showToast('Invoice marked as Paid!', 'success');
      this.load();
      Dashboard.load();
    } catch (err) {
      showToast('Failed to update status.', 'error');
    }
  },

  async deleteInvoice(id) {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      await API.delete(`/invoices/${id}`);
      showToast('Invoice deleted.', 'success');
      this.load();
      Dashboard.load();
    } catch (err) {
      showToast(err.message || 'Failed to delete invoice.', 'error');
    }
  },

  printInvoice() {
    window.print();
  }
};

