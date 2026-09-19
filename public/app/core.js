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
  get(key, fallback) {
    if (!currentUser) return fallback;
    try { const v = localStorage.getItem('irontrack_'+currentUser+'_'+key); return v ? JSON.parse(v) : fallback; }
    catch(e) { return fallback; }
  },
  set(key, val) {
    if (!currentUser) return false;
    try { localStorage.setItem('irontrack_'+currentUser+'_'+key, JSON.stringify(val)); return true; }
    catch(e) { console.warn('存储失败:', e); return false; }
  }
};
