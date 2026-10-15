// ============ 教练流程默认数据 ============
const DEFAULT_PROFILE = {
  height:0, weight:0, bodyFat:0, trainingDays:0, experience:'待了解', goal:'等待教练确认', equipment:[],
  planTemplate:'coach', chest:0, waist:0, arm:0, thigh:0,
  trainingDirection:'', experienceSummary:'', limitations:'', onboardingComplete:false,
  aiPlanEnabled:false, trainingNotes:[]
};

const DEFAULT_PLAN = { name:'教练安排', cycle:'按阶段规划', days:[{id:'coach-day',name:'教练安排',focus:'根据阶段目标',exercises:[]}] };
const PLAN_TEMPLATES = { coach:{name:'教练安排',cycle:'按阶段规划',days:DEFAULT_PLAN.days} };
const USER_DATA_KEYS = ['profile','plan','sessions','sessions_archive','body_records','measurements','today_index','today_plan','active_training','cycle_variants','core_locks','training_phase','setup_draft','onboarding_draft','exercise_preferences','exercise_catalog_version'];
const DEFAULT_CYCLE_VARIANTS = { push:'A', pull:'A', legs:'A' };
const DEFAULT_SETUP_STATE = { focus:'', focusKey:'', trainingFocus:'', state:'状态一般', time:'45分钟', env:'健身房', discomfort:[], discomfortText:'无' , avoid:'' };
const DEFAULT_ONBOARDING_DRAFT = { step:0, direction:'', frequency:'', experience:'', limitations:'' };
const DEFAULT_EXERCISE_PREFERENCES = { version:1, catalogVersion:'', paused:{}, lightChoices:{} };
let exerciseCatalog = null;
let exerciseCatalogStatus = 'idle';
let exerciseCatalogError = '';
let exerciseInstructions = null;
const openInstructionIds = new Set();

const BACKUP_VERSION = 3;
const EXERCISE_CATALOG_URL = './public/data/exercise-catalog.v1.json';
const EXERCISE_INSTRUCTIONS_URL = './public/data/exercise-instructions-zh.v1.json';

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sameData(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); }
  catch(e) { return false; }
}

function isValidPlanData(value) {
  return isPlainRecord(value) && Array.isArray(value.days) && value.days.length > 0 && value.days.every(day =>
    isPlainRecord(day) && typeof day.name === 'string' && day.name.trim() && typeof day.focus === 'string' && Array.isArray(day.exercises)
  );
}

function getExerciseEngine() {
  return window.IronTrackExerciseEngine || null;
}

function normalizeExercisePreferences(value) {
  const source = isPlainRecord(value) ? value : {};
  return {
    version:1,
    catalogVersion:typeof source.catalogVersion === 'string' ? source.catalogVersion : '',
    paused:isPlainRecord(source.paused) ? source.paused : {},
    lightChoices:isPlainRecord(source.lightChoices) ? source.lightChoices : {}
  };
}

function catalogExerciseFor(reference) {
  const engine = getExerciseEngine();
  if (!engine || !exerciseCatalog) return null;
  const resolved = engine.resolveLegacyExercise(reference, exerciseCatalog);
  if (!resolved || !resolved.exerciseId?.startsWith('exds:')) return null;
  return engine.normalizeExercise(resolved);
}

function stableExerciseId(reference) {
  const engine = getExerciseEngine();
  if (!engine || !exerciseCatalog) return reference?.exerciseId || '';
  const resolved = engine.resolveLegacyExercise(reference, exerciseCatalog);
  return resolved?.exerciseId || reference?.exerciseId || '';
}

function inferReplacementMuscle(ex, focusKey) {
  if (ex.replacementMuscle) return ex.replacementMuscle;
  const name = String(ex.name || ex.nameZh || '');
  const pattern = ex.pattern || ex.movementPatterns?.[0] || '';
  if (focusKey === 'push') {
    if (pattern === '肘伸' || /三头|窄握|窄距|钻石/.test(name)) return '肱三头肌';
    if (['垂直推','肩外展','肩后束','肩屈','肩胛控制'].includes(pattern) || /肩|飞鸟/.test(name) && /反向|俯身/.test(name)) return '三角肌';
    return '胸肌';
  }
  if (focusKey === 'pull') {
    if (pattern === '肘屈' || /弯举/.test(name)) return '肱二头肌';
    if (/耸肩/.test(name)) return '斜方肌';
    if (pattern === '垂直拉' || /下拉|引体/.test(name)) return '背阔肌';
    return '上背';
  }
  if (pattern === '核心') return '核心';
  if (pattern === '提踵') return '小腿肌群';
  if (pattern === '屈膝' || /腿弯举/.test(name)) return '腘绳肌';
  if (['膝主导','单腿膝主导','膝伸'].includes(pattern)) return '股四头肌';
  return '臀肌';
}

function inferLoadRegions(ex) {
  const pattern = ex.pattern || ex.movementPatterns?.[0] || '';
  const regions = [];
  if (['水平推','垂直推','肩外展','肩后束','肩屈','水平拉','垂直拉','肩胛控制'].includes(pattern)) regions.push('肩');
  if (['水平推','垂直推','水平拉','垂直拉','肘屈','肘伸'].includes(pattern)) regions.push('肘/腕');
  if (['髋主导','水平拉'].includes(pattern)) regions.push('腰背');
  if (['髋主导','膝主导','单腿膝主导'].includes(pattern)) regions.push('髋');
  if (['膝主导','单腿膝主导','膝伸','屈膝'].includes(pattern)) regions.push('膝');
  if (pattern === '提踵' || pattern === '单腿膝主导') regions.push('踝');
  return [...new Set(regions)];
}

function enrichRuntimeExercise(base, focusKey) {
  const source = cloneData(base || {});
  const catalogMatch = catalogExerciseFor(source);
  const stableId = catalogMatch?.exerciseId || stableExerciseId(source) || source.exerciseId || '';
  const name = source.name || source.nameZh || catalogMatch?.name || '';
  const pattern = source.pattern || source.movementPatterns?.[0] || catalogMatch?.pattern || '综合';
  return Object.assign({}, catalogMatch || {}, source, {
    exerciseId:stableId,
    name,
    nameZh:name,
    nameSnapshot:source.nameSnapshot || name,
    pattern,
    movementPatterns:source.movementPatterns || catalogMatch?.movementPatterns || [pattern],
    equipment:Array.isArray(source.equipment) && source.equipment.length ? source.equipment : (catalogMatch?.equipment || ['徒手']),
    replacementMuscle:catalogMatch?.replacementMuscle || inferReplacementMuscle(source, focusKey),
    loadRegions:catalogMatch?.loadRegions || inferLoadRegions(source),
    balanceTags:catalogMatch?.balanceTags || [pattern],
    variantGroup:catalogMatch?.variantGroup || source.variantGroup || pattern,
    catalogVersion:catalogMatch?.catalogVersion || source.catalogVersion || (stableId.startsWith('exds:') ? exerciseCatalog?.version || '' : '')
  });
}

function migrateExerciseReferences() {
  if (!currentUser || !exerciseCatalog || LS.get('catalog_migration_v1', '') === exerciseCatalog.version) return;
  const engine = getExerciseEngine();
  if (!engine?.migrateLegacyData) return;
  const original = {
    plan:LS.get('plan', null), sessions:LS.get('sessions', []), today_plan:LS.get('today_plan', null), active_training:LS.get('active_training', null)
  };
  const migrated = engine.migrateLegacyData(original, exerciseCatalog);
  const next = migrated.data;
  const changes = migrated.changes;
  if (changes > 0) {
    const saved = LS.set('catalog_compat_recovery_v1', { savedAt:new Date().toISOString(), catalogVersion:exerciseCatalog.version, data:original });
    if (!saved) {
      console.warn('动作编号兼容快照保存失败，本次不迁移旧数据');
      return;
    }
    if (!LS.transaction({...next, exercise_preferences:{...exercisePreferences,catalogVersion:exerciseCatalog.version}, exercise_catalog_version:exerciseCatalog.version, catalog_migration_v1:exerciseCatalog.version})) {
      console.warn('动作编号兼容写入失败，已保留恢复资料');
      return;
    }
    plan = next.plan;
    sessions = next.sessions;
    if (todayPlan) todayPlan = next.today_plan;
    if (trainState?.day && next.active_training?.state?.day) trainState.day.exercises = next.active_training.state.day.exercises;
  }
  exercisePreferences.catalogVersion = exerciseCatalog.version;
  LS.set('exercise_preferences', exercisePreferences);
  LS.set('exercise_catalog_version', exerciseCatalog.version);
  LS.set('catalog_migration_v1', exerciseCatalog.version);
}

async function ensureExerciseCatalog() {
  if (exerciseCatalog) return exerciseCatalog;
  if (exerciseCatalogStatus === 'loading') {
    while (exerciseCatalogStatus === 'loading') await new Promise(resolve => setTimeout(resolve, 25));
    return exerciseCatalog;
  }
  exerciseCatalogStatus = 'loading';
  try {
    const response = await fetch(EXERCISE_CATALOG_URL, { cache:'no-cache' });
    if (!response.ok) throw new Error(`目录请求失败 ${response.status}`);
    const catalog = await response.json();
    if (!catalog || catalog.version !== 'irontrack-exercises-v1' || !Array.isArray(catalog.exercises) || catalog.exercises.length < 200) throw new Error('目录结构或版本不合规');
    const engine = getExerciseEngine();
    if (!engine) throw new Error('动作引擎未加载');
    const normalized = catalog.exercises.map(item => engine.normalizeExercise(item));
    if (normalized.some(item => !item)) throw new Error('目录包含无效动作');
    exerciseCatalog = catalog;
    exerciseCatalogStatus = 'ready';
    exerciseCatalogError = '';
    migrateExerciseReferences();
    return exerciseCatalog;
  } catch(e) {
    console.warn('精选动作库加载失败，继续使用原内置动作库:', e);
    exerciseCatalog = null;
    exerciseCatalogStatus = 'failed';
    exerciseCatalogError = e.message || '加载失败';
    return null;
  }
}

async function ensureExerciseInstructions() {
  if (exerciseInstructions) return exerciseInstructions;
  try {
    const response = await fetch(EXERCISE_INSTRUCTIONS_URL, { cache:'force-cache' });
    if (!response.ok) throw new Error('说明请求失败');
    const bundle = await response.json();
    if (!bundle || bundle.version !== exerciseCatalog?.version || !isPlainRecord(bundle.instructions)) throw new Error('说明版本不一致');
    exerciseInstructions = bundle.instructions;
    return exerciseInstructions;
  } catch(e) {
    console.warn('动作说明加载失败:', e);
    return null;
  }
}

// 数据边界：导入先完整验证；本地异常数据先隔离原文，再使用安全值。
let pendingRecoveryData = null;
let dataRecoveryNotice = '';

function rememberCompatibilityData(recovery) {
  if (!Object.keys(recovery).length) return true;
  pendingRecoveryData = recovery;
  const existing = LS.get('compat_recovery', null);
  const entries = Array.isArray(existing?.entries) ? existing.entries.slice() :
    (isPlainRecord(existing?.data) ? [{ savedAt:existing.savedAt, data:existing.data }] : []);
  if (!entries.some(entry => sameData(entry.data, recovery))) entries.push({ savedAt:new Date().toISOString(), data:recovery });
  if (!LS.set('compat_recovery', { version:1, entries })) return false;
  pendingRecoveryData = null;
  return true;
}

function dataNumber(value, label, min=0, integer=false) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') throw new Error(label+'不是有效数字');
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || (integer && !Number.isInteger(n))) throw new Error(label+'不是有效数字');
  return n;
}

function dataText(value, label, fallback='') {
  if (value == null) return fallback;
  if (typeof value !== 'string') throw new Error(label+'不是文本');
  return value;
}

function checkedExercise(ex, runtime=false) {
  if (!isPlainRecord(ex) || typeof ex.name !== 'string' || !ex.name.trim()) throw new Error('动作名称缺失');
  const out = cloneData(ex);
  if (out.role != null && !['核心','辅助'].includes(out.role)) throw new Error('动作角色异常');
  if (out.previous != null) {
    if (!isPlainRecord(out.previous)) throw new Error('上次动作记录异常');
    out.previous.weight = dataNumber(out.previous.weight,'上次重量');
    out.previous.reps = dataNumber(out.previous.reps,'上次次数',0,true);
  }
  if (runtime && (typeof ex.id !== 'string' || !ex.id)) throw new Error('进行中动作编号缺失');
  ['sets','reps','weight','rest'].forEach(key => {
    out[key] = dataNumber(ex[key], '动作'+key, key === 'sets' ? 1 : 0, key === 'sets' || key === 'reps');
  });
  ['id','exerciseId','role','reason','pattern','nameSnapshot','replacementMuscle','catalogVersion'].forEach(key => {
    if (out[key] != null) out[key] = dataText(out[key], key);
  });
  return out;
}

function checkedSession(session) {
  if (!isPlainRecord(session) || !Array.isArray(session.exercises)) throw new Error('训练历史结构异常');
  const out = cloneData(session);
  out.date = dataText(out.date, '训练日期');
  out.duration = dataNumber(out.duration ?? 0, '训练时长');
  ['startedDate','completedAt','sessionFeedback','sessionDiscomfort'].forEach(key=>{if(out[key]!=null)out[key]=dataText(out[key],key);});
  if(out.progressionAdvanced!=null&&typeof out.progressionAdvanced!=='boolean')throw new Error('训练推进状态异常');
  out.exercises = out.exercises.map(ex => {
    if (!isPlainRecord(ex) || typeof ex.name !== 'string' || !Array.isArray(ex.sets)) throw new Error('历史动作或组记录异常');
    const item = cloneData(ex);
    ['targetSets','targetReps','targetWeight'].forEach(key=>{if(item[key]!=null)item[key]=dataNumber(item[key],key,key==='targetSets'?1:0,key!=='targetWeight');});
    if(item.status!=null&&!['completed','partial','skipped','not_started'].includes(item.status))throw new Error('历史动作完成状态异常');
    ['completed','skipped'].forEach(key=>{if(item[key]!=null&&typeof item[key]!=='boolean')throw new Error('历史动作状态异常');});
    item.sets = item.sets.map(set => {
      if (!isPlainRecord(set)) throw new Error('组记录异常');
      return Object.assign({}, set, { w:dataNumber(set.w,'历史重量'), r:dataNumber(set.r,'历史次数',0,true) });
    });
    return item;
  });
  return out;
}

function normalizeTodayPlanData(value) {
  if (value == null) return null;
  if (!isPlainRecord(value) || !Array.isArray(value.workout) || !value.workout.length) throw new Error('训练计划结构异常');
  const out = cloneData(value);
  out.workout = out.workout.map(ex => checkedExercise(ex, true));
  if (new Set(out.workout.map(ex=>ex.id)).size !== out.workout.length) throw new Error('动作编号重复');
  out.id = dataText(out.id, '计划编号') || 'recovered-plan-'+Date.now();
  out.date = dataText(out.date, '计划日期', getTodayStr());
  if (out.status != null && !['preview','active'].includes(out.status)) throw new Error('计划状态异常');
  out.status = out.status || 'active';
  if (out.variant != null && !['A','B'].includes(out.variant)) throw new Error('计划 A/B 状态异常');
  if (out.factors != null && !isPlainRecord(out.factors)) throw new Error('训练设置异常');
  out.factors = out.factors || {};
  ['warmup','stretch'].forEach(key => {
    if (out[key] != null && !Array.isArray(out[key])) throw new Error('热身或拉伸结构异常');
    out[key] = (out[key] || []).map(item => {
      if (!isPlainRecord(item) || typeof item.name !== 'string') throw new Error('热身或拉伸动作异常');
      return item;
    });
  });
  return out;
}

function checkedActiveTraining(value, today) {
  if (value == null) return null;
  if (!today || today.status !== 'active' || !isPlainRecord(value) || value.planId !== today.id || !isPlainRecord(value.state)) throw new Error('进行中训练与计划不匹配');
  const out = cloneData(value), s = out.state;
  if (!isPlainRecord(s.day) || !Array.isArray(s.day.exercises) || !s.day.exercises.length) throw new Error('进行中动作缺失');
  s.day.exercises = s.day.exercises.map(ex=>checkedExercise(ex,true));
  if (!sameData(s.day.exercises.map(ex=>ex.id),today.workout.map(ex=>ex.id))) throw new Error('进行中动作编号与计划不一致');
  s.exIdx = dataNumber(s.exIdx,'动作位置',0,true);
  if (s.exIdx >= s.day.exercises.length) throw new Error('动作位置越界');
  s.set = dataNumber(s.set,'当前组',1,true);
  s.weight = dataNumber(s.weight,'当前重量');
  s.reps = dataNumber(s.reps,'当前次数',0,true);
  s.sessionTime = dataNumber(s.sessionTime ?? 0,'训练时长');
  s.restTimer = dataNumber(s.restTimer ?? 0,'休息时长');
  s.restEndAt = dataNumber(s.restEndAt ?? 0,'休息结束时间');
  if (!['warmup','workout','stretch','nutrition','finish'].includes(s.section)) throw new Error('训练板块异常');
  const ids = new Set(s.day.exercises.map(ex=>ex.id));
  if (!isPlainRecord(s.records)) throw new Error('进行中组记录异常');
  Object.entries(s.records).forEach(([id,sets]) => {
    if (!ids.has(id) || !Array.isArray(sets)) throw new Error('组记录编号异常');
    s.records[id] = sets.map((set,index) => {
      if (!isPlainRecord(set)) throw new Error('组记录异常');
      return { ...set, set:dataNumber(set.set ?? index+1,'组序号',1,true), w:dataNumber(set.w,'重量'), r:dataNumber(set.r,'次数',0,true) };
    });
  });
  ['feedback','skipped'].forEach(key => {
    if (s[key] != null && !isPlainRecord(s[key])) throw new Error('动作反馈异常');
    s[key] = s[key] || {};
  });
  if (Object.values(s.feedback).some(item=>!isPlainRecord(item))) throw new Error('动作反馈内容异常');
  if (s.pendingFeedback != null && !ids.has(s.pendingFeedback)) throw new Error('待反馈动作异常');
  ['warmupDone','stretchDone'].forEach((key,i) => {
    if (s[key] != null && !Array.isArray(s[key])) throw new Error('热身或拉伸进度异常');
    s[key] = s[key] || [];
    if (s[key].some(n=>!Number.isInteger(n)||n<0||n>=today[i?'stretch':'warmup'].length)) throw new Error('热身或拉伸进度越界');
  });
  if (s.pendingCompletion != null) {
    if (!isPlainRecord(s.pendingCompletion)) throw new Error('待保存训练异常');
    s.pendingCompletion.session = checkedSession(s.pendingCompletion.session);
    s.pendingCompletion.nextIndex = dataNumber(s.pendingCompletion.nextIndex,'下一训练日',0,true);
    s.pendingCompletion.phase = checkedPhase(s.pendingCompletion.phase);
    if (!isPlainRecord(s.pendingCompletion.variants) || ['push','pull','legs'].some(k=>!['A','B'].includes(s.pendingCompletion.variants[k]))) throw new Error('待保存周期异常');
  }
  s.timerInterval = null;
  s.restInterval = null;
  return out;
}

function checkedPhase(value) {
  if (!isPlainRecord(value)) throw new Error('训练阶段异常');
  return { ...value, startedAt:dataText(value.startedAt,'阶段起点',getTodayStr()), completedSessions:dataNumber(value.completedSessions ?? 0,'已完成次数',0,true) };
}

function normalizeUserData(source, strict=false) {
  const data = {}, recovery = {}, issues = [];
  function field(key, fallback, check) {
    const raw = source[key];
    try { data[key] = raw == null ? cloneData(fallback) : check(raw); }
    catch(e) { issues.push(key+'：'+e.message); recovery[key] = raw; data[key] = cloneData(fallback); }
  }
  function records(key, check) {
    field(key, [], value => {
      if (!Array.isArray(value)) throw new Error('应为记录列表');
      return value.flatMap(item => {
        try { return [check(item)]; }
        catch(e) { recovery[key] = value; issues.push(key+'：'+e.message); return []; }
      });
    });
  }
  field('profile', DEFAULT_PROFILE, value => {
    if (!isPlainRecord(value)) throw new Error('个人档案结构异常');
    const out = Object.assign(cloneData(DEFAULT_PROFILE), value);
    ['height','weight','bodyFat','trainingDays','chest','waist','arm','thigh'].forEach(key => { out[key] = dataNumber(out[key],key); });
    ['goal','experience','planTemplate'].forEach(key => { out[key] = dataText(out[key],key); });
    ['trainingDirection','experienceSummary','limitations'].forEach(key => { out[key] = dataText(out[key],key); });
    out.onboardingComplete = value.onboardingComplete == null ? true : value.onboardingComplete === true;
    out.aiPlanEnabled = value.aiPlanEnabled === true;
    out.trainingNotes = Array.isArray(value.trainingNotes) ? value.trainingNotes.filter(item=>typeof item==='string').slice(-30) : [];
    if (!Array.isArray(out.equipment) || out.equipment.some(e=>typeof e!=='string')) throw new Error('器械列表异常');
    if (!PLAN_TEMPLATES[out.planTemplate]) out.planTemplate = 'coach';
    return out;
  });
  const tmpl = PLAN_TEMPLATES[data.profile.planTemplate] || PLAN_TEMPLATES.coach;
  field('plan', { name:tmpl.name, cycle:tmpl.cycle, days:tmpl.days }, value => {
    if (!isValidPlanData(value)) throw new Error('训练体系结构异常');
    const out = cloneData(value);
    out.days.forEach(day => { day.exercises = day.exercises.map(ex=>checkedExercise(ex)); });
    return out;
  });
  records('sessions', checkedSession);
  records('sessions_archive', checkedSession);
  records('body_records', value => {
    if (!isPlainRecord(value) || typeof value.date !== 'string') throw new Error('身体记录日期异常');
    return { ...value, weight:dataNumber(value.weight,'体重'), ...(value.bodyFat == null ? {} : {bodyFat:dataNumber(value.bodyFat,'体脂')}) };
  });
  records('measurements', value => {
    if (!isPlainRecord(value) || typeof value.date !== 'string') throw new Error('围度日期异常');
    const out = cloneData(value);
    ['chest','waist','arm','thigh'].forEach(k=>{if(out[k]!=null)out[k]=dataNumber(out[k],k);});
    return out;
  });
  field('today_index', 0, v=>dataNumber(v,'训练日',0,true));
  field('cycle_variants', DEFAULT_CYCLE_VARIANTS, value => {
    if (!isPlainRecord(value)) throw new Error('周期状态异常');
    const out = { ...DEFAULT_CYCLE_VARIANTS, ...value };
    if (['push','pull','legs'].some(k=>!['A','B'].includes(out[k]))) throw new Error('A/B 状态异常');
    return out;
  });
  field('core_locks', {}, value=>{if(!isPlainRecord(value)||Object.values(value).some(v=>typeof v!=='boolean'))throw new Error('锁定状态异常');return value;});
  field('training_phase', {startedAt:getTodayStr(),completedSessions:0}, checkedPhase);
  field('setup_draft', null, value=>{
    if(!isPlainRecord(value))throw new Error('设置草稿异常');
    const out={...DEFAULT_SETUP_STATE,...value};
    ['focus','state','time','env','avoid'].forEach(k=>{out[k]=dataText(out[k],k);});
    out.focusKey=out.focusKey===''?'':dataText(out.focusKey,'训练日');
    if(out.focusKey&&!['push','pull','legs'].includes(out.focusKey))throw new Error('训练日设置异常');
    out.trainingFocus=dataText(out.trainingFocus,'训练重点');
    out.discomfortText=dataText(out.discomfortText,'不适说明','无');
    if(!Array.isArray(out.discomfort)||out.discomfort.some(v=>typeof v!=='string'))throw new Error('不适设置异常');
    return out;
  });
  field('onboarding_draft', DEFAULT_ONBOARDING_DRAFT, value=>{
    if(!isPlainRecord(value))throw new Error('首次训练档案对话异常');
    const out={...DEFAULT_ONBOARDING_DRAFT,...value};
    out.step=dataNumber(out.step,'对话进度',0,true);
    if(out.step>4)throw new Error('首次训练档案对话进度异常');
    ['direction','frequency','experience','limitations'].forEach(k=>out[k]=dataText(out[k],k));
    return out;
  });
  field('exercise_preferences', DEFAULT_EXERCISE_PREFERENCES, value=>{
    if(!isPlainRecord(value))throw new Error('动作偏好异常');
    const out=normalizeExercisePreferences(value);
    if(value.paused!=null&&!isPlainRecord(value.paused)||value.lightChoices!=null&&!isPlainRecord(value.lightChoices))throw new Error('动作偏好列表异常');
    if(Object.values(out.paused).some(v=>!isPlainRecord(v)))throw new Error('暂停推荐内容异常');
    return out;
  });
  field('exercise_catalog_version', '', v=>dataText(v,'动作库版本'));
  field('today_plan', null, normalizeTodayPlanData);
  field('active_training', null, v=>checkedActiveTraining(v,data.today_plan));
  if (strict && issues.length) throw new Error(issues.slice(0,3).join('；'));
  return { data, recovery, issues };
}

function ensureUserDataCompatibility() {
  const raw = {}, unreadable = {};
  USER_DATA_KEYS.forEach(key => {
    try {
      const text = LS.raw(key);
      try { raw[key] = text == null ? null : JSON.parse(text); }
      catch(e) { unreadable[key] = { rawJSON:text }; raw[key] = null; }
    } catch(e) { LS.blocked = true; dataRecoveryNotice = '无法读取本地数据，已暂停写入。'; }
  });
  const result = normalizeUserData(raw);
  const recovery = Object.assign({}, result.recovery, unreadable);
  if (Object.keys(recovery).length) {
    dataRecoveryNotice = '已隔离异常数据，正常记录仍可使用。请在“我的”导出恢复资料。';
    if (!rememberCompatibilityData(recovery)) {
      LS.blocked = true;
      dataRecoveryNotice = '异常原文未能保存快照，已暂停写入；请先导出恢复资料。';
    }
  }
  const changes = {};
  USER_DATA_KEYS.forEach(key=>{if(!sameData(raw[key],result.data[key]))changes[key]=result.data[key];});
  if (Object.keys(changes).length && !LS.transaction(changes)) dataRecoveryNotice = dataRecoveryNotice || '兼容数据尚未写入，请先导出备份并检查存储空间。';
  const d = result.data;
  profile=d.profile; plan=d.plan; sessions=d.sessions; bodyRecords=d.body_records; measurements=d.measurements;
  todayIndex=d.today_index; cycleVariants=d.cycle_variants; coreLocks=d.core_locks; trainingPhase=d.training_phase; exercisePreferences=d.exercise_preferences;
  return d;
}
