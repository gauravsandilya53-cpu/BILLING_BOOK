// ========================================================
// BILLING BOOK - Settings & Business Configuration
// ========================================================

const Settings = {
  currentSettings: {},

  async load() {
    try {
      const data = await API.get('/settings');
      if (data.success && data.settings) {
        this.currentSettings = data.settings;
        this.populateForm(data.settings);

        // Apply globally
        window.appCurrency = data.settings.currency_symbol || '₹';
        window.appDefaultTax = parseFloat(data.settings.default_tax_rate || 18);
      }
    } catch (err) {
      console.error('Settings load error:', err);
    }
  },

  populateForm(s) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('set-company-name', s.company_name);
    setVal('set-company-tagline', s.company_tagline);
    setVal('set-email', s.email);
    setVal('set-phone', s.phone);
    setVal('set-address', s.address);
    setVal('set-gstin', s.gstin);
    setVal('set-pan', s.pan);
    setVal('set-currency-symbol', s.currency_symbol || '₹');
    setVal('set-currency-code', s.currency_code || 'INR');
    setVal('set-default-tax-rate', s.default_tax_rate !== undefined ? s.default_tax_rate : 18);
    setVal('set-invoice-prefix', s.invoice_prefix || 'INV-');
    setVal('set-quotation-prefix', s.quotation_prefix || 'QT-');
    setVal('set-default-terms', s.default_terms);
    setVal('set-bank-name', s.bank_name);
    setVal('set-bank-account-no', s.bank_account_no);
    setVal('set-bank-ifsc', s.bank_ifsc);
    setVal('set-bank-upi', s.bank_upi);
  },

  async save(e) {
    e.preventDefault();

    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    const body = {
      company_name: getVal('set-company-name'),
      company_tagline: getVal('set-company-tagline'),
      email: getVal('set-email'),
      phone: getVal('set-phone'),
      address: getVal('set-address'),
      gstin: getVal('set-gstin'),
      pan: getVal('set-pan'),
      currency_symbol: getVal('set-currency-symbol'),
      currency_code: getVal('set-currency-code'),
      default_tax_rate: parseFloat(getVal('set-default-tax-rate') || 18),
      invoice_prefix: getVal('set-invoice-prefix'),
      quotation_prefix: getVal('set-quotation-prefix'),
      default_terms: getVal('set-default-terms'),
      bank_name: getVal('set-bank-name'),
      bank_account_no: getVal('set-bank-account-no'),
      bank_ifsc: getVal('set-bank-ifsc'),
      bank_upi: getVal('set-bank-upi')
    };

    if (!body.company_name) {
      showToast('Company name is required.', 'error');
      return;
    }

    try {
      const data = await API.put('/settings', body);
      showToast(data.message || 'Settings saved successfully!', 'success');
      this.currentSettings = data.settings;
      window.appCurrency = data.settings.currency_symbol || '₹';
      window.appDefaultTax = parseFloat(data.settings.default_tax_rate || 18);
    } catch (err) {
      showToast(err.message || 'Failed to save settings.', 'error');
    }
  }
};

