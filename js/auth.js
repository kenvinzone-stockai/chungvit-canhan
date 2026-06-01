// ============================================
// auth.js — Multi-User Auth Module
// ============================================

const AUTH = {
  USERS_KEY:   'kvz_users_v1',
  SESSION_KEY: 'kvz_session_v1',
  SESSION_MS:  8 * 60 * 60 * 1000,
  MAX_FAIL:    5,
  LOCK_MS:     15 * 60 * 1000,
  AVATARS:     ['🐯','🦊','🐼','🦁','🦋','🐬','🦅','🌟','🔥','⚡','💎','🚀'],

  async _hash(password, username) {
    const enc  = new TextEncoder();
    const data = enc.encode(password + username + 'kvz2024salt');
    const buf  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  },

  _getRegistry() {
    const raw = localStorage.getItem(this.USERS_KEY);
    return raw ? JSON.parse(raw) : { users: [] };
  },
  _saveRegistry(r) { localStorage.setItem(this.USERS_KEY, JSON.stringify(r)); },

  listUsers() { return this._getRegistry().users; },

  findUser(username) {
    return this._getRegistry().users.find(u => u.username === username.toLowerCase().trim());
  },

  async register(username, displayName, password, avatar) {
    const u = username.toLowerCase().trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) throw new Error('Tên đăng nhập 3-20 ký tự, chỉ dùng chữ/số/gạch dưới');
    if (!displayName?.trim()) throw new Error('Vui lòng nhập tên hiển thị');
    if (password.length < 4)  throw new Error('Mật khẩu tối thiểu 4 ký tự');
    const reg = this._getRegistry();
    if (reg.users.find(x => x.username === u)) throw new Error('Tên đăng nhập đã tồn tại');
    const hash = await this._hash(password, u);
    reg.users.push({ username: u, displayName: displayName.trim(), passwordHash: hash,
      avatar: avatar || '🐯', createdAt: Date.now(), lastLogin: null,
      failedAttempts: 0, lockedUntil: null });
    this._saveRegistry(reg);
    this._createSession(reg.users.at(-1));
  },

  async login(username, password) {
    const u   = username.toLowerCase().trim();
    const reg = this._getRegistry();
    const idx = reg.users.findIndex(x => x.username === u);
    if (idx === -1) throw new Error('Tài khoản không tồn tại');
    const user = reg.users[idx];
    if (user.lockedUntil && Date.now() < user.lockedUntil) {
      const min = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      throw new Error(`Tạm khóa, thử lại sau ${min} phút`);
    }
    const hash = await this._hash(password, u);
    if (hash !== user.passwordHash) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= this.MAX_FAIL) {
        user.lockedUntil = Date.now() + this.LOCK_MS;
        user.failedAttempts = 0;
        this._saveRegistry(reg);
        throw new Error('Sai quá nhiều lần, tạm khóa 15 phút');
      }
      this._saveRegistry(reg);
      throw new Error(`Sai mật khẩu (còn ${this.MAX_FAIL - user.failedAttempts} lần)`);
    }
    user.failedAttempts = 0; user.lockedUntil = null; user.lastLogin = Date.now();
    this._saveRegistry(reg);
    this._createSession(user);
  },

  _createSession(user) {
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify({
      username:    user.username,
      displayName: user.displayName,
      avatar:      user.avatar,
      loggedInAt:  Date.now(),
      expiresAt:   Date.now() + this.SESSION_MS
    }));
  },

  getSession() {
    const raw = sessionStorage.getItem(this.SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() > s.expiresAt) { sessionStorage.removeItem(this.SESSION_KEY); return null; }
    return s;
  },

  isAuthenticated() { return this.getSession() !== null; },
  currentUsername()  { return this.getSession()?.username || null; },

  dataKey(type) {
    const u = this.currentUsername();
    if (!u) throw new Error('Chưa đăng nhập');
    return `kvz_${type}_${u}`;
  },

  logout() { sessionStorage.removeItem(this.SESSION_KEY); },

  async changePassword(oldPw, newPw) {
    const s = this.getSession();
    if (!s) throw new Error('Chưa đăng nhập');
    if (newPw.length < 4) throw new Error('Mật khẩu mới tối thiểu 4 ký tự');
    await this.login(s.username, oldPw);
    const hash = await this._hash(newPw, s.username);
    const reg  = this._getRegistry();
    const user = reg.users.find(x => x.username === s.username);
    user.passwordHash = hash;
    this._saveRegistry(reg);
  },

  async deleteAccount(password) {
    const s = this.getSession();
    if (!s) throw new Error('Chưa đăng nhập');
    await this.login(s.username, password);
    ['portfolio','transactions','settings'].forEach(t =>
      localStorage.removeItem(`kvz_${t}_${s.username}`)
    );
    const reg = this._getRegistry();
    reg.users = reg.users.filter(x => x.username !== s.username);
    this._saveRegistry(reg);
    this.logout();
  }
};
