// ============================================
// api.js — Stock Price via GAS Proxy
// ============================================

const API = {
  _cache: {},
  _lastFetch: 0,
  CACHE_MS: 30000,

  getProxyUrl() {
    try {
      const raw = localStorage.getItem(AUTH.dataKey('settings'));
      return raw ? JSON.parse(raw).gasProxyUrl || null : null;
    } catch { return null; }
  },

  isTradingHour() {
    const vn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const d = vn.getDay(), h = vn.getHours(), m = vn.getMinutes();
    if (d === 0 || d === 6) return false;
    return (h === 9) || (h === 10) || (h === 11 && m <= 30) ||
           (h === 13) || (h === 14) || (h === 15 && m === 0);
  },

  async fetchPrices(symbols) {
    const proxy = this.getProxyUrl();
    if (!proxy) return this._mock(symbols);
    try {
      const res  = await fetch(`${proxy}?symbols=${symbols.join(',')}&type=quote`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(12000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.message || 'Proxy error');
      const items = json.data || json || [];
      if (!items.length) throw new Error('No data');
      return items.map(x => ({
        symbol:   (x.ticker || x.symbol || '').toUpperCase(),
        price:    x.lastPrice || x.price || 0,
        change:   x.priceChange || x.change || 0,
        pct:      parseFloat((x.percentChange || x.changePercent || 0).toFixed(2)),
        volume:   x.volume || 0,
        isMock:   false
      }));
    } catch (e) {
      console.warn('[API]', e.message);
      return this._mock(symbols);
    }
  },

  _mock(symbols) {
    const bases = { VCB:89500,TCB:28500,FPT:125000,MBB:25000,VIC:45000,
                    HPG:27000,VHM:42000,MSN:68000,VNM:72000,CTG:38000,
                    BID:52000,ACB:25000,SSI:29000,VPB:19500,HDB:22000 };
    return symbols.map(s => {
      const base  = bases[s] || 50000;
      const delta = (Math.random() - 0.5) * 0.03;
      const price = Math.round(base * (1 + delta) / 100) * 100;
      return { symbol: s, price, change: price - base,
               pct: parseFloat((delta * 100).toFixed(2)), volume: 0, isMock: true };
    });
  },

  async getPrices(symbols) {
    if (!symbols.length) return [];
    const now = Date.now();
    const stale = (now - this._lastFetch) > this.CACHE_MS;
    const missing = symbols.filter(s => !this._cache[s]);
    if (!stale && !missing.length) return symbols.map(s => this._cache[s]);
    const fresh = await this.fetchPrices(symbols);
    fresh.forEach(p => { this._cache[p.symbol] = p; });
    this._lastFetch = now;
    return symbols.map(s => this._cache[s] || { symbol: s, price: 0, change: 0, pct: 0, isMock: true });
  },

  clearCache() { this._cache = {}; this._lastFetch = 0; },

  async testProxy(url) {
    const res  = await fetch(`${url}?symbols=VCB&type=quote`, {
      cache: 'no-store', signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.message || 'Lỗi proxy');
    const items = json.data || json || [];
    if (!items.length) throw new Error('Không có dữ liệu');
    return items[0];
  }
};
