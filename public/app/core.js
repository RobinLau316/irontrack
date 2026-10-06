// ============ 全局 API Key（所有用户共享） ============
function getGlobalApiKey() {
  try { return localStorage.getItem('irontrack_global_apikey') || ''; }
  catch(e) { return ''; }
}
function setGlobalApiKey(key) {
  try { localStorage.setItem('irontrack_global_apikey', key); }
  catch(e) { console.warn('存储 API Key 失败:', e); }
}

// ============ 用户管理 ============
let currentUser = '';

function getAllUsers() {
  try {
    const raw = localStorage.getItem('irontrack_users');
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveAllUsers(users) {
  try { localStorage.setItem('irontrack_users', JSON.stringify(users)); }
  catch(e) { console.warn('存储用户列表失败:', e); }
}

function addUser(name) {
  const users = getAllUsers();
  if (!users.includes(name)) {
    users.push(name);
    saveAllUsers(users);
  }
}

// ============ localStorage 存储引擎（按用户命名空间） ============
const LS = {
  blocked: false,
  error: '',
  pending: null,
  key(key) { return 'irontrack_'+currentUser+'_'+key; },
  raw(key) {
    if (this.pending && Object.prototype.hasOwnProperty.call(this.pending, key)) return this.pending[key];
    return localStorage.getItem(this.key(key));
  },
  get(key, fallback) {
    if (!currentUser) return fallback;
    try { const v = this.raw(key); return v ? JSON.parse(v) : fallback; }
    catch(e) { return fallback; }
  },
  set(key, val) {
    if (!currentUser || this.blocked) return false;
    try { localStorage.setItem(this.key(key), JSON.stringify(val)); return true; }
    catch(e) { console.warn('存储失败:', e); return false; }
  },
  // Write-ahead undo journal: a failed/interrupted group never advances only part of a session.
  rollback(before) {
    let ok = true;
    Object.entries(before).forEach(([key, raw]) => {
      try {
        if (localStorage.getItem(this.key(key)) === raw) return;
        if (raw === null) localStorage.removeItem(this.key(key));
        else localStorage.setItem(this.key(key), raw);
        if (localStorage.getItem(this.key(key)) !== raw) ok = false;
      } catch(e) { ok = false; }
    });
    return ok;
  },
  recover() {
    this.blocked = false;
    this.pending = null;
    this.error = '';
    try {
      const raw = localStorage.getItem(this.key('write_journal'));
      if (!raw) return true;
      const journal = JSON.parse(raw);
      if (!journal.before || typeof journal.before !== 'object' || Array.isArray(journal.before) ||
          Object.values(journal.before).some(v => v !== null && typeof v !== 'string')) throw new Error('恢复日志格式异常');
      this.pending = journal.before;
      if (!this.rollback(journal.before)) throw new Error('未能恢复上次写入前的数据');
      localStorage.removeItem(this.key('write_journal'));
      this.pending = null;
      return true;
    } catch(e) {
      this.blocked = true;
      this.error = '本地写入恢复未完成，已暂停写入。请先导出备份，再重试恢复。';
      return false;
    }
  },
  transaction(changes) {
    if (!currentUser || this.blocked) return false;
    let before;
    try {
      if (localStorage.getItem(this.key('write_journal')) && !this.recover()) return false;
      const entries = Object.entries(changes).map(([key, value]) => [key, JSON.stringify(value)]);
      before = Object.fromEntries(entries.map(([key]) => [key, localStorage.getItem(this.key(key))]));
      localStorage.setItem(this.key('write_journal'), JSON.stringify({ version:1, before }));
      for (const [key, value] of entries) {
        localStorage.setItem(this.key(key), value);
        if (localStorage.getItem(this.key(key)) !== value) throw new Error('写入校验失败');
      }
      localStorage.removeItem(this.key('write_journal'));
      this.error = '';
      return true;
    } catch(e) {
      this.error = '本地保存失败，可能是空间不足或浏览器禁止写入。';
      if (before) {
        const restored = this.rollback(before);
        try { if (restored) localStorage.removeItem(this.key('write_journal')); }
        catch(ignore) { this.blocked = true; }
        if (!restored) { this.blocked = true; this.pending = before; }
      }
      return false;
    }
  }
};
