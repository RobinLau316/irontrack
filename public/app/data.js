// ============ 默认数据 ============
const DEFAULT_PROFILE = {
  height: 178, weight: 78.5, bodyFat: 18, trainingDays: 4, experience: '有一定基础', goal: '增肌塑形',
  equipment: ['杠铃','哑铃','卧推架','深蹲架','绳索机','蝴蝶机','腿举机'],
  planTemplate: 'ppl',
  chest: 0, waist: 0, arm: 0, thigh: 0
};

const DEFAULT_PLAN = {
  name: "PPL 推拉腿三分化", cycle: "3天循环",
  days: [
    { id:"d1", name:"推日", focus:"胸+肩+三头", exercises:[
      {id:"e1",name:"杠铃卧推",sets:5,reps:5,weight:80,rest:120},
      {id:"e2",name:"上斜哑铃卧推",sets:4,reps:8,weight:30,rest:90},
      {id:"e3",name:"杠铃推举",sets:4,reps:8,weight:50,rest:90},
      {id:"e4",name:"哑铃侧平举",sets:4,reps:12,weight:12,rest:60},
      {id:"e5",name:"绳索飞鸟",sets:3,reps:12,weight:15,rest:60},
      {id:"e6",name:"绳索下压",sets:4,reps:12,weight:20,rest:60},
      {id:"e7",name:"双杠臂屈伸",sets:3,reps:10,weight:0,rest:90}
    ]},
    { id:"d2", name:"拉日", focus:"背+二头+后束", exercises:[
      {id:"e8",name:"引体向上",sets:4,reps:8,weight:0,rest:120},
      {id:"e9",name:"杠铃划船",sets:4,reps:8,weight:70,rest:90},
      {id:"e10",name:"高位下拉",sets:4,reps:10,weight:55,rest:90},
      {id:"e11",name:"坐姿划船",sets:3,reps:12,weight:45,rest:60},
      {id:"e12",name:"俯身飞鸟",sets:4,reps:12,weight:10,rest:60},
      {id:"e13",name:"杠铃弯举",sets:4,reps:10,weight:30,rest:60},
      {id:"e14",name:"锤式弯举",sets:3,reps:12,weight:14,rest:60}
    ]},
    { id:"d3", name:"腿日", focus:"股四+腘绳+小腿+腹", exercises:[
      {id:"e15",name:"杠铃深蹲",sets:5,reps:5,weight:100,rest:150},
      {id:"e16",name:"罗马尼亚硬拉",sets:4,reps:8,weight:90,rest:120},
      {id:"e17",name:"腿举",sets:4,reps:10,weight:160,rest:90},
      {id:"e18",name:"腿弯举",sets:3,reps:12,weight:40,rest:60},
      {id:"e19",name:"站姿提踵",sets:4,reps:15,weight:80,rest:60},
      {id:"e20",name:"悬垂举腿",sets:3,reps:15,weight:0,rest:60}
    ]}
  ]
};

const PLAN_TEMPLATES = {
  'ppl': {
    name: "PPL 推拉腿三分化", cycle: "3天循环",
    desc: "推日(胸肩三头) + 拉日(背二头后束) + 腿日(腿+腹)，每周可练2轮",
    days: DEFAULT_PLAN.days
  },
  'ppl_shoulder': {
    name: "推拉腿肩四分化", cycle: "4天循环",
    desc: "推胸日 + 拉背日 + 腿部日 + 肩部日，肩部单独训练日",
    days: [
      { id:"s1", name:"推胸日", focus:"胸+三头", exercises:[
        {id:"s1e1",name:"杠铃卧推",sets:5,reps:5,weight:80,rest:120},
        {id:"s1e2",name:"上斜哑铃卧推",sets:4,reps:8,weight:30,rest:90},
        {id:"s1e3",name:"绳索飞鸟",sets:4,reps:12,weight:15,rest:60},
        {id:"s1e4",name:"双杠臂屈伸",sets:3,reps:10,weight:0,rest:90},
        {id:"s1e5",name:"绳索下压",sets:4,reps:12,weight:20,rest:60},
        {id:"s1e6",name:"俯身哑铃臂屈伸",sets:3,reps:12,weight:10,rest:60}
      ]},
      { id:"s2", name:"拉背日", focus:"背+二头", exercises:[
        {id:"s2e1",name:"引体向上",sets:4,reps:8,weight:0,rest:120},
        {id:"s2e2",name:"杠铃划船",sets:4,reps:8,weight:70,rest:90},
        {id:"s2e3",name:"高位下拉",sets:4,reps:10,weight:55,rest:90},
        {id:"s2e4",name:"坐姿划船",sets:3,reps:12,weight:45,rest:60},
        {id:"s2e5",name:"杠铃弯举",sets:4,reps:10,weight:30,rest:60},
        {id:"s2e6",name:"锤式弯举",sets:3,reps:12,weight:14,rest:60}
      ]},
      { id:"s3", name:"腿部日", focus:"股四+腘绳+小腿", exercises:[
        {id:"s3e1",name:"杠铃深蹲",sets:5,reps:5,weight:100,rest:150},
        {id:"s3e2",name:"罗马尼亚硬拉",sets:4,reps:8,weight:90,rest:120},
        {id:"s3e3",name:"腿举",sets:4,reps:10,weight:160,rest:90},
        {id:"s3e4",name:"腿弯举",sets:3,reps:12,weight:40,rest:60},
        {id:"s3e5",name:"站姿提踵",sets:4,reps:15,weight:80,rest:60}
      ]},
      { id:"s4", name:"肩部日", focus:"肩+腹", exercises:[
        {id:"s4e1",name:"杠铃推举",sets:5,reps:5,weight:50,rest:120},
        {id:"s4e2",name:"哑铃侧平举",sets:4,reps:12,weight:12,rest:60},
        {id:"s4e3",name:"俯身飞鸟",sets:4,reps:12,weight:10,rest:60},
        {id:"s4e4",name:"绳索面拉",sets:3,reps:15,weight:15,rest:60},
        {id:"s4e5",name:"悬垂举腿",sets:3,reps:15,weight:0,rest:60}
      ]}
    ]
  },
  'upper_lower': {
    name: "上下肢分化", cycle: "2天循环",
    desc: "上肢日 + 下肢日，适合每周4练",
    days: [
      { id:"u1", name:"上肢日", focus:"胸+背+肩+臂", exercises:[
        {id:"u1e1",name:"杠铃卧推",sets:5,reps:5,weight:80,rest:120},
        {id:"u1e2",name:"引体向上",sets:4,reps:8,weight:0,rest:120},
        {id:"u1e3",name:"杠铃推举",sets:4,reps:8,weight:50,rest:90},
        {id:"u1e4",name:"杠铃划船",sets:4,reps:8,weight:70,rest:90},
        {id:"u1e5",name:"哑铃侧平举",sets:3,reps:12,weight:12,rest:60},
        {id:"u1e6",name:"杠铃弯举",sets:3,reps:10,weight:30,rest:60},
        {id:"u1e7",name:"绳索下压",sets:3,reps:12,weight:20,rest:60}
      ]},
      { id:"u2", name:"下肢日", focus:"股四+腘绳+小腿+腹", exercises:[
        {id:"u2e1",name:"杠铃深蹲",sets:5,reps:5,weight:100,rest:150},
        {id:"u2e2",name:"罗马尼亚硬拉",sets:4,reps:8,weight:90,rest:120},
        {id:"u2e3",name:"腿举",sets:4,reps:10,weight:160,rest:90},
        {id:"u2e4",name:"腿弯举",sets:3,reps:12,weight:40,rest:60},
        {id:"u2e5",name:"站姿提踵",sets:4,reps:15,weight:80,rest:60},
        {id:"u2e6",name:"悬垂举腿",sets:3,reps:15,weight:0,rest:60}
      ]}
    ]
  }
};

const EQUIPMENT_OPTIONS = ['杠铃','哑铃','卧推架','深蹲架','史密斯机','腿举机','高位下拉','绳索机','蝴蝶机','划船机','推肩器','腿弯举','腿屈伸','跑步机','椭圆机','龙门架','引体架','壶铃'];

// 动作库：规则引擎先搭骨架，AI 只在这些边界内做适配。
const X = (name, pattern, equipment, sets, reps, weight, rest, role='辅助') => ({ name, pattern, equipment, sets, reps, weight, rest, role });
const EXERCISE_LIBRARY = {
  push: {
    focus:'胸+肩+三头',
    core:[
      X('杠铃卧推','水平推',['杠铃','卧推架'],5,5,80,120,'核心'),
      X('杠铃推举','垂直推',['杠铃'],4,6,50,120,'核心')
    ],
    auxiliary:[
      X('上斜哑铃卧推','水平推',['哑铃'],4,8,30,90),X('哑铃侧平举','肩外展',['哑铃'],4,12,12,60),
      X('绳索飞鸟','胸内收',['绳索机','龙门架'],3,12,15,60),X('绳索下压','肘伸',['绳索机','龙门架'],4,12,20,60),
      X('双杠臂屈伸','水平推',['徒手'],3,10,0,90),X('俯卧撑','水平推',['徒手'],3,15,0,60),
      X('器械推胸','水平推',['推胸器','蝴蝶机'],4,10,40,90),X('哑铃推肩','垂直推',['哑铃'],3,10,20,90),
      X('反向绳索飞鸟','肩后束',['绳索机','龙门架'],3,15,10,60),X('过顶绳索臂屈伸','肘伸',['绳索机','龙门架'],3,12,15,60),
      X('上斜俯卧撑','水平推',['徒手'],3,15,0,60),X('窄距俯卧撑','肘伸',['徒手'],3,12,0,60),
      X('史密斯上斜卧推','水平推',['史密斯机'],4,8,50,90),X('蝴蝶机夹胸','胸内收',['蝴蝶机'],3,12,35,60),
      X('绳索侧平举','肩外展',['绳索机','龙门架'],3,12,7.5,60),X('窄握卧推','肘伸',['杠铃','卧推架'],3,8,55,90),
      X('阿诺德推举','垂直推',['哑铃'],3,10,16,75)
    ]
  },
  pull: {
    focus:'背+二头+后束',
    core:[
      X('引体向上','垂直拉',['引体架','徒手'],4,6,0,120,'核心'),
      X('杠铃划船','水平拉',['杠铃'],4,8,70,120,'核心')
    ],
    auxiliary:[
      X('高位下拉','垂直拉',['高位下拉'],4,10,55,90),X('坐姿划船','水平拉',['划船机','绳索机'],4,10,45,90),
      X('绳索面拉','肩后束',['绳索机','龙门架'],3,15,15,60),X('杠铃弯举','肘屈',['杠铃'],4,10,30,60),
      X('锤式弯举','肘屈',['哑铃'],3,12,14,60),X('直臂下压','肩伸',['绳索机','龙门架'],3,12,20,60),
      X('单臂哑铃划船','水平拉',['哑铃'],4,10,28,90),X('反向飞鸟','肩后束',['哑铃'],3,15,8,60),
      X('反手高位下拉','垂直拉',['高位下拉'],3,10,45,90),X('胸托哑铃划船','水平拉',['哑铃'],3,10,24,90),
      X('弹力带下拉','垂直拉',['徒手'],3,15,0,60),X('桌下划船','水平拉',['徒手'],3,12,0,60),
      X('T杠划船','水平拉',['杠铃'],4,8,50,90),X('牧师凳弯举','肘屈',['哑铃'],3,12,12,60),
      X('绳索弯举','肘屈',['绳索机','龙门架'],3,12,17.5,60),X('耸肩','肩胛上提',['哑铃','杠铃'],3,12,30,60),
      X('俯卧Y举','肩胛控制',['哑铃','徒手'],3,12,5,60)
    ]
  },
  legs: {
    focus:'股四+腘绳+臀+小腿+腹',
    core:[
      X('杠铃深蹲','膝主导',['杠铃','深蹲架'],5,5,100,150,'核心'),
      X('罗马尼亚硬拉','髋主导',['杠铃','哑铃'],4,8,90,120,'核心')
    ],
    auxiliary:[
      X('腿举','膝主导',['腿举机'],4,10,160,90),X('腿弯举','屈膝',['腿弯举'],4,12,40,75),
      X('站姿提踵','提踵',['杠铃','哑铃'],4,15,60,60),X('悬垂举腿','核心',['引体架','徒手'],3,15,0,60),
      X('臀推','髋主导',['杠铃'],4,10,80,90),X('保加利亚分腿蹲','单腿膝主导',['哑铃'],3,10,18,90),
      X('腿屈伸','膝伸',['腿屈伸'],3,12,35,60),X('髋外展','髋外展',['绳索机','徒手'],3,15,15,60),
      X('高脚杯深蹲','膝主导',['哑铃'],4,12,24,75),X('哑铃硬拉','髋主导',['哑铃'],4,10,30,90),
      X('反向箭步蹲','单腿膝主导',['哑铃','徒手'],3,10,14,75),X('单腿臀桥','髋主导',['徒手'],3,15,0,60),
      X('史密斯深蹲','膝主导',['史密斯机'],4,8,70,90),X('坐姿腿弯举','屈膝',['腿弯举'],3,12,35,60),
      X('坐姿提踵','提踵',['哑铃'],4,15,30,60),X('平板支撑','核心',['徒手'],3,45,0,60),
      X('台阶登阶','单腿膝主导',['哑铃','徒手'],3,10,14,75)
    ]
  }
};

const BODYWEIGHT_LIBRARY = {
  push:[
    X('标准俯卧撑','水平推',['徒手'],4,12,0,60),X('上斜俯卧撑','水平推',['徒手'],3,15,0,60),X('下斜俯卧撑','水平推',['徒手'],3,10,0,75),
    X('窄距俯卧撑','肘伸',['徒手'],3,10,0,60),X('宽距俯卧撑','胸内收',['徒手'],3,12,0,60),X('钻石俯卧撑','肘伸',['徒手'],3,8,0,75),
    X('跪姿俯卧撑','水平推',['徒手'],3,15,0,60),X('派克俯卧撑','垂直推',['徒手'],3,8,0,75),X('肩部触碰','肩胛控制',['徒手'],3,16,0,45),
    X('俯卧撑停顿式','水平推',['徒手'],3,10,0,75),X('慢速俯卧撑','水平推',['徒手'],3,10,0,75),X('墙壁倒立支撑','垂直推',['徒手'],3,30,0,75),
    X('凳上臂屈伸','肘伸',['徒手'],3,12,0,60),X('平板支撑转体','核心',['徒手'],3,12,0,45),X('俯卧撑顶端前伸','肩胛控制',['徒手'],3,12,0,45)
  ],
  pull:[
    X('引体向上','垂直拉',['徒手'],4,6,0,120),X('反手引体向上','垂直拉',['徒手'],3,6,0,120),X('桌下划船','水平拉',['徒手'],4,10,0,90),
    X('毛巾划船等长','水平拉',['徒手'],3,30,0,60),X('俯卧Y举','肩胛控制',['徒手'],3,12,0,45),X('俯卧T举','肩后束',['徒手'],3,12,0,45),
    X('俯卧W举','肩后束',['徒手'],3,12,0,45),X('超人式后拉','水平拉',['徒手'],3,12,0,60),X('肩胛引体','垂直拉',['徒手'],3,10,0,75),
    X('反向雪天使','肩胛控制',['徒手'],3,15,0,45),X('门框划船','水平拉',['徒手'],3,12,0,75),X('毛巾弯举等长','肘屈',['徒手'],3,30,0,45),
    X('俯卧游泳式','肩胛控制',['徒手'],3,12,0,45),X('鸟狗式划臂','核心',['徒手'],3,12,0,45),X('反向平板支撑','肩胛控制',['徒手'],3,30,0,60)
  ],
  legs:[
    X('徒手深蹲','膝主导',['徒手'],4,15,0,60),X('单腿臀桥','髋主导',['徒手'],4,12,0,60),X('反向箭步蹲','单腿膝主导',['徒手'],3,12,0,60),
    X('保加利亚分腿蹲','单腿膝主导',['徒手'],3,10,0,75),X('臀桥','髋主导',['徒手'],4,15,0,60),X('单腿罗马尼亚硬拉','髋主导',['徒手'],3,12,0,60),
    X('靠墙静蹲','膝主导',['徒手'],3,45,0,60),X('侧向弓步','单腿膝主导',['徒手'],3,12,0,60),X('台阶登阶','单腿膝主导',['徒手'],3,12,0,60),
    X('站姿提踵','提踵',['徒手'],4,20,0,45),X('单腿提踵','提踵',['徒手'],3,15,0,45),X('俯卧腿弯举','屈膝',['徒手'],3,15,0,60),
    X('蚌式开合','髋外展',['徒手'],3,15,0,45),X('平板支撑','核心',['徒手'],3,45,0,45),X('死虫式','核心',['徒手'],3,12,0,45)
  ]
};

// V1.2 结构槽位（PRD 16.3）：每个训练日的固定肌群结构，pattern 匹配白名单动作。
// 正式动作默认约 8 个，机动位用于补弱项/器械占用/不适替换，不破坏当日主要结构。
const PPL_SLOTS = {
  push: [
    { label:'胸部', patterns:['水平推','胸内收'], n:3 },
    { label:'肩部', patterns:['垂直推','肩外展','肩后束'], n:2 },
    { label:'三头', patterns:['肘伸'], n:2 },
    { label:'机动', patterns:null, n:1 }
  ],
  pull: [
    { label:'背部垂直拉', patterns:['垂直拉','垂直拉变式'], n:2 },
    { label:'背部水平拉', patterns:['水平拉'], n:2 },
    { label:'后束 / 上背', patterns:['肩后束','肩胛控制','肩胛上提'], n:1 },
    { label:'二头', patterns:['肘屈'], n:2 },
    { label:'机动', patterns:null, n:1 }
  ],
  legs: [
    { label:'股四头主导', patterns:['膝主导','膝伸'], n:2 },
    { label:'髋主导 / 臀腿后侧', patterns:['髋主导'], n:2 },
    { label:'单侧稳定', patterns:['单腿膝主导'], n:1 },
    { label:'小腿', patterns:['提踵'], n:1 },
    { label:'核心', patterns:['核心'], n:1 },
    { label:'机动', patterns:null, n:1 }
  ]
};

const PPL_WHITELIST_VERSION = 'v1.2-whitelist-1';
const BACKUP_VERSION = 2;
const EXERCISE_CATALOG_URL = './public/data/exercise-catalog.v1.json';
const EXERCISE_INSTRUCTIONS_URL = './public/data/exercise-instructions-zh.v1.json';
const USER_DATA_KEYS = ['profile','plan','sessions','sessions_archive','body_records','measurements','today_index','today_plan','active_training','cycle_variants','core_locks','training_phase','setup_draft','exercise_preferences','exercise_catalog_version'];
const DEFAULT_CYCLE_VARIANTS = { push:'A', pull:'A', legs:'A' };
const DEFAULT_SETUP_STATE = { focus:'', state:'', time:'', env:'', discomfort:[], avoid:'' };
const DEFAULT_EXERCISE_PREFERENCES = { version:1, catalogVersion:'', paused:{}, lightChoices:{} };
let exerciseCatalog = null;
let exerciseCatalogStatus = 'idle';
let exerciseCatalogError = '';
let exerciseInstructions = null;
const openInstructionIds = new Set();

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
    const writes = [['plan',next.plan],['sessions',next.sessions],['today_plan',next.today_plan],['active_training',next.active_training]];
    if (!writes.every(([key,value]) => LS.set(key,value))) {
      Object.entries(original).forEach(([key,value]) => LS.set(key,value));
      console.warn('动作编号兼容写入失败，已恢复迁移前数据');
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

function rememberCompatibilityData(recovery) {
  const keys = Object.keys(recovery);
  if (!keys.length) return;
  const existing = LS.get('compat_recovery', null);
  if (isPlainRecord(existing) && isPlainRecord(existing.data)) {
    LS.set('compat_recovery', Object.assign({}, existing, { updatedAt:new Date().toISOString(), data:Object.assign({}, existing.data, recovery) }));
  } else {
    LS.set('compat_recovery', { savedAt:new Date().toISOString(), data:recovery });
  }
}

function normalizeTodayPlanData(value) {
  if (!isPlainRecord(value) || !Array.isArray(value.workout) || value.workout.length === 0) return null;
  const normalized = Object.assign({}, value);
  normalized.status = value.status === 'preview' ? 'preview' : 'active';
  normalized.factors = isPlainRecord(value.factors) ? value.factors : {};
  normalized.warmup = Array.isArray(value.warmup) ? value.warmup : [];
  normalized.stretch = Array.isArray(value.stretch) ? value.stretch : [];
  normalized.id = value.id || ('recovered-plan-' + Date.now());
  return normalized;
}

function ensureUserDataCompatibility() {
  const recovery = {};

  const rawProfile = LS.get('profile', null);
  profile = Object.assign({}, cloneData(DEFAULT_PROFILE), isPlainRecord(rawProfile) ? rawProfile : {});
  if (!Array.isArray(profile.equipment)) profile.equipment = cloneData(DEFAULT_PROFILE.equipment);
  if (!PLAN_TEMPLATES[profile.planTemplate]) profile.planTemplate = 'ppl';
  if (!sameData(rawProfile, profile)) {
    if (rawProfile != null && !isPlainRecord(rawProfile)) recovery.profile = rawProfile;
    LS.set('profile', profile);
  }

  const rawPlan = LS.get('plan', null);
  if (isValidPlanData(rawPlan)) {
    plan = rawPlan;
  } else {
    if (rawPlan != null) recovery.plan = rawPlan;
    const tmpl = PLAN_TEMPLATES[profile.planTemplate] || PLAN_TEMPLATES.ppl;
    plan = { name:tmpl.name, cycle:tmpl.cycle, days:cloneData(tmpl.days) };
    LS.set('plan', plan);
  }

  const rawSessions = LS.get('sessions', []);
  sessions = Array.isArray(rawSessions) ? rawSessions.filter(item => isPlainRecord(item) && Array.isArray(item.exercises)) : [];
  if (!sameData(rawSessions, sessions)) {
    if (rawSessions != null) recovery.sessions = rawSessions;
    LS.set('sessions', sessions);
  }

  const rawBodyRecords = LS.get('body_records', []);
  bodyRecords = Array.isArray(rawBodyRecords) ? rawBodyRecords : [];
  if (!Array.isArray(rawBodyRecords)) {
    if (rawBodyRecords != null) recovery.body_records = rawBodyRecords;
    LS.set('body_records', bodyRecords);
  }

  const rawMeasurements = LS.get('measurements', []);
  measurements = Array.isArray(rawMeasurements) ? rawMeasurements : [];
  if (!Array.isArray(rawMeasurements)) {
    if (rawMeasurements != null) recovery.measurements = rawMeasurements;
    LS.set('measurements', measurements);
  }

  const rawIndex = Number(LS.get('today_index', 0));
  todayIndex = Number.isInteger(rawIndex) && rawIndex >= 0 ? rawIndex : 0;
  if (todayIndex !== rawIndex) LS.set('today_index', todayIndex);

  const rawVariants = LS.get('cycle_variants', null);
  const variants = isPlainRecord(rawVariants) ? rawVariants : {};
  cycleVariants = Object.assign({}, variants, {
    push:variants.push === 'B' ? 'B' : 'A',
    pull:variants.pull === 'B' ? 'B' : 'A',
    legs:variants.legs === 'B' ? 'B' : 'A'
  });
  if (!sameData(rawVariants, cycleVariants)) {
    if (rawVariants != null && !isPlainRecord(rawVariants)) recovery.cycle_variants = rawVariants;
    LS.set('cycle_variants', cycleVariants);
  }

  const rawLocks = LS.get('core_locks', null);
  coreLocks = isPlainRecord(rawLocks) ? rawLocks : {};
  if (!sameData(rawLocks, coreLocks)) {
    if (rawLocks != null) recovery.core_locks = rawLocks;
    LS.set('core_locks', coreLocks);
  }

  const rawPhase = LS.get('training_phase', null);
  const phase = isPlainRecord(rawPhase) ? rawPhase : {};
  trainingPhase = {
    startedAt:typeof phase.startedAt === 'string' && phase.startedAt ? phase.startedAt : getTodayStr(),
    completedSessions:Number.isFinite(Number(phase.completedSessions)) && Number(phase.completedSessions) >= 0 ? Math.floor(Number(phase.completedSessions)) : 0
  };
  if (!sameData(rawPhase, trainingPhase)) {
    if (rawPhase != null && !isPlainRecord(rawPhase)) recovery.training_phase = rawPhase;
    LS.set('training_phase', trainingPhase);
  }

  const rawDraft = LS.get('setup_draft', null);
  if (rawDraft != null) {
    const draft = Object.assign({}, DEFAULT_SETUP_STATE, isPlainRecord(rawDraft) ? rawDraft : {});
    draft.discomfort = Array.isArray(draft.discomfort) ? draft.discomfort : [];
    draft.avoid = typeof draft.avoid === 'string' ? draft.avoid : '';
    if (!sameData(rawDraft, draft)) {
      if (!isPlainRecord(rawDraft)) recovery.setup_draft = rawDraft;
      LS.set('setup_draft', draft);
    }
  }

  const rawExercisePreferences = LS.get('exercise_preferences', null);
  exercisePreferences = normalizeExercisePreferences(rawExercisePreferences);
  if (!sameData(rawExercisePreferences, exercisePreferences)) {
    if (rawExercisePreferences != null && !isPlainRecord(rawExercisePreferences)) recovery.exercise_preferences = rawExercisePreferences;
    LS.set('exercise_preferences', exercisePreferences);
  }

  rememberCompatibilityData(recovery);
}
