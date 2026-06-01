// ============================================
// store.js — Data Layer (localStorage)
// ============================================

const STORE = {
  // ---- PORTFOLIO ----
  getPortfolio() {
    try {
      const raw = localStorage.getItem(AUTH.dataKey('portfolio'));
      return raw ? JSON.parse(raw) : { stocks: [] };
    } catch { return { stocks: [] }; }
  },
  savePortfolio(data) {
    localStorage.setItem(AUTH.dataKey('portfolio'), JSON.stringify(data));
  },
  addStock(stock) {
    const data = this.getPortfolio();
    stock.id = crypto.randomUUID();
    stock.addedAt = Date.now();
    data.stocks.push(stock);
    this.savePortfolio(data);
    return stock;
  },
  updateStock(id, updates) {
    const data = this.getPortfolio();
    const idx  = data.stocks.findIndex(s => s.id === id);
    if (idx === -1) return;
    data.stocks[idx] = { ...data.stocks[idx], ...updates };
    this.savePortfolio(data);
  },
  removeStock(id) {
    const data  = this.getPortfolio();
    data.stocks = data.stocks.filter(s => s.id !== id);
    this.savePortfolio(data);
  },
  getStocks() { return this.getPortfolio().stocks; },

  // ---- TRANSACTIONS ----
  getTransactions() {
    try {
      const raw = localStorage.getItem(AUTH.dataKey('transactions'));
      return raw ? JSON.parse(raw) : { transactions: [] };
    } catch { return { transactions: [] }; }
  },
  saveTransactions(data) {
    localStorage.setItem(AUTH.dataKey('transactions'), JSON.stringify(data));
  },
  addTransaction(tx) {
    const data = this.getTransactions();
    tx.id = crypto.randomUUID();
    tx.createdAt = Date.now();
    data.transactions.unshift(tx);
    this.saveTransactions(data);
    return tx;
  },
  getTxList() { return this.getTransactions().transactions; },

  // ---- SETTINGS ----
  getSettings() {
    try {
      const raw = localStorage.getItem(AUTH.dataKey('settings'));
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  },
  saveSettings(updates) {
    const cur = this.getSettings();
    localStorage.setItem(AUTH.dataKey('settings'), JSON.stringify({ ...cur, ...updates }));
  },

  // ---- EXPORT / IMPORT ----
  exportAll() {
    return JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      username: AUTH.currentUsername(),
      portfolio:    this.getPortfolio(),
      transactions: this.getTransactions(),
      settings:     this.getSettings()
    }, null, 2);
  },
  importAll(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (!data.portfolio || !data.transactions) throw new Error('File không hợp lệ');
    this.savePortfolio(data.portfolio);
    this.saveTransactions(data.transactions);
    if (data.settings) this.saveSettings(data.settings);
  }
};
