const STORAGE_KEYS = {
  TRANSACTIONS: 'mft_transactions',
  CATEGORIES: 'mft_categories',
  SETTINGS: 'mft_settings',
};

export const storageService = {
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Storage get error:', err);
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('Storage set error:', err);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.error('Storage remove error:', err);
      return false;
    }
  },

  clearAll() {
    try {
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
      return true;
    } catch (err) {
      console.error('Storage clearAll error:', err);
      return false;
    }
  },
};

export { STORAGE_KEYS };
