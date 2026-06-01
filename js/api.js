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

  _normalize(x) {
    // Handle mọi field name TCBS có thể trả về
    const price = x.lastPrice || x.price || x.closePrice || x.matchPrice || 0;
    const ref   = x.referencePrice || x.refPrice || price;
    const chg   = x.priceChange || x.change || (price - ref) || 0;
    const pct   = x.percentChange || x.changePercent || x.priceChangeRatio
      || (ref ? (chg / ref) * 100 : 0);
    return {
      symbol:  (x.ticker || x.symbol || x.stockCode || '').toUpperCase(),
      price,
      change:  chg,
      pct:     parseFloat(Number(pct).toFixed(2)),
      volume:  x.volume || x.totalVolume || x.dealVolume || 0,
      isMock:  false
    };
  },

  async fetchPrices(symbols) {
    const proxy = this.getProxyUrl();
    if (!proxy) return this._mock(symbols);
    try {
      const res = await fetch(`${proxy}?symbols=${symbols.join(',')}&type=quote`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      console.log('[API] raw response:', text.slice(0, 300));
      const json = JSON.parse(text);
      if (json.error) throw new Error(json.message || 'Proxy error');

      // TCBS có thể trả về nhiều dạng khác nhau
      let items = [];
      if (Array.isArray(json))            items = json;
      else if (Array.isArray(json.data))  items = json.data;
      else if (json.data && typeof json.data === 'object') items = [json.data];
      else {
        // Thử tìm array bất kỳ trong response
        const arr = Object.values(json).find(v => Array.isArray(v));
        if (arr) items = arr;
      }

      if (!items.length) throw new Error('Không có dữ liệu từ API');
      return items.map(x => this._normalize(x));
    } catch (e) {
      console.warn('[API] fetchPrices error:', e.message);
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
    const res = await fetch(`${url}?symbols=VCB&type=quote`, {
      cache: 'no-store', signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    console.log('[API] testProxy raw:', text.slice(0, 500));
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('Response không phải JSON: ' + text.slice(0,100)); }
    if (json.error) throw new Error(json.message || 'Proxy báo lỗi');

    // Parse flexible
    let items = [];
    if (Array.isArray(json))           items = json;
    else if (Array.isArray(json.data)) items = json.data;
    else {
      const arr = Object.values(json).find(v => Array.isArray(v));
      if (arr) items = arr;
    }
    if (!items.length) throw new Error('API trả về rỗng — kiểm tra GAS script');
    const normalized = this._normalize(items[0]);
    if (!normalized.price) throw new Error('Không đọc được giá — format API thay đổi');
    return normalized;
  }
};
