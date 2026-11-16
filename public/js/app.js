// ========================================================
// BILLING BOOK - Core Application Orchestration & Routing
// ========================================================

// Global Currency & Defaults
window.appCurrency = '₹';
window.appDefaultTax = 18;

// Toast Notifications System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span>${iconMap[type] || 'ℹ️'}</span>
      <span>${escapeHtml(message)}</span>
    </div>
    <button style="background: none; border: none; color: #fff; cursor: pointer; font-size: 16px;" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Modal System
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// HTML Escaper for Security
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const App = {
  activeView: 'dashboard',

  init() {
    this.bindNavigation();
    this.bindSearchAndFilters();
    this.bindModals();

    Auth.init();

    window.addEventListener('user-authenticated', () => {
      this.loadAllData();
    });

    // Close modals on clicking outside dialog
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && overlay.id !== 'auth-modal') {
          closeModal(overlay.id);
        }
      });
    });

    // Mobile menu toggle
    const menuBtn = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }
  },

  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        if (targetView) {
          this.switchView(targetView);
          // Close mobile menu if open
          const sidebar = document.getElementById('sidebar');
          if (sidebar) sidebar.classList.remove('open');
        }
      });
    });
  },

  switchView(viewName) {
    this.activeView = viewName;

    // Update active nav link
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update active section
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const activeSection = document.getElementById(`view-${viewName}`);
    if (activeSection) {
      activeSection.classList.add('active');
    }

    // Update header title
    const titleMap = {
      dashboard: { title: 'Dashboard', sub: 'Overview of business performance & invoicing metrics' },
      invoices: { title: 'Invoices', sub: 'Create, track, and manage customer billing & payments' },
      quotation: { title: 'Quotations & Estimates', sub: 'Prepare client proposals and 1-click convert into invoices' },
      inventory: { title: 'Inventory & Services', sub: 'Manage products, stocks, cost prices, and tax rates' },
      customer: { title: 'Customers', sub: 'Manage clients, contact information, and billing ledgers' },
      settings: { title: 'Settings', sub: 'Configure company profile, GSTIN, prefixes, and print templates' }
    };

    const header = titleMap[viewName] || { title: viewName, sub: '' };
    const titleEl = document.getElementById('header-page-title');
    const subEl = document.getElementById('header-page-sub');
    if (titleEl) titleEl.textContent = header.title;
    if (subEl) subEl.textContent = header.sub;

    // Refresh view specific data
    switch (viewName) {
      case 'dashboard':
        Dashboard.load();
        break;
      case 'invoices':
        Invoices.load();
        break;
      case 'quotation':
        Quotations.load();
        break;
      case 'inventory':
        Inventory.load();
        break;
      case 'customer':
        Customers.load();
        break;
      case 'settings':
        Settings.load();
        break;
    }
  },

  async loadAllData() {
    await Settings.load();
    await Dashboard.load();
    await Customers.load();
    await Inventory.load();
  },

  bindSearchAndFilters() {
    // Invoices Filter
    const invSearch = document.getElementById('invoice-search-input');
    const invStatus = document.getElementById('invoice-status-filter');
    const filterInvoices = () => {
      Invoices.load({
        search: invSearch ? invSearch.value.trim() : '',
        status: invStatus ? invStatus.value : 'All'
      });
    };
    if (invSearch) invSearch.addEventListener('input', debounce(filterInvoices, 300));
    if (invStatus) invStatus.addEventListener('change', filterInvoices);

    // Quotations Filter
    const quoteSearch = document.getElementById('quote-search-input');
    const quoteStatus = document.getElementById('quote-status-filter');
    const filterQuotes = () => {
      Quotations.load({
        search: quoteSearch ? quoteSearch.value.trim() : '',
        status: quoteStatus ? quoteStatus.value : 'All'
      });
    };
    if (quoteSearch) quoteSearch.addEventListener('input', debounce(filterQuotes, 300));
    if (quoteStatus) quoteStatus.addEventListener('change', filterQuotes);

    // Inventory Filter
    const prodSearch = document.getElementById('inventory-search-input');
    const prodCat = document.getElementById('inventory-category-filter');
    const prodLowStock = document.getElementById('inventory-low-stock-filter');
    const filterInventory = () => {
      Inventory.load({
        search: prodSearch ? prodSearch.value.trim() : '',
        category: prodCat ? prodCat.value : 'All',
        lowStock: prodLowStock && prodLowStock.checked ? 'true' : ''
      });
    };
    if (prodSearch) prodSearch.addEventListener('input', debounce(filterInventory, 300));
    if (prodCat) prodCat.addEventListener('change', filterInventory);
    if (prodLowStock) prodLowStock.addEventListener('change', filterInventory);

    // Customers Filter
    const custSearch = document.getElementById('customer-search-input');
    if (custSearch) {
      custSearch.addEventListener('input', debounce(() => {
        Customers.load(custSearch.value.trim());
      }, 300));
    }
  },

  bindModals() {
    // Customer Form Submit
    const custForm = document.getElementById('customer-form');
    if (custForm) custForm.addEventListener('submit', (e) => Customers.saveCustomer(e));

    // Product Form Submit
    const prodForm = document.getElementById('product-form');
    if (prodForm) prodForm.addEventListener('submit', (e) => Inventory.saveProduct(e));

    // Invoice Form Submit
    const invForm = document.getElementById('create-invoice-form');
    if (invForm) invForm.addEventListener('submit', (e) => Invoices.saveInvoice(e));

    // Quotation Form Submit
    const quoteForm = document.getElementById('create-quote-form');
    if (quoteForm) quoteForm.addEventListener('submit', (e) => Quotations.saveQuotation(e));

    // Settings Form Submit
    const setForm = document.getElementById('settings-form');
    if (setForm) setForm.addEventListener('submit', (e) => Settings.save(e));
  }
};

function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Bootstrap when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

