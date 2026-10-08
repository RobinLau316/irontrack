// ============ 全局变量（登录后初始化） ============
let profile, plan, sessions, bodyRecords, measurements, todayIndex, cycleVariants, coreLocks, trainingPhase, exercisePreferences;

function initUserData() {
  if (trainState.timerInterval) clearInterval(trainState.timerInterval);
  if (trainState.restInterval) clearInterval(trainState.restInterval);
  trainState = {};
  pendingRecoveryData = null;
  dataRecoveryNotice = '';
  LS.recover();
  const loaded = ensureUserDataCompatibility();
  todayPlan = loaded.today_plan;
  if (todayPlan?.status === 'active') restoreDynamicTraining(loaded.active_training);
  ensurePplPlan();

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
  if (todayPlan?.status === 'active' && !persistTrainingState()) { alert('当前训练尚未写入，请先导出备份或重试保存后再切换用户。'); return; }
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

function sessionIsComplete(session) {
  const exercises=session?.exercises||[];
  if(!exercises.length||!exercises.some(ex=>(ex.sets||[]).length))return false;
  if(exercises.some(ex=>ex.status!=null||ex.completed!=null))return exercises.every(ex=>ex.status==='completed'||ex.completed===true);
  return true; // 旧记录没有完成状态字段，保留其既有统计口径。
}

function getWeekSessions() {
  const ws = getWeekStart();
  return sessions.filter(s => s.date >= ws && sessionIsComplete(s));
}

function getStreak() {
  // 连续天数：从最近一次训练日期往前逐日回推，断档即停。
  const dates = [...new Set(sessions.filter(sessionIsComplete).map(s => s.date))].sort().reverse();
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
  if (trainState.pendingCompletion && !trainState.saved) { alert('本次训练尚未保存，请先重试保存或导出备份。'); return; }
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
