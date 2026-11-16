// ========================================================
// BILLING BOOK - Quotation / Estimates Controller
// ========================================================

const Quotations = {
  quotationList: [],

  async load(filters = {}) {
    try {
      const data = await API.get('/quotations', filters);
      if (data.success) {
        this.quotationList = data.quotations;
        this.renderTable(data.quotations);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load quotations.', 'error');
    }
  },

  renderTable(quotations) {
    const tbody = document.getElementById('quotations-table-body');
    if (!tbody) return;

    if (!quotations || quotations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <p>No quotations found. Click "+ New Quotation" to create an estimate.</p>
          </td>
        </tr>
      `;
      return;
    }

    const sym = window.appCurrency || '₹';

    tbody.innerHTML = quotations.map(q => {
      const statusClass = `badge-${q.status.toLowerCase()}`;
      const isConverted = q.status === 'Converted';
      return `
        <tr>
          <td><strong>${escapeHtml(q.quotation_number)}</strong></td>
          <td>${q.quotation_date}</td>
          <td>
            <div style="font-weight: 600; color: var(--gray-900);">${escapeHtml(q.customer_name)}</div>
            <div style="font-size: 11px; color: var(--gray-500);">${escapeHtml(q.customer_company || '')}</div>
          </td>
          <td>${q.valid_until || 'Not set'}</td>
          <td><strong>${sym}${Number(q.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          <td><span class="badge ${statusClass}">${q.status}</span></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="Quotations.viewQuotation(${q.id})" title="View / Print">
                📄 View
              </button>
              ${!isConverted ? `
                <button class="btn btn-primary btn-sm" onclick="Quotations.convertToInvoice(${q.id})" title="1-Click Convert to Invoice">
                  ⚡ Convert
                </button>
              ` : `
                <span style="font-size: 11px; color: var(--primary); font-weight: 600; align-self: center;">Converted ✓</span>
              `}
              <button class="btn btn-danger btn-sm" onclick="Quotations.deleteQuotation(${q.id})" title="Delete">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async openCreateModal() {
    await Customers.load();
    const custSelect = document.getElementById('quote-customer-select');
    custSelect.innerHTML = '<option value="">-- Choose Customer --</option>' + 
      Customers.customerList.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.company || 'Individual')})</option>`).join('');

    await Inventory.load();

    try {
      const numData = await API.get('/quotations/next-number');
      if (numData.success) {
        document.getElementById('quote-number').value = numData.nextNumber;
      }
    } catch {
      document.getElementById('quote-number').value = 'QT-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-4);
    }

    const today = new Date().toISOString().split('T')[0];
    const valid = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    document.getElementById('quote-date').value = today;
    document.getElementById('quote-valid-until').value = valid;

    document.getElementById('quote-items-body').innerHTML = '';
    this.addItemRow();

    document.getElementById('quote-discount-percent').value = 0;
    document.getElementById('quote-notes').value = '';
    document.getElementById('quote-terms').value = 'Valid for 15 days from issue date.';
    document.getElementById('quote-status').value = 'Draft';

    this.calculateTotals();
    openModal('create-quote-modal');
  },

  addItemRow(itemData = {}) {
    const tbody = document.getElementById('quote-items-body');
    const rowId = 'qrow-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.className = 'quote-item-row';

    const defaultTax = window.appDefaultTax !== undefined ? window.appDefaultTax : 18;

    tr.innerHTML = `
      <td>
        <select class="form-control q-item-product-select" onchange="Quotations.onProductSelect('${rowId}', this.value)" style="margin-bottom: 4px;">
          <option value="">-- Select from Inventory (Optional) --</option>
          ${Inventory.productList.map(p => `<option value="${p.id}" data-price="${p.unit_price}" data-tax="${p.tax_rate}">${escapeHtml(p.name)} - ₹${p.unit_price}</option>`).join('')}
        </select>
        <input type="text" class="form-control q-item-desc" placeholder="Service or Item Description" value="${escapeHtml(itemData.description || '')}" required />
      </td>
      <td style="width: 100px;">
        <input type="number" class="form-control q-item-qty" value="${itemData.quantity || 1}" min="0.1" step="any" oninput="Quotations.calculateTotals()" required />
      </td>
      <td style="width: 130px;">
        <input type="number" class="form-control q-item-price" value="${itemData.unit_price || 0}" min="0" step="any" oninput="Quotations.calculateTotals()" required />
      </td>
      <td style="width: 100px;">
        <input type="number" class="form-control q-item-tax" value="${itemData.tax_rate !== undefined ? itemData.tax_rate : defaultTax}" min="0" max="100" step="any" oninput="Quotations.calculateTotals()" />
      </td>
      <td style="width: 100px;">
        <input type="number" class="form-control q-item-discount" value="${itemData.discount_percent || 0}" min="0" max="100" step="any" oninput="Quotations.calculateTotals()" />
      </td>
      <td style="width: 120px; text-align: right; font-weight: 700;">
        <span class="q-item-line-total">₹0.00</span>
      </td>
      <td style="width: 40px; text-align: center;">
        <button type="button" class="btn btn-danger btn-sm" onclick="Quotations.removeItemRow('${rowId}')" title="Remove">✕</button>
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
      row.querySelector('.q-item-desc').value = prod.name;
      row.querySelector('.q-item-price').value = prod.unit_price;
      row.querySelector('.q-item-tax').value = prod.tax_rate;
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
    const rows = document.querySelectorAll('.quote-item-row');
    let subtotal = 0;
    let totalTax = 0;

    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.q-item-qty').value || 0);
      const price = parseFloat(row.querySelector('.q-item-price').value || 0);
      const taxRate = parseFloat(row.querySelector('.q-item-tax').value || 0);
      const itemDisc = parseFloat(row.querySelector('.q-item-discount').value || 0);

      const baseAmount = qty * price;
      const discAmount = (baseAmount * itemDisc) / 100;
      const taxable = baseAmount - discAmount;
      const taxAmount = (taxable * taxRate) / 100;
      const lineTotal = taxable + taxAmount;

      subtotal += baseAmount;
      totalTax += taxAmount;

      const totalSpan = row.querySelector('.q-item-line-total');
      const sym = window.appCurrency || '₹';
      if (totalSpan) totalSpan.textContent = `${sym}${lineTotal.toFixed(2)}`;
    });

    const globalDiscPct = parseFloat(document.getElementById('quote-discount-percent').value || 0);
    const globalDiscAmount = (subtotal * globalDiscPct) / 100;
    const grandTotal = Math.max(0, subtotal - globalDiscAmount + totalTax);

    const sym = window.appCurrency || '₹';
    document.getElementById('quote-summary-subtotal').textContent = `${sym}${subtotal.toFixed(2)}`;
    document.getElementById('quote-summary-discount').textContent = `${sym}${globalDiscAmount.toFixed(2)}`;
    document.getElementById('quote-summary-tax').textContent = `${sym}${totalTax.toFixed(2)}`;
    document.getElementById('quote-summary-grand-total').textContent = `${sym}${grandTotal.toFixed(2)}`;
  },

  async saveQuotation(e) {
    e.preventDefault();

    const customer_id = document.getElementById('quote-customer-select').value;
    if (!customer_id) {
      showToast('Please select a customer.', 'error');
      return;
    }

    const rows = document.querySelectorAll('.quote-item-row');
    if (rows.length === 0) {
      showToast('Please add at least one line item.', 'error');
      return;
    }

    const items = [];
    rows.forEach(row => {
      const desc = row.querySelector('.q-item-desc').value.trim();
      const qty = parseFloat(row.querySelector('.q-item-qty').value || 0);
      const price = parseFloat(row.querySelector('.q-item-price').value || 0);
      const taxRate = parseFloat(row.querySelector('.q-item-tax').value || 0);
      const discount = parseFloat(row.querySelector('.q-item-discount').value || 0);
      const prodSelect = row.querySelector('.q-item-product-select');
      const productId = prodSelect && prodSelect.value ? parseInt(prodSelect.value, 10) : null;

      items.push({
        product_id: productId,
        description: desc,
        quantity: qty,
        unit_price: price,
        tax_rate: taxRate,
        discount_percent: discount
      });
    });

    const body = {
      customer_id: parseInt(customer_id, 10),
      quotation_number: document.getElementById('quote-number').value.trim(),
      quotation_date: document.getElementById('quote-date').value,
      valid_until: document.getElementById('quote-valid-until').value,
      discount_percent: parseFloat(document.getElementById('quote-discount-percent').value || 0),
      status: document.getElementById('quote-status').value,
      notes: document.getElementById('quote-notes').value.trim(),
      terms: document.getElementById('quote-terms').value.trim(),
      items
    };

    try {
      const data = await API.post('/quotations', body);
      showToast(data.message || 'Quotation created successfully!', 'success');
      closeModal('create-quote-modal');
      this.load();
      Dashboard.load();
    } catch (err) {
      showToast(err.message || 'Failed to create quotation.', 'error');
    }
  },

  async convertToInvoice(id) {
    if (!confirm('Do you want to convert this quotation into an active Tax Invoice?')) return;

    try {
      const data = await API.post(`/quotations/${id}/convert`, {});
      showToast(data.message || 'Quotation converted into Invoice successfully!', 'success');
      this.load();
      Invoices.load();
      Dashboard.load();
      // Open the generated invoice preview directly
      if (data.invoice_id) {
        Invoices.viewInvoice(data.invoice_id);
      }
    } catch (err) {
      showToast(err.message || 'Failed to convert quotation.', 'error');
    }
  },

  async viewQuotation(id) {
    try {
      const data = await API.get(`/quotations/${id}`);
      if (!data.success) return;

      const q = data.quotation;
      const co = q.company || {};
      const sym = co.currency_symbol || window.appCurrency || '₹';

      const html = `
        <div id="invoice-print-wrapper" class="invoice-print-container">
          <div class="invoice-print-header">
            <div class="company-brand-details">
              <h2>${escapeHtml(co.company_name || 'Billing Book')}</h2>
              <div class="company-tagline">${escapeHtml(co.company_tagline || '')}</div>
              <div class="company-meta-line">${escapeHtml(co.address || '')}</div>
              <div class="company-meta-line">Phone: ${escapeHtml(co.phone || '')} | Email: ${escapeHtml(co.email || '')}</div>
            </div>
            <div class="invoice-badge-title">
              <h1 style="color: #0284c7;">QUOTATION</h1>
              <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px;"># ${escapeHtml(q.quotation_number)}</div>
              <div style="margin-top: 6px;">
                <span class="badge badge-${q.status.toLowerCase()}">${q.status}</span>
              </div>
            </div>
          </div>

          <div class="invoice-meta-grid">
            <div class="meta-block">
              <h4>Quoted To:</h4>
              <div class="name">${escapeHtml(q.customer_name || 'Client')}</div>
              ${q.customer_company ? `<div class="meta-text"><strong>${escapeHtml(q.customer_company)}</strong></div>` : ''}
              <div class="meta-text">${escapeHtml(q.billing_address || '')}</div>
              <div class="meta-text">Phone: ${escapeHtml(q.customer_phone || '-')} | Email: ${escapeHtml(q.customer_email || '-')}</div>
            </div>
            <div class="meta-block">
              <h4>Quotation Meta:</h4>
              <div class="meta-text"><strong>Date Issued:</strong> ${q.quotation_date}</div>
              <div class="meta-text"><strong>Valid Until:</strong> ${q.valid_until || '15 days from issue'}</div>
            </div>
          </div>

          <table class="invoice-items-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 45%;">Item / Scope Description</th>
                <th class="text-center" style="width: 10%;">Qty</th>
                <th class="text-right" style="width: 14%;">Rate</th>
                <th class="text-center" style="width: 10%;">Tax %</th>
                <th class="text-right" style="width: 16%;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(q.items || []).map((itm, idx) => `
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

          <div class="invoice-totals-wrapper">
            <div class="totals-card">
              <div class="totals-row"><span>Subtotal:</span><span>${sym}${Number(q.subtotal).toFixed(2)}</span></div>
              ${Number(q.discount_amount) > 0 ? `
                <div class="totals-row"><span>Discount (${q.discount_percent}%):</span><span>-${sym}${Number(q.discount_amount).toFixed(2)}</span></div>
              ` : ''}
              <div class="totals-row"><span>Estimated Tax:</span><span>+${sym}${Number(q.tax_amount).toFixed(2)}</span></div>
              <div class="totals-row grand-total-row"><span>Estimated Total:</span><span>${sym}${Number(q.grand_total).toFixed(2)}</span></div>
            </div>
          </div>

          <div class="invoice-footer-notes">
            <div>
              ${q.notes ? `<div><strong>Notes:</strong> ${escapeHtml(q.notes)}</div>` : ''}
              ${q.terms ? `<div style="margin-top: 6px;"><strong>Terms:</strong> ${escapeHtml(q.terms)}</div>` : ''}
            </div>
            <div class="signature-box">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 30px;">Prepared for acceptance</div>
              <div class="signature-line">Client Acceptance</div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('view-invoice-modal-body').innerHTML = html;
      openModal('view-invoice-modal');
    } catch (err) {
      showToast('Failed to load quotation preview.', 'error');
    }
  },

  async deleteQuotation(id) {
    if (!confirm('Are you sure you want to delete this quotation?')) return;

    try {
      await API.delete(`/quotations/${id}`);
      showToast('Quotation deleted.', 'success');
      this.load();
      Dashboard.load();
    } catch (err) {
      showToast(err.message || 'Failed to delete quotation.', 'error');
    }
  }
};

