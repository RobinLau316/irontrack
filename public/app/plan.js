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
  if (!profile.onboardingComplete) { renderOnboarding(); return; }
  ensurePplPlan();
  ensureExerciseCatalog().then(() => {
    if (document.getElementById('page-training')?.classList.contains('active') && !todayPlan) renderTrainingSetup();
  });
  // 若已有今日计划，进入预览或继续训练。
  if (todayPlan) {
    renderTrainingPage();
    return;
  }
  renderTrainingSetup();
}

let onboardingDraft = null;
function renderOnboarding() {
  setTrainingFixedAction(false);
  onboardingDraft = LS.get('onboarding_draft', cloneData(DEFAULT_ONBOARDING_DRAFT));
  const questions = [
    ['接下来几周，你最想在训练上获得什么变化？','例如：更有力气、增加肌肉，或保持规律'],
    ['通常一周大概能练几次？','例如：2、3、4 次'],
    ['你练力量训练大概多久了？','不确定也可以说刚开始'],
    ['有没有需要长期避开的疼痛、动作或其他限制？','没有的话写“没有”即可']
  ];
  const [question, placeholder] = questions[Math.min(onboardingDraft.step, 3)];
  const field = ['direction','frequency','experience','limitations'][onboardingDraft.step];
  document.getElementById('trainingContent').innerHTML = `
    <div class="training-header"><span class="text-accent font-bold">认识你的训练习惯</span><span class="text-muted text-sm">${onboardingDraft.step+1} / 4</span></div>
    <div class="card onboarding-card"><div class="setup-title">${question}</div><div class="setup-subtitle">简单回答就好，之后可以用日常语言更新。</div>
      <textarea id="onboardingAnswer" class="setup-input onboarding-answer" rows="3" maxlength="500" placeholder="${placeholder}">${escapeHtml(onboardingDraft[field]||'')}</textarea>
      <div id="onboardingMsg" class="text-center text-muted text-sm"></div>
      <button class="btn btn-accent mt-3" onclick="advanceOnboarding()">${onboardingDraft.step===3?'完成档案':'继续'}</button>
      <button class="btn btn-outline mt-3" onclick="skipOnboarding()">以后再补充</button></div>`;
  document.getElementById('onboardingAnswer').focus();
}

function advanceOnboarding() {
  if (!onboardingDraft) onboardingDraft=LS.get('onboarding_draft',cloneData(DEFAULT_ONBOARDING_DRAFT));
  const field=['direction','frequency','experience','limitations'][onboardingDraft.step];
  onboardingDraft[field]=(document.getElementById('onboardingAnswer')?.value||'').trim();
  if(onboardingDraft.step<3){onboardingDraft.step++;if(!LS.set('onboarding_draft',onboardingDraft)){onboardingDraft.step--;document.getElementById('onboardingMsg').textContent='暂时无法保存，请检查本机存储空间。';return;}renderOnboarding();return;}
  finishOnboarding();
}

function finishOnboarding() {
  const draft=onboardingDraft||LS.get('onboarding_draft',cloneData(DEFAULT_ONBOARDING_DRAFT));
  const next={...profile,trainingDirection:draft.direction||profile.trainingDirection||profile.goal||'',experienceSummary:draft.experience||profile.experienceSummary||'',limitations:draft.limitations||profile.limitations||'',onboardingComplete:true,planTemplate:'ppl'};
  next.goal=next.trainingDirection||next.goal;
  const frequency=Number((draft.frequency||'').match(/[1-7]/)?.[0]);if(frequency)next.trainingDays=frequency;
  if(!LS.transaction({profile:next,onboarding_draft:cloneData(DEFAULT_ONBOARDING_DRAFT)})){document.getElementById('onboardingMsg').textContent='档案还没保存成功，请重试。';return;}
  profile=next;onboardingDraft=null;navigate('home');
}

function skipOnboarding() {
  const next={...profile,onboardingComplete:true,planTemplate:'ppl'};
  if(!LS.transaction({profile:next,onboarding_draft:cloneData(DEFAULT_ONBOARDING_DRAFT)}))return;
  profile=next;onboardingDraft=null;navigate('home');
}

function isPplPlan(value=plan) {
  return Array.isArray(value?.days)&&value.days.length===3&&['push','pull','legs'].every(key=>value.days.some(day=>focusKeyFromText(day.focus||day.name)===key));
}

function ensurePplPlan() {
  if(isPplPlan()||todayPlan?.status==='active')return;
  const current=plan.days[Math.max(0,Number(todayIndex)||0)%Math.max(1,plan.days.length)];
  const key=focusKeyFromText(current?.focus||current?.name);
  const days=cloneData(DEFAULT_PLAN.days), idx=days.findIndex(day=>focusKeyFromText(day.focus||day.name)===key);
  const nextProfile={...profile,planTemplate:'ppl'};
  const nextPlan={name:PLAN_TEMPLATES.ppl.name,cycle:PLAN_TEMPLATES.ppl.cycle,days};
  if(LS.transaction({profile:nextProfile,plan:nextPlan,today_index:Math.max(0,idx)})){profile=nextProfile;plan=nextPlan;todayIndex=Math.max(0,idx);}
  else dataRecoveryNotice='PPL 计划切换尚未保存；原有训练记录与进行中训练保留。';
}

function setTrainingFixedAction(enabled) {
  const page = document.getElementById('page-training');
  if (page) page.classList.toggle('has-fixed-action', !!enabled);
  if (!enabled) document.body.classList.remove('keyboard-active');
}

function renderTrainingSetup() {
  if (!currentUser) return;
  setTrainingFixedAction(false);
  const suggested = suggestTodayFocus();
  const savedDraft = LS.get('setup_draft', null);
  setupSel = isPlainRecord(savedDraft) ? Object.assign(cloneData(DEFAULT_SETUP_STATE), savedDraft) : cloneData(DEFAULT_SETUP_STATE);
  setupSel.discomfort = Array.isArray(setupSel.discomfort) ? setupSel.discomfort : [];
  setupSel.discomfortText = typeof setupSel.discomfortText === 'string' ? setupSel.discomfortText : '无';
  const stateChips = STATE_OPTIONS.map(o => `<div class="opt-chip ${setupSel.state===o.k?'sel':''}" onclick="setState('${o.k}')"><span class="opt-emoji">${o.e}</span><span class="opt-text">${o.k}</span></div>`).join('');
  const timeChips = TIME_OPTIONS.map(o => `<div class="opt-chip ${setupSel.time===o.k?'sel':''}" onclick="setTime('${o.k}')"><span class="opt-emoji">${o.e}</span><span class="opt-text">${o.k}</span></div>`).join('');
  const catalogStatusHtml = exerciseCatalogStatus === 'ready'
    ? '<div class="catalog-status">PPL 周期 · 最多 8 个动作 · 延续近期训练</div>'
    : exerciseCatalogStatus === 'failed'
      ? '<div class="catalog-status" style="color:var(--danger)">动作库暂不可用，将使用本地备用动作计划</div>'
      : '<div class="catalog-status">正在准备动作库…</div>';
  const container = document.getElementById('trainingContent');
  container.innerHTML = `
    <div class="training-header">
      <span class="text-accent font-bold">训练</span>
      <span class="text-muted text-sm">${formatTime(trainState.sessionTime||0)}</span>
    </div>
    <div class="card">
      <div class="setup-title">开始今天的训练</div>
      <div class="setup-subtitle">${escapeHtml(suggested.day.name)} · 延续「${escapeHtml(profile.trainingDirection||profile.goal||'持续进步')}」训练方向</div>
      ${catalogStatusHtml}
      <div class="setup-group">
        <span class="setup-label">今天能练多久？</span>
        <div class="opt-grid" id="setupTime">${timeChips}</div>
      </div>
      <div class="setup-group">
        <span class="setup-label">今天疲劳程度？</span>
        <div class="opt-grid" id="setupState">${stateChips}</div>
      </div>
      <div class="setup-group">
        <span class="setup-label">今天有疼痛或不适吗？</span>
        <div class="opt-grid pain-choice"><div class="opt-chip ${setupSel.discomfortText==='无'?'sel':''}" onclick="setPainAnswer('无')">没有</div><div class="opt-chip ${setupSel.discomfortText&&setupSel.discomfortText!=='无'?'sel':''}" onclick="focusPainNote()">有，我说一下</div></div>
        <input id="setupPain" class="setup-input mt-3" value="${escapeHtml(setupSel.discomfortText==='无'?'':setupSel.discomfortText)}" placeholder="例如：膝盖蹲下时会痛" oninput="setPainText(this.value)">
      <div class="danger-note">明显疼痛或异常症状时请停止相关动作；应用不作伤病诊断。</div>
      </div>
      <div id="setupMsg" class="text-center text-muted text-sm" style="margin-bottom:14px"></div>
      <button class="btn btn-accent" onclick="confirmSetup()">生成今日计划</button>
    </div>`;
}

function saveSetupDraft() { LS.set('setup_draft', setupSel); }
function pickFocus(f) { setupSel.focus = f; saveSetupDraft(); }
function setState(k) { setupSel.state = k; saveSetupDraft(); markSel('setupState'); }
function setTime(k) { setupSel.time = k; saveSetupDraft(); markSel('setupTime'); }
function setEnv(k) { setupSel.env = k; saveSetupDraft(); }
function inferDiscomfortRegions(text) {
  const s=String(text||''),out=[];
  if(/肩/.test(s))out.push('肩'); if(/肘|腕/.test(s))out.push('肘/腕');
  if(/腰|背/.test(s))out.push('腰背'); if(/髋|臀/.test(s))out.push('髋');
  if(/膝/.test(s))out.push('膝'); if(/踝/.test(s))out.push('踝');
  return out;
}
function setPainAnswer(value) { setupSel.discomfortText=value;setupSel.discomfort=value==='无'?[]:inferDiscomfortRegions(value);saveSetupDraft();renderTrainingSetup(); }
function setPainText(value) { setupSel.discomfortText=value.trim();setupSel.discomfort=inferDiscomfortRegions(value);saveSetupDraft(); }
function focusPainNote() { document.getElementById('setupPain')?.focus(); }
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
  const prefix = sessions.some(s=>(s.exercises||[]).some(ex=>(ex.sets||[]).length)) ? `已完成上次训练，按「${cycleName}」继续循环` : `首次训练，按「${cycleName}」从第一日开始`;
  return { focus, day, key, reason:`${prefix}，今天建议 ${day.name}（${day.focus}）` };
}

async function confirmSetup() {
  if (!setupSel.state) { document.getElementById('setupMsg').textContent = '请选择身体状态'; return; }
  if (!setupSel.time) { document.getElementById('setupMsg').textContent = '请选择可用时间'; return; }
  setupSel.focus=suggestTodayFocus().focus; setupSel.env='健身房'; setupSel.avoid='';
  setupSel.discomfortText=(document.getElementById('setupPain')?.value||setupSel.discomfortText||'无').trim()||'无';
  setupSel.discomfort=inferDiscomfortRegions(setupSel.discomfortText);
  saveSetupDraft();
  const msg = document.getElementById('setupMsg');
  msg.textContent = profile.aiPlanEnabled&&getGlobalApiKey()?'正在结合训练记录适配计划...':'正在生成今日计划...';
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
    msg.textContent = dataRecoveryNotice || LS.error || '生成失败，请检查设置后重试';
  }
}

function targetExerciseCount(time) {
  return time === '30分钟' ? 6 : 8;
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
  ex.reason = reason || (ex.role === '核心' ? '主动作保持连续，方便比较实际表现' : '按训练方向补充动作');
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
    ex.reason = '主动作保持连续，方便比较实际表现';
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
    let quota = count <= 6 ? Math.min(1, slot.n) : slot.n;
    if (slot.patterns) quota -= corePlans.filter(c => slot.patterns.includes(c.pattern)).length;
    for (let i = 0; i < Math.max(0, quota) && auxiliaries.length < need; i++) {
      const ex = takeFromPool(slot.patterns);
      if (!ex) break;
      usedNames.add(ex.name);
      auxiliaries.push(adaptExercise(ex, `补充${slot.label}训练`));
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
  const items = new Set(['徒手','杠铃','哑铃']);
  (exerciseCatalog?.exercises||[]).forEach(ex=>(ex.equipment||[]).forEach(item=>items.add(item)));
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
    notice:rebuiltForBalance ? '为保持整套训练结构，本次由本地规则重新平衡动作。' : ''
  };
}

function createLocalPlan() {
  // Prefer the reviewed catalog; retain the small local library as an offline fallback.
  if (exerciseCatalog && getExerciseEngine()) return createCatalogPlan();
  return createLegacyLocalPlan();
}

function recentTrainingContext(focusKey) {
  return sessions.filter(s=>focusKeyFromText(s.focusArea||s.dayName)===focusKey).slice(0,4).map(s=>({
    date:s.date, duration:s.duration, feedback:s.sessionFeedback||'',
    exercises:(s.exercises||[]).map(ex=>({id:ex.exerciseId||'',name:ex.name,targetSets:ex.targetSets??null,targetReps:ex.targetReps??null,targetWeight:ex.targetWeight??null,status:ex.status||'',sets:(ex.sets||[]).map(set=>({w:set.w,r:set.r})) ,feedback:ex.feedback||''}))
  }));
}

function safeParseAIJson(text) {
  let value=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start=value.indexOf('{'),end=value.lastIndexOf('}');
  if(start<0||end<start)throw new Error('AI 未返回计划数据');
  return JSON.parse(value.slice(start,end+1));
}

function allowedPlanChoices(base) {
  const all=getCatalogCandidates(base.focusKey||'push');
  const engine=getExerciseEngine(); if(!engine)return [];
  const used=new Set();
  return base.workout.map((slot,index)=>{
    const choices=all.filter(ex=>ex.replacementMuscle===slot.replacementMuscle&&ex.pattern===slot.pattern);
    const ranked=engine.scoreCandidates(choices,{seed:`${base.id}:${index}`,usedIds:[...used],recentExerciseIds:catalogHistoryContext(base.focusKey).recentExerciseIds});
    const chosen=ranked.slice(0,8).map(x=>x.exercise);
    const current=all.find(x=>x.exerciseId===slot.exerciseId);
    if(current&&!chosen.some(x=>x.exerciseId===current.exerciseId))chosen.unshift(current);
    if(slot.locked)return [current||slot];
    return chosen.slice(0,9);
  });
}

async function adaptPlanWithAI(base, requestText='') {
  if(!profile.aiPlanEnabled||!getGlobalApiKey())return {plan:base,usedAI:false};
  if(!exerciseCatalog||!getExerciseEngine())return {plan:base,usedAI:false,error:'动作库暂不可用，已用本地规则生成计划'};
  const choices=allowedPlanChoices(base);
  const skeleton=base.workout.map((ex,index)=>({slot:index,exerciseId:ex.exerciseId,replacementMuscle:ex.replacementMuscle,pattern:ex.pattern,role:ex.role,locked:!!ex.locked,sets:ex.sets,reps:ex.reps,weight:ex.weight,rest:ex.rest,choices:choices[index].map(item=>({exerciseId:item.exerciseId,name:item.name,replacementMuscle:item.replacementMuscle,pattern:item.pattern,sets:item.sets,reps:item.reps,weight:item.weight,rest:item.rest}))}));
  const payload={profile:{direction:profile.trainingDirection||profile.goal,daysPerWeek:profile.trainingDays,experience:profile.experienceSummary||profile.experience,limitations:profile.limitations,notes:(profile.trainingNotes||[]).slice(-10)},today:{day:base.focus,minutes:setupSel.time,fatigue:setupSel.state,discomfort:setupSel.discomfortText},recent:recentTrainingContext(base.focusKey),plan:skeleton,userRequest:requestText};
  const prompt=`你是 IronTrack 的力量训练计划适配助手。请用中文处理用户本次训练。只从每个动作位 choices 中选 exerciseId；锁定位原样保留；不改变动作位数量；不超过8个动作；只输出JSON：{"exercises":[{"exerciseId":"...","sets":3,"reps":8,"weight":20,"rest":90,"reason":"简短原因"}],"summary":"一句话说明调整"}。不得诊断或治疗疼痛；不适要保守避让。保持数周训练方向和主动作连续，使用实际完成组、重量、次数、反馈判断，忽略跳过和未完成组。疲劳或时间紧时优先减少辅助动作组数/保留更少的辅助位，不能增加训练总量。计划目标数字只能在本地目标附近小幅调整，不得超过每位计划重量±10%、组数1到5、次数4到20、休息30到180秒。用户表达修改意图时只改相关动作或数值；不清楚时summary简短追问，不要臆造。用户资料和本次计划如下：\n${JSON.stringify(payload)}`;
  try {
    const raw=await aiCall(prompt,true); if(!raw)throw new Error('AI 暂不可用');
    const result=safeParseAIJson(raw), items=result.exercises;
    if(!Array.isArray(items)||items.length!==base.workout.length)throw new Error('计划动作数量不符');
    const engine=getExerciseEngine(),allowed=choices.flat();
    const verified=engine.validateCandidateSequence(items,skeleton,allowed,base.focusKey);
    if(!verified.valid)throw new Error(verified.error||'计划结构校验未通过');
    const nextWorkout=items.map((item,index)=>{
      const old=base.workout[index],choice=allowed.find(ex=>ex.exerciseId===item.exerciseId);
      const sets=Number(item.sets),reps=Number(item.reps),weight=Number(item.weight),rest=Number(item.rest);
      if(!Number.isInteger(sets)||sets<1||sets>5||!Number.isInteger(reps)||reps<4||reps>20||!Number.isFinite(weight)||weight<0||weight>1000||!Number.isInteger(rest)||rest<30||rest>180)throw new Error('AI 返回的训练数字超出范围');
      const maxRepChange=Math.max(2,Math.ceil(old.reps*.25));
      if(sets>old.sets||Math.abs(reps-old.reps)>maxRepChange||Math.abs(rest-old.rest)>60)throw new Error('AI 返回的训练调整幅度过大');
      const referenceWeight=old.weight||choice.weight;
      if(referenceWeight>0&&Math.abs(weight-referenceWeight)/referenceWeight>.10)throw new Error('AI 返回的重量变化过大');
      return {...old,...choice,id:old.id,role:old.role,locked:old.locked,sets,reps,weight,rest,reason:String(item.reason||old.reason).slice(0,120),previous:old.previous};
    });
    const balance=engine.validatePlanBalance(nextWorkout,base.focusKey); if(!balance.valid)throw new Error('计划结构不完整');
    return {plan:{...base,workout:nextWorkout,source:'ai-validated',notice:String(result.summary||'已结合训练方向、近期实际记录和今天状态调整。').slice(0,180)},usedAI:true};
  } catch(e) {
    console.warn('AI 计划适配未通过，保留本地计划:',e);
    return {plan:{...base,notice:'AI 暂不可用或建议未通过安全检查，已保留本地计划。'},usedAI:false,error:e.message};
  }
}

async function generateTodayPlan() {
  let generated;
  try {
    generated = createLocalPlan();
  } catch(e) {
    console.warn('本地计划首次生成失败，正在修复兼容数据:', e);
    ensureUserDataCompatibility();
    generated = createLocalPlan();
  }
  generated= (await adaptPlanWithAI(generated)).plan;
  generated.aiUsed=generated.source==='ai-validated';
  todayPlan = generated;
  if(!LS.transaction({today_plan:todayPlan,active_training:null})) { todayPlan=null;dataRecoveryNotice='计划保存失败，尚未开始训练。请重试或先导出备份。';return null; }
  return todayPlan;
}

// ============ 上次训练摘要 ============
function getLastSessionSummary() {
  if (sessions.length === 0) return null;
  const s = sessions[0];
  const totalSets = s.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const dur = s.duration || 0;
  return {
    dayName: s.dayName,
    date: s.date,
    totalSets: totalSets,
    duration: formatTime(dur),
    feedback:s.sessionFeedback||''
  };
}
