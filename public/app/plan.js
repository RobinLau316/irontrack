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

function renderTrainingSetup(notice='') {
  if (!currentUser) return;
  setTrainingFixedAction(false);
  const suggested = suggestTodayFocus();
  const savedDraft = LS.get('setup_draft', null);
  setupSel = isPlainRecord(savedDraft) ? Object.assign(cloneData(DEFAULT_SETUP_STATE), savedDraft) : cloneData(DEFAULT_SETUP_STATE);
  setupSel.focusKey=['push','pull','legs'].includes(setupSel.focusKey)?setupSel.focusKey:(setupSel.focus?focusKeyFromText(setupSel.focus):suggested.key);
  setupSel.focus=focusLabelFromKey(setupSel.focusKey);
  setupSel.trainingFocus=String(setupSel.trainingFocus||'');
  setupSel.discomfort = Array.isArray(setupSel.discomfort) ? setupSel.discomfort : [];
  setupSel.discomfortText = typeof setupSel.discomfortText === 'string' ? setupSel.discomfortText : '无';
  const focusChips = [['push','推日'],['pull','拉日'],['legs','腿日']].map(([key,label])=>`<button type="button" class="opt-chip ${setupSel.focusKey===key?'sel':''}" aria-pressed="${setupSel.focusKey===key}" onclick="pickFocus('${key}')">${label}</button>`).join('');
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
      <div class="setup-subtitle">按训练循环建议 ${escapeHtml(suggested.day.name)}；你可以直接更改。延续「${escapeHtml(profile.trainingDirection||profile.goal||'持续进步')}」训练方向</div>
      ${catalogStatusHtml}
      ${notice?`<div class="resume-banner">${escapeHtml(notice)}</div>`:''}
      <div class="setup-group"><span class="setup-label">今天练哪一天？</span><div class="opt-grid" id="setupFocus">${focusChips}</div></div>
      <div class="setup-group"><label class="setup-label" for="trainingFocus">今天训练重点（选填）</label><input id="trainingFocus" class="setup-input" maxlength="120" value="${escapeHtml(setupSel.trainingFocus)}" placeholder="例如：以胸部为重点" oninput="setTrainingFocusNote(this.value)"></div>
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
function pickFocus(key) {
  if(!['push','pull','legs'].includes(key))return;
  setupSel.focusKey=key;setupSel.focus=focusLabelFromKey(key);saveSetupDraft();
  document.querySelectorAll('#setupFocus .opt-chip').forEach((chip,index)=>{const selected=['push','pull','legs'][index]===key;chip.classList.toggle('sel',selected);chip.setAttribute('aria-pressed',String(selected));});
}
function setTrainingFocusNote(value) { setupSel.trainingFocus=String(value||'').slice(0,120);saveSetupDraft(); }
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
  if(!['push','pull','legs'].includes(setupSel.focusKey))setupSel.focusKey=suggestTodayFocus().key;
  setupSel.focus=focusLabelFromKey(setupSel.focusKey); setupSel.env='健身房'; setupSel.avoid='';
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
  // 默认健身房按器械齐全处理；旧档案的设备清单不再意外排除馆内动作。
  return true;
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
    factors:{ focus:setupSel.focus, focusKey:key, trainingFocus:setupSel.trainingFocus||'', state:setupSel.state, time:setupSel.time, env:setupSel.env, discomfort:setupSel.discomfort.slice(), discomfortText:setupSel.discomfortText, avoid:setupSel.avoid },
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
    factors:{ focus:setupSel.focus, focusKey:key, trainingFocus:setupSel.trainingFocus||'', state:setupSel.state, time:setupSel.time, env:setupSel.env, discomfort:setupSel.discomfort.slice(), discomfortText:setupSel.discomfortText, avoid:setupSel.avoid },
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
    date:s.date, duration:s.duration, feedback:s.sessionFeedback||'',discomfort:s.sessionDiscomfort||'',
    exercises:(s.exercises||[]).map(ex=>({id:ex.exerciseId||'',name:ex.name,role:ex.role||'',targetSets:ex.targetSets??null,targetReps:ex.targetReps??null,targetWeight:ex.targetWeight??null,status:ex.status||'',sets:(ex.sets||[]).map(set=>({w:set.w,r:set.r})) ,feedback:ex.feedback||''}))
  }));
}

function safeParseAIJson(text) {
  let value=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start=value.indexOf('{'),end=value.lastIndexOf('}');
  if(start<0||end<start)throw new Error('AI 未返回计划数据');
  return JSON.parse(value.slice(start,end+1));
}

function allowedPlanChoices(base) {
  return getCatalogCandidates(base.focusKey||'push');
}

// AI plan count remains a real choice; two is the structural minimum (one primary plus one accessory).
function minimumDynamicExerciseCount() { return 2; }
function dynamicSetBudget(time,state) {
  const minutes=Number(String(time||'45分钟').match(/\d+/)?.[0])||45;
  const byTime=Math.min(32,Math.floor(minutes*.45));
  const byRecovery=state==='比较疲劳'?12:state==='有些疲惫'?18:32;
  return Math.min(byTime,byRecovery);
}

function recentReferenceWeight(choice, exactRecord) {
  if(exactRecord)return Math.max(...exactRecord.exercise.sets.map(set=>Number(set.w)||0));
  let highest=0;
  const key=(choice.pplTags||[]).find(item=>['push','pull','legs'].includes(item));
  for(const session of sessions.slice(0,8)){
    if(focusKeyFromText(session.focusArea||session.dayName)!==key)continue;
    for(const exercise of session.exercises||[]){
      if(exercise.pattern!==choice.pattern||!Array.isArray(exercise.sets)||!['completed','partial'].includes(exercise.status))continue;
      exercise.sets.forEach(set=>{highest=Math.max(highest,Number(set.w)||0);});
    }
  }
  return highest||Number(choice.weight)||0;
}

function dynamicPlanPromptPayload(base, requestText, candidates) {
  const pool=candidates.map(ex=>({
    exerciseId:ex.exerciseId,name:ex.name,primaryMuscles:ex.primaryMuscles||[],secondaryMuscles:ex.secondaryMuscles||[],
    replacementMuscle:ex.replacementMuscle,pattern:ex.pattern,movementPatterns:ex.movementPatterns||[],
    equipment:ex.equipment||[],roleEligibility:ex.roleEligibility||[],sets:ex.sets,reps:ex.reps,weight:ex.weight,rest:ex.rest
  }));
  return {
    profile:{direction:profile.trainingDirection||profile.goal,daysPerWeek:profile.trainingDays,experience:profile.experienceSummary||profile.experience,limitations:profile.limitations,notes:(profile.trainingNotes||[]).slice(-10)},
    today:{day:base.focus,focusKey:base.focusKey,trainingFocus:setupSel.trainingFocus||'',minutes:setupSel.time,fatigue:setupSel.state,discomfort:setupSel.discomfortText},
    recent:recentTrainingContext(base.focusKey),candidateExercises:pool,currentPlan:base.workout.map(ex=>({exerciseId:ex.exerciseId,name:ex.name,role:ex.role,sets:ex.sets,reps:ex.reps,weight:ex.weight,rest:ex.rest})),userRequest:requestText
  };
}

function validateDynamicAIPlan(items, base, candidates) {
  if(!Array.isArray(items))throw new Error('AI 未返回动作列表');
  const cap=targetExerciseCount(setupSel.time),min=minimumDynamicExerciseCount(setupSel.time);
  if(items.length<min||items.length>cap||items.length>8)throw new Error(`动作数量应为 ${min} 至 ${cap} 个`);
  const byId=new Map(candidates.map(ex=>[ex.exerciseId,ex]));
  const seen=new Set(),workout=[];
  for(const item of items){
    if(!item||typeof item!=='object')throw new Error('AI 返回的动作格式错误');
    const choice=byId.get(String(item.exerciseId||''));
    if(!choice||seen.has(choice.exerciseId))throw new Error('AI 使用了不在安全候选库内的动作或重复动作');
    if(isExerciseBlocked(choice)||!matchesEnvironment(choice))throw new Error('AI 计划包含当前不适合的动作');
    seen.add(choice.exerciseId);
    const role=item.role==='primary'?'核心':item.role==='auxiliary'?'辅助':'';
    const sets=Number(item.sets),reps=Number(item.reps),weight=Number(item.weight),rest=Number(item.rest);
    if(!role||!Number.isInteger(sets)||sets<1||sets>5||!Number.isInteger(reps)||reps<4||reps>20||!Number.isFinite(weight)||weight<0||weight>1000||!Number.isInteger(rest)||rest<30||rest>240)throw new Error('AI 返回的训练数字超出范围');
    if(choice.roleEligibility?.length&&!choice.roleEligibility.includes(role))throw new Error('AI 为动作选择了不适合的主辅角色');
    const previous=getLastExerciseRecord(choice);
    const referenceWeight=recentReferenceWeight(choice,previous);
    if(referenceWeight>0&&weight>referenceWeight*1.15+2.5)throw new Error('AI 建议重量高于近期实际记录的安全校验范围');
    if(referenceWeight===0&&weight!==0)throw new Error('该动作没有可核验重量记录，请先用空重量预览并由用户确认');
    workout.push({...choice,id:'dyn-'+Math.random().toString(36).slice(2,9),role,locked:false,sets,reps,weight,rest,
      reason:String(item.reason||'根据今天的训练重点安排').slice(0,120),purpose:String(item.purpose||'').slice(0,100),
      isNew:isNewCatalogExercise(choice),previous:previous?{weight:referenceWeight,reps:previous.exercise.sets.at(-1)?.r,feedback:previous.exercise.feedback||''}:null});
  }
  if(!workout.some(ex=>ex.role==='核心')||!workout.some(ex=>ex.role==='辅助'))throw new Error('计划需要同时包含主要训练和辅助训练');
  const totalSets=workout.reduce((sum,ex)=>sum+ex.sets,0);
  if(totalSets>dynamicSetBudget(setupSel.time,setupSel.state))throw new Error('AI 安排的总组数超出今天时间与恢复状态的范围');
  return workout;
}

async function adaptPlanWithAI(base, requestText='') {
  if(!profile.aiPlanEnabled)return {plan:base,usedAI:false};
  if(!getGlobalApiKey())return {plan:{...base,notice:'计划 AI 已开启，但尚未设置 API Key；当前为本地备用计划。'},usedAI:false,error:'尚未设置 AI API Key'};
  if(!exerciseCatalog||!getExerciseEngine())return {plan:{...base,notice:'动作库暂不可用，AI 个性化计划未生成；当前为本地备用计划。'},usedAI:false,error:'动作库暂不可用'};
  setupSel={...setupSel,...(base.factors||{}),focus:base.focus,focusKey:base.focusKey,env:'健身房'};
  setupSel.discomfort=Array.isArray(base.factors?.discomfort)?base.factors.discomfort:[];
  setupSel.discomfortText=base.factors?.discomfortText||'无';
  setupSel.trainingFocus=base.factors?.trainingFocus||'';
  setupSel.time=base.factors?.time||setupSel.time;
  setupSel.state=base.factors?.state||setupSel.state;
  const choices=allowedPlanChoices(base);
  if(choices.length<minimumDynamicExerciseCount(setupSel.time))return {plan:{...base,notice:'安全候选动作不足，AI 个性化计划未生成；当前为本地备用计划。'},usedAI:false,error:'安全候选动作不足'};
  const payload=dynamicPlanPromptPayload(base,requestText,choices);
  const setBudget=dynamicSetBudget(setupSel.time,setupSel.state);
  const prompt=`你是 IronTrack 的力量训练计划助手。根据个人训练方向、近期已完成的真实组记录、反馈、今天选定的训练日、可用时间、疲劳、不适和选填训练重点，生成完整且连贯的本次计划。动作库是候选参考，不是固定组合；你要动态决定主要动作与辅助动作、顺序、训练侧重、组数、次数和休息，不能随机换动作，也不能复制固定模板。推日不是默认只练胸；只有用户写明胸部重点时才明显增加胸部主要训练的比重，辅助动作应服务长期安排。保持主要动作的适度连续，只有表现、恢复、疼痛或用户要求支持变化时才调整。跳过或未完成动作不算实际表现。疼痛不做诊断；避开与当前不适冲突的动作，存在风险时安排保守动作或少练，并提示停止引发疼痛的动作。每个动作必须来自 candidateExercises 且 exerciseId 唯一；role 必须符合该动作的 roleEligibility。返回 ${minimumDynamicExerciseCount(setupSel.time)} 至 ${targetExerciseCount(setupSel.time)} 个动作，全计划最多8个，必须同时有主要动作和辅助动作。组数1到5，次数4到20，休息30到240秒；有实际重量记录时，建议重量不得高于该动作或同类动作近期最高值15%以上；没有可核验重量时必须填0，留给用户在预览确认。全计划总组数不得超过${setBudget}组，该上限按可用时间和疲劳程度计算。用 purpose 简短说明每个动作承担的作用，summary 用一句通俗话概括主要与辅助训练安排。请求修改时保留用户没要求改变的内容，确实不清楚才简短追问。不得声称 AI 已生成成功，除非返回完整有效计划。只输出 JSON：{"exercises":[{"exerciseId":"...","role":"primary|auxiliary","sets":3,"reps":8,"weight":20,"rest":90,"reason":"简短安排理由","purpose":"这项训练的作用"}],"summary":"一句话说明本次安排"}。数据如下：\n${JSON.stringify(payload)}`;
  try {
    const raw=await aiCall(prompt,true); if(!raw)throw new Error('AI 暂不可用');
    const result=safeParseAIJson(raw), items=result.exercises;
    const nextWorkout=validateDynamicAIPlan(items,base,choices);
    return {plan:{...base,workout:nextWorkout,source:'ai-validated',notice:String(result.summary||'已结合训练方向、近期实际记录和今天状态调整。').slice(0,180)},usedAI:true};
  } catch(e) {
    console.warn('AI 计划生成未通过，保留本地备用计划:',e);
    return {plan:{...base,notice:`AI 个性化计划未生成（${String(e.message||'调用失败').slice(0,80)}）。当前显示本地备用计划，可重试 AI。`,aiFailure:String(e.message||'调用失败').slice(0,160)},usedAI:false,error:e.message};
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
  const adapted=await adaptPlanWithAI(generated);
  generated=adapted.plan;
  if(adapted.error&&!generated.aiFailure){generated.aiFailure=adapted.error;if(!generated.notice)generated.notice=`AI 个性化计划未生成（${adapted.error}）；当前显示本地备用计划，可重试 AI。`;}
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
