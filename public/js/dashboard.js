// ========================================================
// BILLING BOOK - Dashboard Controller & Analytics
// ========================================================

const Dashboard = {
  async load() {
    try {
      const data = await API.get('/dashboard/stats');
      if (data.success) {
        this.renderStats(data.stats);
        this.renderRecentInvoices(data.recentInvoices);
        this.renderLowStock(data.lowStockItems);
        this.renderMonthlyChart(data.monthlyTrend);
        this.updateDbStatus(data.dbStatus);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  },

  renderStats(stats) {
    const sym = window.appCurrency || '₹';

    const revEl = document.getElementById('stat-total-revenue');
    const paidEl = document.getElementById('stat-total-paid');
    const unpaidEl = document.getElementById('stat-total-unpaid');
    const overdueEl = document.getElementById('stat-total-overdue');
    const custEl = document.getElementById('stat-total-customers');
    const prodEl = document.getElementById('stat-total-products');
    const quoteEl = document.getElementById('stat-total-quotations');
    const lowStockPill = document.getElementById('badge-low-stock-count');

    if (revEl) revEl.textContent = `${sym}${stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (paidEl) paidEl.textContent = `${sym}${stats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (unpaidEl) unpaidEl.textContent = `${sym}${stats.totalUnpaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (overdueEl) overdueEl.textContent = `${sym}${stats.totalOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (custEl) custEl.textContent = stats.totalCustomers;
    if (prodEl) prodEl.textContent = stats.totalProducts;
    if (quoteEl) quoteEl.textContent = stats.totalQuotations;

    if (lowStockPill) {
      lowStockPill.textContent = stats.lowStockCount;
      lowStockPill.style.display = stats.lowStockCount > 0 ? 'inline-block' : 'none';
    }
  },

  renderRecentInvoices(invoices) {
    const tbody = document.getElementById('dashboard-recent-invoices-body');
    if (!tbody) return;

    if (!invoices || invoices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <p>No invoices created yet. Click "Create Invoice" to make your first one!</p>
          </td>
        </tr>
      `;
      return;
    }

    const sym = window.appCurrency || '₹';

    tbody.innerHTML = invoices.map(inv => {
      const statusClass = `badge-${inv.status.toLowerCase().replace(' ', '-')}`;
      return `
        <tr>
          <td><strong>${escapeHtml(inv.invoice_number)}</strong></td>
          <td>${inv.invoice_date}</td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(inv.customer_name || 'N/A')}</div>
            <div style="font-size: 11px; color: var(--gray-500);">${escapeHtml(inv.customer_company || '')}</div>
          </td>
          <td><strong>${sym}${Number(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          <td><span class="badge ${statusClass}">${inv.status}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="Invoices.viewInvoice(${inv.id})">
              <span>👁️</span> View
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderLowStock(items) {
    const list = document.getElementById('dashboard-low-stock-list');
    if (!list) return;

    if (!items || items.length === 0) {
      list.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--gray-500); font-size: 13px;">
          ✅ All product stock levels are healthy!
        </div>
      `;
      return;
    }

    list.innerHTML = items.map(p => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--gray-200);">
        <div>
          <div style="font-weight: 600; font-size: 13.5px;">${escapeHtml(p.name)}</div>
          <div style="font-size: 11.5px; color: var(--gray-500);">SKU: ${escapeHtml(p.sku)} | Reorder at ${p.reorder_level} ${p.unit}</div>
        </div>
        <div style="text-align: right;">
          <span class="badge badge-low-stock">${p.stock_quantity} ${p.unit} left</span>
        </div>
      </div>
    `).join('');
  },

  renderMonthlyChart(data) {
    const container = document.getElementById('dashboard-chart-container');
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No sales activity yet</p></div>`;
      return;
    }

    const maxVal = Math.max(...data.map(d => Number(d.total)), 1000);
    const sym = window.appCurrency || '₹';

    container.innerHTML = `
      <div style="display: flex; align-items: flex-end; gap: 16px; height: 180px; padding: 10px 0 20px;">
        ${data.map(item => {
          const heightPct = Math.max(12, Math.round((Number(item.total) / maxVal) * 140));
          return `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <div style="font-size: 11px; font-weight: 600; color: var(--primary);">
                ${sym}${(Number(item.total) / 1000).toFixed(1)}k
              </div>
              <div style="
                width: 100%;
                max-width: 42px;
                height: ${heightPct}px;
                background: linear-gradient(180deg, var(--primary) 0%, #818cf8 100%);
                border-radius: 6px 6px 0 0;
                transition: height 0.3s ease;
              " title="${item.month}: ${sym}${Number(item.total).toLocaleString()} (${item.count} invoices)"></div>
              <div style="font-size: 11px; color: var(--gray-600); white-space: nowrap;">
                ${item.month}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  updateDbStatus(dbStatus) {
    const topBadge = document.getElementById('top-db-status');
    const sidePill = document.getElementById('side-db-status');

    if (!dbStatus) return;

    if (dbStatus.isMySQLConnected) {
      if (topBadge) {
        topBadge.innerHTML = `<span class="status-dot"></span> <strong>MySQL: Connected</strong> (${dbStatus.database})`;
        topBadge.className = 'db-pill';
      }
      if (sidePill) {
        sidePill.innerHTML = `<span class="status-dot"></span> MySQL Active (3306)`;
      }
    } else {
      if (topBadge) {
        topBadge.innerHTML = `<span class="status-dot warning"></span> <strong>MySQL Offline:</strong> Start XAMPP/MySQL for live DB`;
        topBadge.className = 'db-pill';
        topBadge.title = 'MySQL not running. Application is using resilient local storage. Start MySQL in XAMPP to connect.';
      }
      if (sidePill) {
        sidePill.innerHTML = `<span class="status-dot warning"></span> Local Store (MySQL Off)`;
      }
    }
  }
};

