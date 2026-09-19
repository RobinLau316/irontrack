// ============ 导航 ============
let currentPage = 'home';

function navigate(page) {
  document.body.classList.remove('keyboard-active');
  if (page !== 'training') setTrainingFixedAction(false);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  try {
    if (page === 'home') renderHomePage();
    if (page === 'plan') renderPlanPage();
    if (page === 'training') enterTraining();
    if (page === 'data') renderDataChart('weight');
    if (page === 'profile') renderProfilePage();
  } catch(e) {
    console.error('页面加载失败:', page, e);
    renderPageRecovery(page);
  } finally {
    window.scrollTo({ top:0, left:0, behavior:'auto' });
  }
}

function renderPageRecovery(page) {
  const target = document.getElementById('page-' + page);
  if (!target) return;
  const host = target.querySelector('[id$="Content"]') || target;
  host.innerHTML = `
    <div class="card" style="margin-top:18px">
      <div class="section-title">页面需要恢复</div>
      <div class="text-muted text-sm" style="line-height:1.6;margin-bottom:16px">检测到旧数据不完整，系统会保留训练历史并修复运行状态。</div>
      <button class="btn btn-accent" onclick="repairAndRetryPage('${page}')">修复并重新加载</button>
    </div>`;
}

function repairAndRetryPage(page) {
  ensureUserDataCompatibility();
  navigate(page);
}

// ============ 训练入口：动态生成今日计划 ============
let todayPlan = null;   // 今日动态计划
let setupSel = cloneData(DEFAULT_SETUP_STATE);

const FOCUS_OPTIONS = ['胸','背','腿','肩','手臂','全身'];
const STATE_OPTIONS = [
  {k:'精力充沛',e:'⚡'},{k:'状态一般',e:'😊'},{k:'有些疲惫',e:'🌤'},{k:'比较疲劳',e:'😴'}
];
const TIME_OPTIONS = [{k:'30分钟',e:'⏱'},{k:'45分钟',e:'⏳'},{k:'60分钟',e:'🕐'},{k:'90分钟',e:'🕒'}];
const ENV_OPTIONS = [
  {k:'健身房',e:'🏢'},{k:'家用哑铃',e:'🏠'},{k:'家用徒手',e:'🧘'}
];
const DISCOMFORT_OPTIONS = ['无','肩','肘/腕','腰背','髋','膝','踝'];

function enterTraining() {
  if (!currentUser) return;
  ensureExerciseCatalog().then(() => {
    if (document.getElementById('page-training')?.classList.contains('active') && !todayPlan) renderTrainingSetup();
  });
  // 若已有今日计划，进入预览或继续训练。
  if (todayPlan && todayPlan.date === getTodayStr()) {
    renderTrainingPage();
    return;
  }
  renderTrainingSetup();
}

function setTrainingFixedAction(enabled) {
  const page = document.getElementById('page-training');
  if (page) page.classList.toggle('has-fixed-action', !!enabled);
  if (!enabled) document.body.classList.remove('keyboard-active');
}

function renderTrainingSetup() {
  if (!currentUser) return;
  setTrainingFixedAction(false);
  // 按分化方式 + 最近记录自动推荐今天该练的部位
  const suggested = suggestTodayFocus();
  const savedDraft = LS.get('setup_draft', null);
  setupSel = isPlainRecord(savedDraft) ? Object.assign(cloneData(DEFAULT_SETUP_STATE), savedDraft) : Object.assign(cloneData(DEFAULT_SETUP_STATE), { focus:suggested.focus });
  setupSel.discomfort = Array.isArray(setupSel.discomfort) ? setupSel.discomfort : [];
  setupSel.avoid = typeof setupSel.avoid === 'string' ? setupSel.avoid : '';
  if (!setupSel.focus) setupSel.focus = suggested.focus;
  const focusChips = FOCUS_OPTIONS.map(f =>
    `<div class="opt-chip ${f===setupSel.focus?'sel':''}" onclick="pickFocus('${f}')">${f}</div>`
  ).join('');
  const stateChips = STATE_OPTIONS.map(o => `<div class="opt-chip ${setupSel.state===o.k?'sel':''}" onclick="setState('${o.k}')"><span class="opt-emoji">${o.e}</span><span class="opt-text">${o.k}</span></div>`).join('');
  const timeChips = TIME_OPTIONS.map(o => `<div class="opt-chip ${setupSel.time===o.k?'sel':''}" onclick="setTime('${o.k}')"><span class="opt-emoji">${o.e}</span><span class="opt-text">${o.k}</span></div>`).join('');
  const envChips = ENV_OPTIONS.map(o => `<div class="opt-chip ${setupSel.env===o.k?'sel':''}" onclick="setEnv('${o.k}')"><span class="opt-emoji">${o.e}</span><span class="opt-text">${o.k}</span></div>`).join('');
  const discomfortChips = DISCOMFORT_OPTIONS.map(o => `<div class="opt-chip ${setupSel.discomfort.includes(o)?'sel':''}" onclick="toggleDiscomfort('${o}')">${o}</div>`).join('');
  const catalogStatusHtml = exerciseCatalogStatus === 'ready'
    ? '<div class="catalog-status">精选动作库已就绪 · 计划会优先避开最近两次同类训练动作</div>'
    : exerciseCatalogStatus === 'failed'
      ? '<div class="catalog-status" style="color:var(--danger)">精选动作库暂不可用，本次仍可使用原内置动作库</div>'
      : '<div class="catalog-status">正在准备精选动作库，生成时会自动检查</div>';
  const container = document.getElementById('trainingContent');
  container.innerHTML = `
    <div class="training-header">
      <span class="text-accent font-bold">训练</span>
      <span class="text-muted text-sm">${formatTime(trainState.sessionTime||0)}</span>
    </div>
    <div class="card">
      <div class="setup-title">开始今天的训练</div>
      <div class="setup-subtitle">告诉我你今天的状况，为你生成个性化计划</div>
      ${catalogStatusHtml}
      <div class="setup-group">
        <span class="setup-label">今日想练的部位（已自动推荐）</span>
        <div class="setup-recommend">💡 ${escapeHtml(suggested.reason)}</div>
        <div class="opt-grid" id="setupFocus" style="grid-template-columns:repeat(3,1fr)">${focusChips}</div>
      </div>
      <div class="setup-group">
        <span class="setup-label">身体状态</span>
        <div class="opt-grid" id="setupState">${stateChips}</div>
      </div>
      <div class="setup-group">
        <span class="setup-label">可用时间</span>
        <div class="opt-grid" id="setupTime">${timeChips}</div>
      </div>
      <div class="setup-group">
        <span class="setup-label">训练环境</span>
        <div class="opt-grid" id="setupEnv">${envChips}</div>
      </div>
      <div class="setup-group">
        <span class="setup-label">酸痛或不适部位（可多选）</span>
        <div class="opt-grid" id="setupDiscomfort" style="grid-template-columns:repeat(3,1fr)">${discomfortChips}</div>
        <div class="danger-note">如有明显疼痛、胸闷、头晕或异常心悸，请停止训练并寻求专业帮助。</div>
      </div>
      <div class="setup-group">
        <label class="setup-label" for="setupAvoid">今天希望避开的动作（选填）</label>
        <input id="setupAvoid" class="setup-input" value="${escapeHtml(setupSel.avoid)}" placeholder="例如：深蹲、双杠臂屈伸" oninput="setupSel.avoid=this.value;saveSetupDraft()">
      </div>
      <div id="setupMsg" class="text-center text-muted text-sm" style="margin-bottom:14px"></div>
      <button class="btn btn-accent" onclick="confirmSetup()">生成今日计划</button>
    </div>`;
}

function saveSetupDraft() { LS.set('setup_draft', setupSel); }
function pickFocus(f) { setupSel.focus = f; saveSetupDraft(); document.querySelectorAll('#setupFocus .opt-chip').forEach(c=>c.classList.toggle('sel',c.textContent===f)); }
function setState(k) { setupSel.state = k; saveSetupDraft(); markSel('setupState'); }
function setTime(k) { setupSel.time = k; saveSetupDraft(); markSel('setupTime'); }
function setEnv(k) { setupSel.env = k; saveSetupDraft(); markSel('setupEnv'); }
function toggleDiscomfort(k) {
  if (k === '无') setupSel.discomfort = ['无'];
  else {
    setupSel.discomfort = setupSel.discomfort.filter(x => x !== '无');
    setupSel.discomfort = setupSel.discomfort.includes(k) ? setupSel.discomfort.filter(x => x !== k) : setupSel.discomfort.concat(k);
  }
  saveSetupDraft();
  document.querySelectorAll('#setupDiscomfort .opt-chip').forEach(c=>c.classList.toggle('sel',setupSel.discomfort.includes(c.textContent)));
}
function markSel(id) {
  document.querySelectorAll('#'+id+' .opt-chip').forEach(c => {
    const txt = c.querySelector('.opt-text') ? c.querySelector('.opt-text').textContent : '';
    const key = c.dataset.k || txt;
    const selObj = { setupState:setupSel.state, setupTime:setupSel.time, setupEnv:setupSel.env }[id];
    c.classList.toggle('sel', key === selObj);
  });
}

function suggestTodayFocus() {
  // 周期索引只在完成训练时推进，未完成计划不会改变推荐。
  const tmpl = (profile.planTemplate) || 'ppl';
  const cycleName = PLAN_TEMPLATES[tmpl] ? PLAN_TEMPLATES[tmpl].name : 'PPL 推拉腿三分化';
  const idx = Math.max(0, Number(todayIndex) || 0) % Math.max(1, plan.days.length);
  const day = plan.days[idx] || plan.days[0];
  const key = focusKeyFromText(day.focus || day.name);
  const focus = focusLabelFromKey(key);
  const prefix = sessions.length ? `已完成上次训练，按「${cycleName}」继续循环` : `首次训练，按「${cycleName}」从第一日开始`;
  return { focus, day, key, reason:`${prefix}，今天建议 ${day.name}（${day.focus}）` };
}

async function confirmSetup() {
  if (!setupSel.focus) { document.getElementById('setupMsg').textContent = '请选择今日训练部位'; return; }
  if (!setupSel.state) { document.getElementById('setupMsg').textContent = '请选择身体状态'; return; }
  if (!setupSel.time) { document.getElementById('setupMsg').textContent = '请选择可用时间'; return; }
  if (!setupSel.env) { document.getElementById('setupMsg').textContent = '请选择训练环境'; return; }
  setupSel.avoid = (document.getElementById('setupAvoid')?.value || '').trim();
  saveSetupDraft();
  const msg = document.getElementById('setupMsg');
  msg.textContent = '正在按本地规则生成今日计划...';
  const btn = document.querySelector('#trainingContent .btn-accent');
  if (btn) btn.disabled = true;
  let generated = null;
  try {
    ensureUserDataCompatibility();
    await ensureExerciseCatalog();
    generated = await generateTodayPlan();
  } catch(e) {
    console.error('今日计划生成失败:', e);
    msg.textContent = '计划生成遇到异常，已保留你的设置，请重试';
  } finally {
    if (btn) btn.disabled = false;
  }
  if (generated) {
    renderTrainingPage();
    window.scrollTo(0, 0);
  } else if (!msg.textContent.includes('异常')) {
    msg.textContent = '生成失败，请检查设置后重试';
  }
}

function targetExerciseCount(time) {
  return { '30分钟':8, '45分钟':10, '60分钟':12, '90分钟':15 }[time] || 10;
}

function allLibraryExercises(key) {
  const lib = EXERCISE_LIBRARY[key] || EXERCISE_LIBRARY.push;
  return lib.core.concat(lib.auxiliary, BODYWEIGHT_LIBRARY[key] || []).map(ex => enrichRuntimeExercise(ex, key));
}

function avoidTerms() {
  return String(setupSel.avoid || '').split(/[、,，;；\s]+/).map(x=>x.trim()).filter(Boolean);
}

function isExerciseBlocked(ex) {
  const terms = avoidTerms();
  if (terms.some(t => ex.name.includes(t) || t.includes(ex.name))) return true;
  const exerciseId = ex.exerciseId || stableExerciseId(ex);
  if (exerciseId && exercisePreferences?.paused?.[exerciseId]) return true;
  const pain = setupSel.discomfort || [];
  if ((ex.loadRegions || []).some(region => pain.includes(region))) return true;
  if (pain.includes('肩') && ['垂直推','肩外展','肩后束'].includes(ex.pattern)) return true;
  if (pain.includes('肘/腕') && ['肘伸','肘屈'].includes(ex.pattern)) return true;
  if (pain.includes('腰背') && ['髋主导'].includes(ex.pattern)) return true;
  if (pain.includes('髋') && ['髋主导','髋外展'].includes(ex.pattern)) return true;
  if (pain.includes('膝') && ['膝主导','单腿膝主导','膝伸'].includes(ex.pattern)) return true;
  if (pain.includes('踝') && ['提踵','单腿膝主导'].includes(ex.pattern)) return true;
  return false;
}

function matchesEnvironment(ex) {
  if (setupSel.env === '家用徒手') return ex.equipment.includes('徒手');
  if (setupSel.env === '家用哑铃') return ex.equipment.some(e => e === '哑铃' || e === '徒手');
  const available = new Set((profile.equipment || []).concat(['徒手','杠铃','哑铃']));
  if (available.has('龙门架')) available.add('绳索机');
  if (available.has('绳索机')) available.add('龙门架');
  return ex.equipment.some(e => available.has(e));
}

function getLastExerciseRecord(reference) {
  const name = typeof reference === 'string' ? reference : reference?.name;
  const exerciseId = typeof reference === 'object' ? (reference.exerciseId || stableExerciseId(reference)) : stableExerciseId({name});
  for (const session of sessions) {
    const found = (session.exercises || []).find(ex => exerciseId && ex.exerciseId === exerciseId || ex.name === name);
    if (found && found.sets && found.sets.length) return { session, exercise:found };
  }
  return null;
}

function getExerciseHistory(reference, limit=3) {
  const name = typeof reference === 'string' ? reference : reference?.name;
  const exerciseId = typeof reference === 'object' ? (reference.exerciseId || stableExerciseId(reference)) : stableExerciseId({name});
  const history = [];
  for (const session of sessions) {
    const found = (session.exercises || []).find(ex => exerciseId && ex.exerciseId === exerciseId || ex.name === name);
    if (found) history.push(found);
    if (history.length >= limit) break;
  }
  return history;
}

function hadRecentDiscomfort(reference) {
  const last = getLastExerciseRecord(reference);
  return !!(last && last.exercise.feedback === '不适');
}

function roundLoad(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.round(value / 2.5) * 2.5);
}

function hasCompletedExercise(reference) {
  const exerciseId = reference.exerciseId || stableExerciseId(reference);
  return sessions.some(session => (session.exercises || []).some(ex =>
    ((exerciseId && ex.exerciseId === exerciseId) || ex.name === reference.name) && Array.isArray(ex.sets) && ex.sets.length > 0
  ));
}

function isNewCatalogExercise(exercise) {
  return !!exercise.exerciseId?.startsWith('exds:') && !hasCompletedExercise(exercise);
}

function adaptExercise(base, reason) {
  const focusKey = focusKeyFromText(setupSel.focus || base.pplTags?.[0] || '');
  const ex = enrichRuntimeExercise(base, focusKey);
  const last = getLastExerciseRecord(ex);
  ex.id = 'dyn-' + Math.random().toString(36).slice(2, 9);
  ex.locked = ex.role === '核心' ? coreLocks[ex.name] !== false : false;
  ex.reason = reason || (ex.role === '核心' ? '训练阶段内保持核心动作稳定' : '按本轮 A/B 方案选择');
  ex.isNew = isNewCatalogExercise(ex);
  if (last) {
    const maxWeight = Math.max(...last.exercise.sets.map(s => Number(s.w) || 0));
    const feedback = last.exercise.feedback || '';
    ex.weight = maxWeight || ex.weight;
    if (feedback === '轻松' && ex.weight > 0) { ex.weight = roundLoad(ex.weight + 2.5); ex.reason += '；上次评价轻松，建议小幅加重'; }
    else if (feedback === '合适') ex.reason += '；上次评价合适，建议保持';
    else if (feedback === '吃力' && ex.weight > 0) { ex.weight = roundLoad(ex.weight * 0.95); ex.reason += '；上次评价吃力，建议适当减量'; }
    else if (feedback === '不适') ex.reason += '；上次记录不适，本次请重点确认';
    ex.previous = { weight:maxWeight, reps:last.exercise.sets[last.exercise.sets.length-1].r, feedback };
    if (feedback === '轻松' && ex.role !== '核心') ex.lightChoice = exercisePreferences?.lightChoices?.[ex.exerciseId] || 'progress';
  }
  if (ex.role === '核心') {
    const recent = getExerciseHistory(ex,3);
    if (recent.length === 3 && recent.every(item=>item.completed===false)) ex.reason += '；连续 3 次未完成目标，建议本次确认是否替换';
    const doneCount = Math.max(0, Number(trainingPhase.completedSessions) || 0);
    const microCycles = Math.floor(doneCount / 3) + 1;
    ex.reason += `；本次为第 ${microCycles} 个 PPL 小周期，主动作保持稳定便于比较，满 3 个小周期后再评估轮换`;
    const phaseDays = Math.max(1, Math.floor((Date.now()-new Date(trainingPhase.startedAt||getTodayStr()).getTime())/86400000)+1);
    if (phaseDays >= 28) ex.reason += `；当前训练阶段已进入第 ${Math.ceil(phaseDays/7)} 周，可评估是否继续`;
  }
  if (setupSel.state === '有些疲惫') {
    ex.sets = Math.max(2, ex.sets - 1);
    ex.reason += '；今日有些疲惫，减少一组';
  } else if (setupSel.state === '比较疲劳') {
    ex.sets = Math.max(2, ex.sets - 1);
    ex.weight = roundLoad(ex.weight * 0.9);
    ex.reason += '；今日比较疲劳，降低训练量';
  }
  return ex;
}

function createLegacyLocalPlan() {
  const key = focusKeyFromText(setupSel.focus);
  const lib = EXERCISE_LIBRARY[key];
  const count = targetExerciseCount(setupSel.time);
  const variant = cycleVariants[key] || 'A';
  const replacementPool = lib.auxiliary.concat(BODYWEIGHT_LIBRARY[key]||[]);
  const selectedCoreNames = new Set();
  const corePlans = lib.core.slice(0,2).map(original => {
    let chosen = !isExerciseBlocked(original) && matchesEnvironment(original) ? original : replacementPool.find(ex=>ex.pattern===original.pattern&&!isExerciseBlocked(ex)&&matchesEnvironment(ex)&&!selectedCoreNames.has(ex.name));
    if (!chosen) return null;
    selectedCoreNames.add(chosen.name);
    const adapted = adaptExercise(chosen, chosen.name===original.name?'核心动作锁定，保持训练表现可追踪':`因环境或身体限制，以“${chosen.name}”替代核心动作“${original.name}”`);
    adapted.role = '核心';
    adapted.locked = chosen.name===original.name ? adapted.locked : false;
    return adapted;
  }).filter(Boolean);
  const basePool = (setupSel.env === '家用徒手' ? BODYWEIGHT_LIBRARY[key] : lib.auxiliary.concat(BODYWEIGHT_LIBRARY[key]))
    .filter(ex => !isExerciseBlocked(ex) && !hadRecentDiscomfort(ex.name) && matchesEnvironment(ex) && !corePlans.some(c => c.name === ex.name));
  const need = Math.max(0, count - corePlans.length);
  const offset = variant === 'B' ? Math.ceil(basePool.length * 0.34) : 0;
  const rotated = basePool.slice(offset).concat(basePool.slice(0, offset));
  const usedNames = new Set(corePlans.map(c => c.name));
  const auxiliaries = [];
  const slotDefs = PPL_SLOTS[key] || [];
  const corePatterns = corePlans.map(c => c.pattern);
  const takeFromPool = (patterns) => {
    for (const ex of rotated) {
      if (usedNames.has(ex.name)) continue;
      if (patterns && !patterns.includes(ex.pattern)) continue;
      return ex;
    }
    return null;
  };
  for (const slot of slotDefs) {
    let quota = slot.n;
    if (slot.patterns) quota -= corePlans.filter(c => slot.patterns.includes(c.pattern)).length;
    for (let i = 0; i < Math.max(0, quota) && auxiliaries.length < need; i++) {
      const ex = takeFromPool(slot.patterns);
      if (!ex) break;
      usedNames.add(ex.name);
      auxiliaries.push(adaptExercise(ex, `辅助动作（${slot.label}）：按 ${variant} 方案轮换`));
    }
  }
  if (auxiliaries.length < need) {
    for (const ex of rotated) {
      if (auxiliaries.length >= need) break;
      if (usedNames.has(ex.name)) continue;
      usedNames.add(ex.name);
      auxiliaries.push(adaptExercise(ex, '机动位补充动作'));
    }
  }
  if (auxiliaries.length < need) {
    for (const ex of allLibraryExercises(key)) {
      if (auxiliaries.length >= need) break;
      if (usedNames.has(ex.name) || isExerciseBlocked(ex)) continue;
      usedNames.add(ex.name);
      auxiliaries.push(adaptExercise(ex, '器械受限时的同类补充动作'));
    }
  }
  const workout = corePlans.concat(auxiliaries).slice(0, count);
  return {
    id:'plan-'+Date.now(), date:getTodayStr(), status:'preview', source:'local', variant,
    focus:lib.focus, focusKey:key,
    factors:{ focus:setupSel.focus, state:setupSel.state, time:setupSel.time, env:setupSel.env, discomfort:setupSel.discomfort.slice(), avoid:setupSel.avoid },
    warmup:[
      {name:'低强度有氧',note:'快走或单车 3 分钟，逐步提高体温'},
      {name:'关节动态活动',note:'围绕今天训练部位活动 2～3 分钟'},
      {name:'主项递增热身',note:'从轻重量开始，用 2～3 组逐级接近工作重量'}
    ],
    workout,
    stretch:[
      {name:'目标肌群放松',note:'主要训练肌群各保持 30 秒，自然呼吸'},
      {name:'舒缓活动',note:'低强度走动并观察是否有异常不适'}
    ],
    nutrition:`训练后优先补充蛋白质和适量碳水，并根据你的“${profile.goal}”目标控制全天总量。`,
    notice:`本次按本地规则（${lib.focus}）生成，已考虑你的身体状态、可用时间和训练环境。`
  };
}

function catalogAvailableEquipment() {
  const items = new Set((profile.equipment || []).concat(['徒手','杠铃','哑铃']));
  if (items.has('龙门架')) items.add('绳索机');
  if (items.has('绳索机')) items.add('龙门架');
  return [...items];
}

function getCatalogCandidates(key) {
  const engine = getExerciseEngine();
  if (!engine || !exerciseCatalog) return [];
  return engine.filterCandidates(exerciseCatalog, {
    focusKey:key,
    environment:setupSel.env,
    availableEquipment:catalogAvailableEquipment(),
    discomfort:setupSel.discomfort || [],
    avoidTerms:avoidTerms(),
    pausedIds:Object.keys(exercisePreferences?.paused || {})
  });
}

function getSameFocusSessions(key, limit=2) {
  return sessions.filter(session => focusKeyFromText(session.focusArea || session.dayName) === key).slice(0, limit);
}

function catalogHistoryContext(key) {
  const sameFocus = getSameFocusSessions(key, 20);
  const recentExerciseIds = [];
  const lastUsed = {};
  sameFocus.forEach((session, sessionIndex) => {
    (session.exercises || []).forEach(exercise => {
      const id = stableExerciseId(exercise);
      if (!id) return;
      if (sessionIndex < 2) recentExerciseIds.push(id);
      if (!Object.prototype.hasOwnProperty.call(lastUsed, id)) lastUsed[id] = sessionIndex * 20;
    });
  });
  return { sameFocus, recentExerciseIds:[...new Set(recentExerciseIds)], lastUsed };
}

function createCatalogPlan() {
  const engine = getExerciseEngine();
  if (!engine || !exerciseCatalog) throw new Error('精选动作库未就绪');
  const key = focusKeyFromText(setupSel.focus);
  const lib = EXERCISE_LIBRARY[key];
  const count = targetExerciseCount(setupSel.time);
  const variant = cycleVariants[key] || 'A';
  const candidates = getCatalogCandidates(key);
  if (candidates.length < count) throw new Error('当前条件下精选动作候选不足');
  const selectedCoreIds = new Set();
  const corePlans = lib.core.slice(0, 2).map(originalValue => {
    const original = enrichRuntimeExercise(originalValue, key);
    let chosen = !isExerciseBlocked(original) && matchesEnvironment(original) ? original : candidates.find(ex =>
      ex.pattern === original.pattern && !selectedCoreIds.has(ex.exerciseId)
    );
    if (!chosen) return null;
    selectedCoreIds.add(chosen.exerciseId || chosen.name);
    const adapted = adaptExercise(chosen, chosen.name === original.name ? '核心动作锁定，保持训练表现可追踪' : `因环境或身体限制，以“${chosen.name}”替代核心动作“${original.name}”`);
    adapted.role = '核心';
    adapted.locked = chosen.name === original.name ? coreLocks[original.name] !== false : false;
    return adapted;
  }).filter(Boolean);
  const context = catalogHistoryContext(key);
  const eligibleIds = new Set(candidates.map(ex => ex.exerciseId));
  const previous = (context.sameFocus[0]?.exercises || []).filter(ex => ex.role !== '核心').map(ex => catalogExerciseFor(ex)).filter(ex => ex && eligibleIds.has(ex.exerciseId));
  const seed = `${currentUser}:${key}:${variant}:${context.sameFocus.length}:${sessions.length}:${exerciseCatalog.version}`;
  let selection = engine.buildFallbackPlan({
    core:corePlans,
    candidates,
    previous,
    count,
    focusKey:key,
    seed,
    recentExerciseIds:context.recentExerciseIds,
    lastUsed:context.lastUsed
  });
  let rebuiltForBalance = false;
  if (!selection.balance.valid) {
    selection = engine.buildFallbackPlan({
      core:corePlans,
      candidates,
      previous:[],
      count,
      focusKey:key,
      seed:`${seed}:balance`,
      recentExerciseIds:context.recentExerciseIds,
      lastUsed:context.lastUsed
    });
    rebuiltForBalance = true;
  }
  if (selection.workout.length !== count || !selection.balance.valid) throw new Error(`精选动作计划结构不足：${selection.balance.missing.join('、')}`);
  const previousIds = new Set(previous.map(ex => ex.exerciseId));
  const coreIdSet = new Set(corePlans.map(ex => ex.exerciseId));
  const workout = selection.workout.map(item => {
    if (coreIdSet.has(item.exerciseId)) return corePlans.find(ex => ex.exerciseId === item.exerciseId);
    const retained = previousIds.has(item.exerciseId);
    const adapted = adaptExercise(item, retained ? `延续上次辅助动作，保留本轮约 60%～70% 的训练连续性` : `按 ${variant} 轮换阶段选择同肌群变式，并优先避开最近两次同类训练`);
    adapted.role = '辅助';
    adapted.locked = false;
    return adapted;
  });
  return {
    id:'plan-'+Date.now(), date:getTodayStr(), status:'preview', source:'local', variant,
    catalogVersion:exerciseCatalog.version,
    focus:lib.focus, focusKey:key,
    factors:{ focus:setupSel.focus, state:setupSel.state, time:setupSel.time, env:setupSel.env, discomfort:setupSel.discomfort.slice(), avoid:setupSel.avoid },
    warmup:[
      {name:'低强度有氧',note:'快走或单车 3 分钟，逐步提高体温'},
      {name:'关节动态活动',note:'围绕今天训练部位活动 2～3 分钟'},
      {name:'主项递增热身',note:'从轻重量开始，用 2～3 组逐级接近工作重量'}
    ],
    workout,
    stretch:[
      {name:'目标肌群放松',note:'主要训练肌群各保持 30 秒，自然呼吸'},
      {name:'舒缓活动',note:'低强度走动并观察是否有异常不适'}
    ],
    nutrition:`训练后优先补充蛋白质和适量碳水，并根据你的“${profile.goal}”目标控制全天总量。`,
    rotation:{ targetRatio:0.35, rotatedSlots:selection.rotatedSlots, rebuiltForBalance },
    notice:getGlobalApiKey() ? (rebuiltForBalance ? '为保持整套训练结构，本次已由本地规则重新平衡动作。' : '') : '未设置 API Key，本次使用精选动作库生成本地备用计划。'
  };
}

function createLocalPlan() {
  // V1.2：基础计划由本地 PPL 白名单 + 结构槽位直接生成，AI 不作为生成前提。
  const plan = createLegacyLocalPlan();
  return plan;
}

// V1.2 起 AI 不参与计划生成，只用于计划解释与训练评价（见 aiExplainPlan / aiReviewCurrentTraining）。

async function generateTodayPlan() {
  // V1.2：训练计划由本地规则直接生成，AI 不再介入生成链路，与 API/网络无关。
  let generated;
  try {
    generated = createLocalPlan();
  } catch(e) {
    console.warn('本地计划首次生成失败，正在修复兼容数据:', e);
    ensureUserDataCompatibility();
    generated = createLocalPlan();
  }
  todayPlan = generated;
  LS.set('today_plan', todayPlan);
  LS.set('active_training', null);
  return todayPlan;
}

// ============ 上次训练摘要 ============
function getLastSessionSummary() {
  if (sessions.length === 0) return null;
  const s = sessions[0];
  const totalSets = s.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalVol = s.exercises.reduce((sum, ex) => sum + ex.sets.reduce((ss, st) => ss + st.w*st.r, 0), 0);
  const dur = s.duration || 0;
  return {
    dayName: s.dayName,
    date: s.date,
    totalSets: totalSets,
    totalVol: totalVol,
    duration: formatTime(dur)
  };
}
