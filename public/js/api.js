// ========================================================
// BILLING BOOK - Core API Client & Networking
// ========================================================

const API_BASE = '/api';

const API = {
  getToken() {
    return localStorage.getItem('billing_book_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('billing_book_token', token);
    } else {
      localStorage.removeItem('billing_book_token');
    }
  },

  getCurrentUser() {
    const raw = localStorage.getItem('billing_book_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem('billing_book_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('billing_book_user');
    }
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        // Expired or invalid token
        this.setToken(null);
        this.setCurrentUser(null);
        window.dispatchEvent(new CustomEvent('auth-expired'));
        throw new Error(data.message || 'Session expired. Please log in.');
      }

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err.message);
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

