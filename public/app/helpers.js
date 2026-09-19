// ============ 全局变量（登录后初始化） ============
let profile, plan, sessions, bodyRecords, measurements, todayIndex, cycleVariants, coreLocks, trainingPhase, exercisePreferences;

function initUserData() {
  trainState = {};
  ensureUserDataCompatibility();

  // 恢复今日动态计划（若存在）
  const rawTodayPlan = LS.get('today_plan', null);
  todayPlan = normalizeTodayPlanData(rawTodayPlan);
  if (!todayPlan || todayPlan.date !== getTodayStr()) {
    if (rawTodayPlan != null && (!todayPlan || rawTodayPlan.date === getTodayStr())) rememberCompatibilityData({ today_plan:rawTodayPlan });
    todayPlan = null;
    LS.set('today_plan', null);
    LS.set('active_training', null);
  } else {
    if (!sameData(rawTodayPlan, todayPlan)) LS.set('today_plan', todayPlan);
    if (todayPlan.status === 'active') {
      try { restoreDynamicTraining(); }
      catch(e) {
        console.warn('进行中训练恢复失败，已从今日计划重新开始:', e);
        LS.set('active_training', null);
        initDynamicTraining();
      }
    }
  }

  if (bodyRecords.length === 0 && profile.weight) {
    const today = new Date();
    bodyRecords = [{ date: formatDate(today), weight: profile.weight, bodyFat: profile.bodyFat }];
    LS.set('body_records', bodyRecords);
  }

  applyPrevRecords();
  if (exerciseCatalog) migrateExerciseReferences();
}

// ============ 登录逻辑 ============
function renderLogin() {
  const users = getAllUsers();
  const existingEl = document.getElementById('existingUsers');
  const input = document.getElementById('loginInput');

  if (users.length > 0) {
    existingEl.innerHTML = `
      <div class="login-user-list">
        ${users.map(u => `<div class="login-user-chip" onclick="selectUser(this.textContent)">${escapeHtml(u)}</div>`).join('')}
      </div>
      <div class="login-divider">或输入新名字</div>`;
  } else {
    existingEl.innerHTML = '';
  }

  input.value = '';
  input.focus();
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('app').style.display = 'none';
  document.getElementById('bottomNav').style.display = 'none';
}

function selectUser(name) {
  document.getElementById('loginInput').value = name;
  doLogin();
}

function doLogin() {
  var name = document.getElementById('loginInput').value.trim();
  if (!name) { alert('请输入你的名字'); return; }
  if (name.length > 12) { alert('名字最多12个字'); return; }

  currentUser = name;
  addUser(name);
  initUserData();

  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('app').style.display = '';
  document.getElementById('bottomNav').style.display = '';

  navigate('home');
}

function switchUser() {
  persistTrainingState();
  if (trainState.timerInterval) clearInterval(trainState.timerInterval);
  if (trainState.restInterval) clearInterval(trainState.restInterval);
  currentUser = '';
  renderLogin();
}

// 监听回车键登录
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('loginInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
});

// ============ 工具函数 ============
function formatDate(d) {
  return (d.getMonth()+1)+'/'+d.getDate();
}

function getTodayStr() {
  const d = new Date();
  return d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0')+'-'+d.getDate().toString().padStart(2,'0');
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function focusKeyFromText(value) {
  const text = String(value || '');
  if (text.includes('背') || text.includes('拉')) return 'pull';
  if (text.includes('腿') || text.includes('臀')) return 'legs';
  return 'push';
}

function focusLabelFromKey(key) {
  return key === 'pull' ? '背' : key === 'legs' ? '腿' : '胸';
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0')+'-'+d.getDate().toString().padStart(2,'0');
}

function getWeekSessions() {
  const ws = getWeekStart();
  return sessions.filter(s => s.date >= ws);
}

function getStreak() {
  // 连续天数：从最近一次训练日期往前逐日回推，断档即停。
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  if (!dates.length) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i-1] + 'T00:00:00');
    const curr = new Date(dates[i] + 'T00:00:00');
    if ((prev - curr) === 86400000) streak++;
    else break;
  }
  return streak;
}

function applyPrevRecords() {
  plan.days.forEach(day => {
    day.exercises.forEach(ex => {
      const lastSession = [...sessions].reverse().find(s => s.dayName === day.name);
      if (lastSession) {
        const lastEx = (lastSession.exercises || []).find(e => e.name === ex.name);
        if (lastEx && Array.isArray(lastEx.sets) && lastEx.sets.length > 0) {
          const lastSet = lastEx.sets[lastEx.sets.length - 1];
          ex.prevW = lastSet.w;
          ex.prevR = lastSet.r;
        }
      }
    });
  });
}

function switchPlan(templateKey) {
  const tmpl = PLAN_TEMPLATES[templateKey];
  if (!tmpl) return;
  plan = { name: tmpl.name, cycle: tmpl.cycle, days: JSON.parse(JSON.stringify(tmpl.days)) };
  LS.set('plan', plan);
  profile.planTemplate = templateKey;
  LS.set('profile', profile);
  todayIndex = 0;
  LS.set('today_index', 0);
  applyPrevRecords();
  resetTraining();
  renderPlanPage();
  renderHomePage();
}
