// ============================================
// app.js — Main Application
// ============================================

/* ── Helpers ── */
const fmt  = n => Math.abs(n) >= 1e9
  ? (n/1e9).toFixed(2) + ' tỷ'
  : Math.abs(n) >= 1e6
    ? (n/1e6).toFixed(1) + ' tr'
    : n.toLocaleString('vi-VN');

const fmtMoney = n => n.toLocaleString('vi-VN') + 'đ';
const fmtPct   = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const colorCls = n => n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
const el  = id => document.getElementById(id);
const $   = (sel, ctx = document) => ctx.querySelector(sel);
const $$  = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ── Color for symbol badge ── */
const BADGE_COLORS = [
  ['#00d4aa','#071510'],['#3b82f6','#030b1a'],['#f59e0b','#1a0f03'],
  ['#f43f5e','#1a0308'],['#a78bfa','#0d0a1a'],['#34d399','#03140c'],
  ['#fb923c','#1a0c03'],['#38bdf8','#031018'],['#e879f9','#150318'],
];
const badgeColor = sym => {
  let h = 0;
  for (const c of sym) h = ((h << 5) - h) + c.charCodeAt(0);
  const [bg,fg] = BADGE_COLORS[Math.abs(h) % BADGE_COLORS.length];
  return `background:${bg};color:${fg}`;
};

/* ══════════════════════════════════════
   AUTH UI
══════════════════════════════════════ */
let _selectedAvatar = '🐯';

function initAuthUI() {
  _renderAvatarPicker();
  _renderUserList();

  // Login
  el('login-btn').onclick = () => _doAuth(async () => {
    await AUTH.login(el('login-username').value, el('login-password').value);
  }, 'login-err', 'login-btn');
  el('login-password').addEventListener('keydown', e => e.key === 'Enter' && el('login-btn').click());

  // Register
  el('reg-btn').onclick = () => {
    const pw = el('reg-password').value, cf = el('reg-confirm').value;
    if (pw !== cf) { _showAuthErr('reg-err','Mật khẩu nhập lại không khớp'); return; }
    _doAuth(async () => {
      await AUTH.register(el('reg-username').value, el('reg-displayname').value, pw, _selectedAvatar);
    }, 'reg-err', 'reg-btn');
  };
  el('reg-confirm').addEventListener('keydown', e => e.key === 'Enter' && el('reg-btn').click());
}

function _renderAvatarPicker() {
  const grid = el('avatar-grid');
  AUTH.AVATARS.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'avatar-opt' + (a === _selectedAvatar ? ' selected' : '');
    btn.textContent = a; btn.type = 'button';
    btn.onclick = () => {
      _selectedAvatar = a;
      $$('.avatar-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    grid.appendChild(btn);
  });
}

function _renderUserList() {
  const users = AUTH.listUsers();
  const list  = el('user-quick-list');
  const div   = el('auth-divider');
  if (!users.length) { list.style.display = 'none'; if(div) div.style.display = 'none'; return; }
  list.innerHTML = '';
  users.forEach(u => {
    const btn = document.createElement('button');
    btn.className = 'user-quick-btn'; btn.type = 'button';
    const last = u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('vi-VN') : 'Chưa đăng nhập';
    btn.innerHTML = `
      <span class="user-quick-avatar">${u.avatar}</span>
      <span class="user-quick-name">${u.displayName}</span>
      <span class="user-quick-last">${last}</span>
      <span class="user-quick-arrow">›</span>`;
    btn.onclick = () => {
      el('login-username').value = u.username;
      showAuthView('login-view');
      el('login-password').focus();
    };
    list.appendChild(btn);
  });
}

async function _doAuth(fn, errId, btnId) {
  const btn = el(btnId);
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = 'Đang xử lý…';
  try {
    await fn();
    el('auth-screen').classList.add('hidden');
    el('app').classList.remove('hidden');
    startApp();
  } catch(e) {
    _showAuthErr(errId, e.message);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

function _showAuthErr(id, msg) {
  const e = el(id);
  e.textContent = msg; e.classList.remove('hidden');
  setTimeout(() => e.classList.add('hidden'), 4000);
}

function showAuthView(view) {
  ['welcome-view','login-view','register-view'].forEach(v =>
    el(v).classList.toggle('hidden', v !== view));
  if (view === 'login-view') el('login-password').value = '';
}

/* ══════════════════════════════════════
   APP SHELL
══════════════════════════════════════ */
let _currentTab = 'vnindex';
let _refreshTimer = null;

function startApp() {
  const s = AUTH.getSession();
  el('header-avatar').textContent = s.avatar;
  el('header-username').textContent = s.displayName;

  // Nav
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Header user tap → settings
  el('header-user').onclick = () => switchTab('settings');

  switchTab('vnindex');
  loadVNINDEX();
  startAutoRefresh();
}

function switchTab(tab) {
  _currentTab = tab;
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  if (tab === 'portfolio')  renderPortfolio();
  if (tab === 'history')    renderHistory();
  if (tab === 'settings')   loadSettingsUI();
}

/* ══════════════════════════════════════
   VNINDEX TAB
══════════════════════════════════════ */
function loadVNINDEX() {
  // Static demo data — bạn có thể kết nối API của vnindex.kenvinzone.com sau
  const data = {
    index:  1297.9,
    change: +10.45,
    pct:    +0.81,
    time:   '14:30',
    score:  75,
    signal: 'MUA MẠNH',
    signalType: 'buy',
    bars: [
      { label: 'Kỹ thuật (MA/RSI)', val: 80, color: '#3b82f6' },
      { label: 'Dòng tiền lớn',     val: 70, color: '#00d4aa' },
      { label: 'Timing TT',         val: 65, color: '#f59e0b' },
      { label: 'Độ rộng TT',        val: 75, color: '#a78bfa' },
    ],
    comment: 'Thị trường duy trì xu hướng <span class="hl-green">TĂNG TRƯỞNG TÍCH CỰC</span> ngắn hạn nhờ dòng tiền nâng đỡ từ khối ngoại tại các nhóm ngành trụ (Bank, Thép). Nhà đầu tư có thể gia tăng tỷ trọng khi chỉ số lùi về vùng hỗ trợ <span class="hl-orange">1,275 – 1,280 điểm</span>. Cảnh giác tại mốc kháng cự mạnh <span class="hl-red">1,310</span>.',
    liquidity: '19.4K tỷ',
    foreignNet: '+280 tỷ',
    breadth: '65%',
    marginRisk: 'Trung Bình',
    signals: [
      { icon: '✅', title: 'Áp lực chốt lời sau tuần tăng mạnh', sub: 'VNINDEX tăng mạnh lên test 1290, lực chốt lời bình thường.' },
      { icon: '⚠️', title: 'Dòng tiền nội thận trọng cuối tuần', sub: 'Volume ratio 0.38 — NĐT nội chờ đợi, không vội giải ngân.' },
      { icon: '✅', title: 'Cấu trúc bullish khung lớn còn nguyên vẹn', sub: 'W1/3D vẫn Full Bullish EMA, chỉ là pullback trong uptrend.' },
    ],
    sectors: [
      { type: 'lead',    label: 'Dẫn dắt TT',        stocks: 'Ngân hàng lớn · Chứng khoán' },
      { type: 'rising',  label: 'Đang nổi lên',       stocks: 'BĐS khu công nghiệp · Công nghệ' },
      { type: 'caution', label: 'Cần trọng rủi ro',   stocks: 'BĐS nhà ở · Thép' },
      { type: 'avoid',   label: 'Tuyệt đối tránh',    stocks: 'Penny stocks · Nhóm tăng nóng 30%+' },
    ],
    expert: 'Duy trì tập trung nhóm <strong>Bất động sản KCN</strong> và <strong>Ngân hàng thương mại</strong> có kết quả kinh doanh tốt. Tránh đua lệnh các nhóm đã tăng nóng 3–4 phiên.',
  };
  _renderVNINDEX(data);
}

function _renderVNINDEX(d) {
  // Header
  el('vni-value').textContent = d.index.toLocaleString('vi-VN',{minimumFractionDigits:1});
  const chEl = el('vni-change');
  chEl.innerHTML = `<span class="${colorCls(d.change)}">${d.change>=0?'+':''}${d.change.toFixed(2)} (${fmtPct(d.pct)})</span>`;

  // Time badge
  el('vni-time').textContent = d.time;

  // Gauge
  _animateGauge(d.score, d.signalType);

  // Signal badge
  const sb = el('signal-badge');
  sb.className = `signal-badge ${d.signalType}`;
  sb.innerHTML = `<span class="signal-dot"></span>${d.signal}`;

  // Score bars
  const barsEl = el('score-bars');
  barsEl.innerHTML = '';
  d.bars.forEach(b => {
    const row = document.createElement('div');
    row.className = 'score-bar-row';
    row.innerHTML = `
      <span class="score-bar-label">${b.label}</span>
      <div class="score-bar-track"><div class="score-bar-fill" style="width:0%;background:${b.color}"></div></div>
      <span class="score-bar-val">${b.val}%</span>`;
    barsEl.appendChild(row);
    requestAnimationFrame(() => {
      setTimeout(() => row.querySelector('.score-bar-fill').style.width = b.val + '%', 100);
    });
  });

  // Market comment
  el('market-comment').innerHTML = d.comment;

  // Metrics
  el('m-liquidity').textContent   = d.liquidity;
  el('m-foreign').textContent     = d.foreignNet;
  el('m-foreign').className       = 'metric-value ' + (d.foreignNet.startsWith('+') ? 'up' : 'down');
  el('m-breadth').textContent     = d.breadth;
  el('m-margin').textContent      = d.marginRisk;

  // Signals
  const sigList = el('signals-list');
  sigList.innerHTML = '';
  d.signals.forEach(s => {
    const div = document.createElement('div');
    div.className = 'signal-item';
    div.innerHTML = `<span class="signal-icon">${s.icon}</span>
      <div><div class="signal-text-main">${s.title}</div>
      <div class="signal-text-sub">${s.sub}</div></div>`;
    sigList.appendChild(div);
  });

  // Sectors
  const secList = el('sector-list');
  secList.innerHTML = '';
  d.sectors.forEach(s => {
    const div = document.createElement('div');
    div.className = 'sector-item';
    div.innerHTML = `<span class="sector-dot ${s.type}"></span>
      <span class="sector-tag ${s.type}">${s.label}</span>
      <span class="sector-stocks">${s.stocks}</span>`;
    secList.appendChild(div);
  });

  // Expert
  el('expert-box').innerHTML = d.expert;
}

function _animateGauge(score, type) {
  const svg   = el('gauge-svg');
  const fill  = el('gauge-fill');
  const scoreEl = el('gauge-score');
  const r     = 44;
  const circ  = 2 * Math.PI * r;
  const colors = { buy: '#00d4aa', hold: '#f59e0b', sell: '#f43f5e' };
  fill.style.stroke = colors[type] || '#00d4aa';
  fill.setAttribute('stroke-dasharray', circ);
  fill.setAttribute('stroke-dashoffset', circ);
  scoreEl.textContent = '0';
  scoreEl.className = 'gauge-score ' + colorCls(score - 50);

  let current = 0;
  const target  = score;
  const step = () => {
    current = Math.min(current + 1.5, target);
    const offset = circ - (current / 100) * circ;
    fill.style.strokeDashoffset = offset;
    scoreEl.textContent = Math.round(current);
    if (current < target) requestAnimationFrame(step);
  };
  setTimeout(() => requestAnimationFrame(step), 200);
}

/* ══════════════════════════════════════
   PORTFOLIO TAB
══════════════════════════════════════ */
let _prices = {};

async function renderPortfolio() {
  const stocks = STORE.getStocks();
  _renderPortfolioSummary(stocks, _prices);
  _renderStockList(stocks, _prices);
  if (stocks.length) {
    const symbols = [...new Set(stocks.map(s => s.symbol))];
    const prices  = await API.getPrices(symbols);
    prices.forEach(p => { _prices[p.symbol] = p; });
    _renderPortfolioSummary(stocks, _prices);
    _renderStockList(stocks, _prices);
    _updateProxyBanner(prices.some(p => p.isMock));
  }
}

function _renderPortfolioSummary(stocks, prices) {
  let totalValue = 0, totalCost = 0;
  stocks.forEach(s => {
    const p = prices[s.symbol];
    const price = p ? p.price : s.avgCost;
    totalValue += price * s.quantity;
    totalCost  += s.avgCost * s.quantity;
  });
  const pnl    = totalValue - totalCost;
  const pnlPct = totalCost ? (pnl / totalCost) * 100 : 0;

  el('pf-total').textContent   = fmtMoney(Math.round(totalValue));
  el('pf-pnl-val').textContent = (pnl >= 0 ? '+' : '') + fmtMoney(Math.round(pnl));
  el('pf-pnl-val').className   = 'pf-pnl-value ' + colorCls(pnl);
  el('pf-pnl-pct').textContent = fmtPct(pnlPct);
  el('pf-pnl-pct').className   = 'pf-pnl-value ' + colorCls(pnl);
  el('pf-cost').textContent    = fmtMoney(Math.round(totalCost));
}

function _renderStockList(stocks, prices) {
  const list = el('stock-list');
  if (!stocks.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-title">Danh mục trống</div>
      <div class="empty-state-sub">Nhấn + để thêm cổ phiếu đầu tiên</div>
    </div>`; return;
  }
  list.innerHTML = '';
  stocks.forEach(s => {
    const p     = prices[s.symbol];
    const price = p ? p.price : s.avgCost;
    const pct   = p ? p.pct   : 0;
    const chg   = p ? p.change : 0;
    const value = price * s.quantity;
    const pnl   = (price - s.avgCost) * s.quantity;
    const pnlPct= ((price - s.avgCost) / s.avgCost) * 100;

    const card = document.createElement('div');
    card.className = 'stock-card';
    card.dataset.id = s.id;
    card.innerHTML = `
      <div class="stock-card-main">
        <div class="stock-symbol-badge" style="${badgeColor(s.symbol)}">${s.symbol}</div>
        <div class="stock-info">
          <div class="stock-name">${s.name || s.symbol}</div>
          <div class="stock-price-row">
            <span class="stock-price ${colorCls(chg)}">${price.toLocaleString('vi-VN')}</span>
            <span class="stock-change ${colorCls(chg)}">${fmtPct(pct)}</span>
            ${p?.isMock ? '<span style="font-size:9px;color:var(--text-3);margin-left:4px">~giả lập</span>' : ''}
          </div>
        </div>
        <div class="stock-right">
          <div class="stock-value">${fmt(value)}đ</div>
          <div class="stock-qty">${s.quantity.toLocaleString()} CP</div>
        </div>
      </div>
      <div class="stock-card-detail">
        <div class="stock-detail-grid">
          <div class="stock-detail-item">
            <span class="stock-detail-label">Giá vốn</span>
            <span class="stock-detail-value">${s.avgCost.toLocaleString('vi-VN')}</span>
          </div>
          <div class="stock-detail-item">
            <span class="stock-detail-label">Lãi/Lỗ</span>
            <span class="stock-detail-value ${colorCls(pnl)}">${pnl>=0?'+':''}${fmt(pnl)}đ</span>
          </div>
          <div class="stock-detail-item">
            <span class="stock-detail-label">% Lãi/Lỗ</span>
            <span class="stock-detail-value ${colorCls(pnl)}">${fmtPct(pnlPct)}</span>
          </div>
          <div class="stock-detail-item">
            <span class="stock-detail-label">Ngày mua</span>
            <span class="stock-detail-value">${s.buyDate || '—'}</span>
          </div>
          <div class="stock-detail-item">
            <span class="stock-detail-label">Giá trị vốn</span>
            <span class="stock-detail-value">${fmt(s.avgCost * s.quantity)}đ</span>
          </div>
          <div class="stock-detail-item">
            <span class="stock-detail-label">Vol hiện tại</span>
            <span class="stock-detail-value">${p?.volume ? fmt(p.volume) : '—'}</span>
          </div>
        </div>
        ${s.note ? `<div style="font-size:12px;color:var(--text-3);margin-top:10px;padding:8px;background:var(--bg-input);border-radius:6px">${s.note}</div>` : ''}
        <div class="stock-actions">
          <button class="stock-action-btn sell" onclick="openSellModal('${s.id}')">Chốt lời / Bán</button>
          <button class="stock-action-btn edit" onclick="openEditModal('${s.id}')">Sửa</button>
          <button class="stock-action-btn del"  onclick="deleteStock('${s.id}')">Xóa</button>
        </div>
      </div>`;
    card.querySelector('.stock-card-main').addEventListener('click', () => {
      card.classList.toggle('expanded');
    });
    list.appendChild(card);
  });
}

function _updateProxyBanner(isMock) {
  const b = el('proxy-banner');
  if (!b) return;
  if (isMock) {
    b.className = 'proxy-banner warn';
    b.innerHTML = `<span>⚠️</span><span class="proxy-banner-text">Đang dùng <strong>giá giả lập</strong> — Cài proxy GAS để lấy giá thực</span>
      <button class="proxy-banner-btn" onclick="switchTab('settings')">Cài đặt</button>`;
    b.classList.remove('hidden');
  } else {
    b.className = 'proxy-banner ok hidden';
  }
}

function deleteStock(id) {
  if (!confirm('Xóa cổ phiếu này khỏi danh mục?')) return;
  STORE.removeStock(id);
  renderPortfolio();
  showToast('Đã xóa');
}

/* ── Add/Edit Stock Modal ── */
function openAddModal() { _openStockModal(null); }
function openEditModal(id) {
  const s = STORE.getStocks().find(x => x.id === id);
  if (s) _openStockModal(s);
}

function _openStockModal(stock) {
  const modal = el('stock-modal');
  el('stock-modal-title').textContent = stock ? 'Sửa cổ phiếu' : 'Thêm cổ phiếu';
  el('sm-symbol').value   = stock?.symbol   || '';
  el('sm-name').value     = stock?.name     || '';
  el('sm-qty').value      = stock?.quantity || '';
  el('sm-cost').value     = stock?.avgCost  || '';
  el('sm-date').value     = stock?.buyDate  || new Date().toISOString().split('T')[0];
  el('sm-note').value     = stock?.note     || '';

  el('sm-save').onclick = () => {
    const sym = el('sm-symbol').value.toUpperCase().trim();
    const qty = parseInt(el('sm-qty').value);
    const cost= parseInt(el('sm-cost').value);
    if (!sym || !qty || !cost) { showToast('Vui lòng điền đầy đủ thông tin', 'error'); return; }
    const data = { symbol: sym, name: el('sm-name').value.trim() || sym,
      quantity: qty, avgCost: cost, buyDate: el('sm-date').value, note: el('sm-note').value.trim() };
    if (stock) { STORE.updateStock(stock.id, data); showToast('Đã cập nhật'); }
    else {
      STORE.addStock(data);
      STORE.addTransaction({ type: 'BUY', symbol: sym, quantity: qty, price: cost,
        date: el('sm-date').value, note: el('sm-note').value.trim() });
      showToast('Đã thêm ' + sym);
    }
    closeModal('stock-modal');
    renderPortfolio();
  };
  modal.classList.remove('hidden');
}

/* ── Sell Modal ── */
function openSellModal(id) {
  const s = STORE.getStocks().find(x => x.id === id);
  if (!s) return;
  const modal = el('sell-modal');
  el('sell-symbol').textContent = s.symbol;
  el('sell-qty').max   = s.quantity;
  el('sell-qty').value = s.quantity;
  el('sell-price').value = _prices[s.symbol]?.price || s.avgCost;
  el('sell-date').value  = new Date().toISOString().split('T')[0];

  el('sell-save').onclick = () => {
    const qty   = parseInt(el('sell-qty').value);
    const price = parseInt(el('sell-price').value);
    if (!qty || !price || qty > s.quantity) { showToast('Số lượng không hợp lệ', 'error'); return; }
    const pnl = (price - s.avgCost) * qty;
    STORE.addTransaction({ type: pnl >= 0 ? 'TAKE_PROFIT' : 'SELL',
      symbol: s.symbol, quantity: qty, price, date: el('sell-date').value,
      avgCost: s.avgCost, pnl });
    if (qty >= s.quantity) STORE.removeStock(s.id);
    else STORE.updateStock(s.id, { quantity: s.quantity - qty });
    closeModal('sell-modal');
    renderPortfolio();
    showToast(`${pnl >= 0 ? '🎉 Chốt lời' : 'Bán'} ${s.symbol} ${pnl>=0?'+':''}${fmt(pnl)}đ`, pnl>=0?'success':'error');
  };
  modal.classList.remove('hidden');
}

function closeModal(id) { el(id).classList.add('hidden'); }

/* ── Auto refresh ── */
function startAutoRefresh() {
  stopAutoRefresh();
  const tick = async () => {
    if (_currentTab === 'portfolio' && STORE.getStocks().length) {
      API.clearCache();
      await renderPortfolio();
    }
    const delay = API.isTradingHour() ? 30000 : 300000;
    _refreshTimer = setTimeout(tick, delay);
  };
  _refreshTimer = setTimeout(tick, 30000);
}
function stopAutoRefresh() { if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; } }

document.addEventListener('visibilitychange', () => {
  document.hidden ? stopAutoRefresh() : startAutoRefresh();
});

/* ══════════════════════════════════════
   HISTORY TAB
══════════════════════════════════════ */
let _histFilter = 'ALL';

function renderHistory() {
  const all  = STORE.getTxList();
  const list = _histFilter === 'ALL' ? all
    : all.filter(t => t.type === _histFilter);

  // Filter chips
  $$('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === _histFilter));

  const container = el('tx-list');
  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-title">Chưa có giao dịch</div>
      <div class="empty-state-sub">Lịch sử mua/bán sẽ hiển thị tại đây</div>
    </div>`; return;
  }

  // Group by month
  const groups = {};
  list.forEach(t => {
    const key = t.date ? t.date.slice(0,7) : 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  container.innerHTML = '';
  Object.entries(groups).sort(([a],[b]) => b.localeCompare(a)).forEach(([month, txs]) => {
    const [y,m] = month.split('-');
    const monthPnl = txs.reduce((s,t) => s + (t.pnl || 0), 0);

    const group = document.createElement('div');
    group.className = 'month-group';
    group.innerHTML = `
      <div class="month-header">
        <span class="month-title">Tháng ${m}/${y} · ${txs.length} giao dịch</span>
        ${monthPnl !== 0 ? `<span class="month-pnl ${colorCls(monthPnl)}">${monthPnl>=0?'+':''}${fmt(monthPnl)}đ</span>` : ''}
      </div>`;

    txs.forEach(t => {
      const item = document.createElement('div');
      item.className = 'tx-item';
      const icons = { BUY: '🟢', SELL: '🔴', TAKE_PROFIT: '⭐' };
      const labels= { BUY: 'MUA', SELL: 'BÁN', TAKE_PROFIT: 'CHỐT LỜI' };
      const types = { BUY: 'buy', SELL: 'sell', TAKE_PROFIT: 'profit' };
      const total = t.quantity * t.price;
      item.innerHTML = `
        <div class="tx-type-badge ${types[t.type] || 'buy'}">${icons[t.type] || '📌'}</div>
        <div class="tx-body">
          <div class="tx-symbol">${t.symbol} <span style="font-size:11px;font-weight:400;color:var(--text-3)">${labels[t.type]||t.type}</span></div>
          <div class="tx-desc">${t.quantity?.toLocaleString()} CP × ${t.price?.toLocaleString('vi-VN')}đ${t.note ? ' · ' + t.note : ''}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${t.pnl != null ? colorCls(t.pnl) : ''}">
            ${t.pnl != null ? (t.pnl>=0?'+':'')+fmt(t.pnl)+'đ' : fmt(total)+'đ'}
          </div>
          <div class="tx-date">${t.date || ''}</div>
        </div>`;
      group.appendChild(item);
    });
    container.appendChild(group);
  });
}

// Filter chips click
document.addEventListener('click', e => {
  if (e.target.classList.contains('filter-chip')) {
    _histFilter = e.target.dataset.filter;
    renderHistory();
  }
});

/* ══════════════════════════════════════
   SETTINGS TAB
══════════════════════════════════════ */
function loadSettingsUI() {
  const s = AUTH.getSession();
  el('settings-avatar').textContent = s.avatar;
  el('settings-name').textContent   = s.displayName;
  el('settings-handle').textContent = '@' + s.username;

  const settings = STORE.getSettings();
  el('gas-url-input').value = settings.gasProxyUrl || '';
  _updateProxyStatusDot(settings.gasProxyUrl);
}

function _updateProxyStatusDot(url) {
  const dot  = el('proxy-dot');
  const text = el('proxy-dot-text');
  if (!url) {
    dot.className = 'status-dot idle';
    text.textContent = 'Chưa cấu hình — đang dùng giá giả lập';
  } else {
    dot.className = 'status-dot warn';
    text.textContent = 'Đã nhập URL — nhấn Test để kiểm tra';
  }
}

async function saveProxyUrl() {
  const url = el('gas-url-input').value.trim();
  if (url && !url.startsWith('https://script.google.com/macros/s/')) {
    showToast('URL không đúng định dạng GAS', 'error'); return;
  }
  STORE.saveSettings({ gasProxyUrl: url });
  API.clearCache();
  showToast('Đã lưu URL proxy');
  _updateProxyStatusDot(url);
  if (url) testProxy();
}

async function testProxy() {
  const url = el('gas-url-input').value.trim();
  if (!url) { showToast('Chưa nhập URL', 'error'); return; }
  const dot  = el('proxy-dot');
  const text = el('proxy-dot-text');
  dot.className = 'status-dot warn';
  text.textContent = 'Đang kiểm tra…';
  try {
    const item = await API.testProxy(url);
    dot.className = 'status-dot ok';
    text.textContent = `✅ Kết nối OK · VCB = ${item.price?.toLocaleString('vi-VN')}đ`;
    API.clearCache();
    showToast('Kết nối thành công!');
  } catch(e) {
    dot.className = 'status-dot err';
    text.textContent = '❌ Lỗi: ' + e.message;
    showToast('Lỗi kết nối: ' + e.message, 'error');
  }
}

function exportData() {
  const json = STORE.exportAll();
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `portfolio_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('Đã xuất file backup');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        STORE.importAll(ev.target.result);
        renderPortfolio();
        renderHistory();
        showToast('Import thành công!');
      } catch(err) {
        showToast('File không hợp lệ: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function confirmLogout() {
  if (!confirm('Đăng xuất khỏi tài khoản này?')) return;
  AUTH.logout();
  location.reload();
}

function openChangePassword() {
  el('chpw-modal').classList.remove('hidden');
  el('chpw-old').value = ''; el('chpw-new').value = ''; el('chpw-confirm').value = '';
}

async function saveChangePassword() {
  const old = el('chpw-old').value, nw = el('chpw-new').value, cf = el('chpw-confirm').value;
  if (nw !== cf) { showToast('Mật khẩu mới không khớp', 'error'); return; }
  try {
    await AUTH.changePassword(old, nw);
    closeModal('chpw-modal');
    showToast('Đổi mật khẩu thành công');
  } catch(e) { showToast(e.message, 'error'); }
}

async function confirmDeleteAccount() {
  const pw = prompt('Nhập mật khẩu để xác nhận xóa tài khoản:');
  if (!pw) return;
  try {
    await AUTH.deleteAccount(pw);
    location.reload();
  } catch(e) { showToast(e.message, 'error'); }
}

/* ══════════════════════════════════════
   BOOT
══════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  if (AUTH.isAuthenticated()) {
    el('auth-screen').classList.add('hidden');
    el('app').classList.remove('hidden');
    startApp();
  } else {
    initAuthUI();
  }
});
