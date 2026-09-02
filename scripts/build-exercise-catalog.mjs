import crypto from "node:crypto";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, root), "utf8"));
const lock = readJson("tools/exercise-catalog/source-lock.json");
const equipmentMap = readJson("tools/exercise-catalog/equipment-map.json");
const muscleMap = readJson("tools/exercise-catalog/muscle-map.json");
const overrides = readJson("tools/exercise-catalog/curation-overrides.json");
const sourceFlag = process.argv.indexOf("--source");
const draft = process.argv.includes("--draft");
const listSelected = process.argv.includes("--list");

if (sourceFlag < 0 || !process.argv[sourceFlag + 1]) {
  throw new Error("用法：node scripts/build-exercise-catalog.mjs --source /absolute/path/to/exercises.json [--draft]");
}

const sourcePath = process.argv[sourceFlag + 1];
const sourceBytes = fs.readFileSync(sourcePath);
const sourceSha = crypto.createHash("sha256").update(sourceBytes).digest("hex");
if (sourceSha !== lock.dataSha256) throw new Error("拒绝使用未锁定版本的数据源");
const sourceRecords = JSON.parse(sourceBytes.toString("utf8"));

const equipmentPriority = {
  barbell: 30,
  dumbbell: 30,
  cable: 26,
  "body weight": 24,
  "smith machine": 18,
  kettlebell: 14,
  "ez barbell": 12,
  "olympic barbell": 12,
  "leverage machine": 10,
};

const coreNames = new Set([
  "barbell bench press",
  "barbell incline bench press",
  "barbell seated overhead press",
  "pull-up",
  "barbell bent over row",
  "barbell full squat",
  "barbell romanian deadlift",
  "barbell deadlift",
]);

const phraseTranslations = [
  ["close-grip bench press", "窄握卧推"],
  ["wide-grip bench press", "宽握卧推"],
  ["incline bench press", "上斜卧推"],
  ["decline bench press", "下斜卧推"],
  ["bench press", "卧推"],
  ["chest press", "推胸"],
  ["shoulder press", "肩推"],
  ["overhead press", "过顶推举"],
  ["military press", "军事推举"],
  ["arnold press", "阿诺德推举"],
  ["lateral raise", "侧平举"],
  ["front raise", "前平举"],
  ["rear delt raise", "后束平举"],
  ["rear delt row", "后束划船"],
  ["reverse fly", "反向飞鸟"],
  ["chest dip", "双杠臂屈伸"],
  ["bench dip", "凳上臂屈伸"],
  ["push-up", "俯卧撑"],
  ["cross-over", "夹胸"],
  ["crossover", "夹胸"],
  ["chest fly", "飞鸟"],
  ["fly", "飞鸟"],
  ["triceps pushdown", "三头下压"],
  ["pushdown", "下压"],
  ["triceps extension", "臂屈伸"],
  ["tricep extension", "臂屈伸"],
  ["skull crusher", "仰卧臂屈伸"],
  ["skullcrusher", "仰卧臂屈伸"],
  ["kickback", "后伸"],
  ["lat pulldown", "高位下拉"],
  ["lateral pulldown", "高位下拉"],
  ["pulldown", "下拉"],
  ["straight arm", "直臂"],
  ["pull-up", "引体向上"],
  ["chin-up", "反手引体向上"],
  ["bent over row", "俯身划船"],
  ["bent-over row", "俯身划船"],
  ["seated row", "坐姿划船"],
  ["incline row", "胸托划船"],
  ["high row", "高位划船"],
  ["t-bar row", "T杠划船"],
  ["row", "划船"],
  ["preacher curl", "牧师凳弯举"],
  ["concentration curl", "集中弯举"],
  ["hammer curl", "锤式弯举"],
  ["reverse curl", "反握弯举"],
  ["biceps curl", "弯举"],
  ["bicep curl", "弯举"],
  ["curl", "弯举"],
  ["front squat", "前蹲"],
  ["goblet squat", "高脚杯深蹲"],
  ["split squat", "分腿蹲"],
  ["full squat", "深蹲"],
  ["squat", "深蹲"],
  ["romanian deadlift", "罗马尼亚硬拉"],
  ["straight leg deadlift", "直腿硬拉"],
  ["stiff leg deadlift", "直腿硬拉"],
  ["deadlift", "硬拉"],
  ["good morning", "早安式"],
  ["hip thrust", "臀推"],
  ["glute bridge", "臀桥"],
  ["pull through", "拉臀"],
  ["leg press", "腿举"],
  ["leg extension", "腿屈伸"],
  ["leg curl", "腿弯举"],
  ["glute-ham raise", "臀腿挺身"],
  ["calf press", "提踵"],
  ["calf raise", "提踵"],
  ["lunge", "箭步蹲"],
  ["step-up", "台阶登阶"],
  ["sit-up", "仰卧起坐"],
  ["crunch", "卷腹"],
  ["leg raise", "举腿"],
  ["knee raise", "提膝"],
  ["dead bug", "死虫式"],
  ["bird dog", "鸟狗式"],
  ["russian twist", "俄罗斯转体"],
  ["side bend", "侧屈"],
  ["plank", "平板支撑"],
  ["shrug", "耸肩"],
  ["scapular", "肩胛"],
  ["scapula", "肩胛"],
  ["barbell", "杠铃"],
  ["dumbbell", "哑铃"],
  ["cable", "绳索"],
  ["smith", "史密斯"],
  ["kettlebell", "壶铃"],
  ["lever", "器械"],
  ["bodyweight", "徒手"],
  ["assisted", "辅助"],
  ["one arm", "单臂"],
  ["one-arm", "单臂"],
  ["one leg", "单腿"],
  ["single leg", "单腿"],
  ["single-leg", "单腿"],
  ["alternate", "交替"],
  ["reverse grip", "反握"],
  ["underhand", "反握"],
  ["wide grip", "宽握"],
  ["wide-grip", "宽握"],
  ["close grip", "窄握"],
  ["close-grip", "窄握"],
  ["incline", "上斜"],
  ["decline", "下斜"],
  ["standing", "站姿"],
  ["seated", "坐姿"],
  ["lying", "仰卧"],
  ["kneeling", "跪姿"],
  ["floor", "地板"],
  ["overhead", "过顶"],
  ["rear", "后侧"],
  ["front", "前侧"],
  ["side", "侧向"],
  ["wide", "宽距"],
  ["narrow", "窄距"],
  ["rope attachment", "绳索把手"],
  ["with rope", "绳索把手"],
  ["rope", "绳索把手"],
  ["v-bar", "V形把手"],
  ["straight back", "直背"],
  ["palm rotational", "旋转握法"],
  ["supported", "支撑式"],
];

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\((male|female)\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function equipmentFor(record) {
  return overrides.equipmentOverrides[record.id] || equipmentMap[record.equipment] || null;
}

function candidateScore(record, target) {
  const name = normalizeName(record.name);
  let score = equipmentPriority[record.equipment] || 0;
  if (overrides.forceIncludeIds.includes(record.id)) score += 1000;
  if (overrides.nameOverrides[name]) score += 120;
  const preferred = overrides.preferredTerms[target] || [];
  preferred.forEach((term, index) => {
    if (name.includes(term)) score += Math.max(8, 70 - index * 8);
  });
  score -= Math.max(0, name.split(/\s+/).length - 3) * 4;
  if (/one arm|one leg|single leg|alternate/.test(name)) score -= 5;
  if (/reverse grip|wide grip|close grip/.test(name)) score -= 2;
  return score;
}

function isCandidate(record) {
  const name = normalizeName(record.name);
  if (!overrides.targetQuotas[record.target]) return false;
  if (!equipmentFor(record)) return false;
  if (overrides.forceExcludeIds.includes(record.id)) return false;
  if (overrides.forceIncludeIds.includes(record.id)) return true;
  return !overrides.excludedNameTerms.some((term) => name.includes(term));
}

function translateName(record) {
  const normalized = normalizeName(record.name);
  if (overrides.nameOverrides[normalized]) return overrides.nameOverrides[normalized];
  let translated = normalized
    .replace(/[()]/g, " ")
    .replace(/[./]/g, " ")
    .replace(/\bwith\b/g, " ")
    .replace(/\bon\b/g, " ")
    .replace(/\bthe\b/g, " ");
  for (const [english, chinese] of phraseTranslations) {
    translated = translated.replaceAll(english, ` ${chinese} `);
  }
  return translated.replace(/[—-]/g, " ").replace(/\s+/g, "").trim();
}

function movementPattern(record) {
  const name = normalizeName(record.name);
  if (record.target === "abs") return "核心";
  if (/leg curl|glute-ham|inverse leg curl/.test(name)) return "屈膝";
  if (/bench pull-ups/.test(name)) return "水平拉";
  if (record.target === "upper back" && /row|crossover/.test(name)) return "水平拉";
  if (/bench press|chest press|push-up|chest dip/.test(name)) return "水平推";
  if (/shoulder press|overhead press|military press|arnold press/.test(name)) return "垂直推";
  if (/lateral raise/.test(name)) return "肩外展";
  if (/front raise/.test(name)) return "肩屈";
  if (/rear delt|reverse fly/.test(name)) return "肩后束";
  if (/fly|cross-over|crossover/.test(name)) return "胸内收";
  if (/pushdown|triceps extension|tricep extension|skull|kickback/.test(name)) return "肘伸";
  if (/close-grip press|bench dip/.test(name)) return "肘伸";
  if (/press/.test(name) && record.target === "delts") return "垂直推";
  if (/pull-up|chin-up|pulldown/.test(name)) return "垂直拉";
  if (/row/.test(name)) return "水平拉";
  if (/pullover|straight arm/.test(name)) return "肩伸";
  if (/curl/.test(name)) return "肘屈";
  if (/shrug|scapular|scapula/.test(name)) return "肩胛控制";
  if (/romanian deadlift|straight leg deadlift|stiff leg deadlift|deadlift|good morning|hip thrust|glute bridge|pull through/.test(name)) return "髋主导";
  if (/calf/.test(name)) return "提踵";
  if (/single leg|split squat|lunge|step-up/.test(name)) return "单腿膝主导";
  if (/squat|leg press/.test(name)) return "膝主导";
  if (/leg extension/.test(name)) return "膝伸";
  if (record.target === "abs") return "核心";
  return "待校对";
}

function familyFor(record) {
  const name = normalizeName(record.name);
  const families = [
    "bench press", "chest press", "push-up", "chest dip", "fly", "shoulder press",
    "overhead press", "military press", "arnold press", "lateral raise", "front raise",
    "rear delt", "reverse fly", "pushdown", "triceps extension", "skull", "kickback",
    "pull-up", "chin-up", "pulldown", "pullover", "row", "preacher curl", "hammer curl",
    "concentration curl", "curl", "shrug", "front squat", "goblet squat", "split squat",
    "squat", "romanian deadlift", "deadlift", "good morning", "hip thrust", "glute bridge",
    "pull through", "leg press", "leg extension", "leg curl", "lunge", "step-up", "calf",
    "plank", "crunch", "leg raise", "knee raise", "dead bug", "bird dog", "sit-up", "twist",
  ];
  return families.find((family) => name.includes(family)) || movementPattern(record);
}

function pplFor(target) {
  if (["pectorals", "delts", "triceps"].includes(target)) return ["push"];
  if (["lats", "upper back", "biceps", "traps"].includes(target)) return ["pull"];
  return ["legs"];
}

function balanceTags(pattern, target) {
  const tags = new Set([pattern]);
  if (target === "triceps") tags.add("肘伸");
  if (target === "biceps") tags.add("肘屈");
  if (target === "calves") tags.add("小腿");
  if (target === "abs") tags.add("核心");
  return [...tags];
}

function loadRegions(pattern, target) {
  const regions = new Set();
  if (["水平推", "垂直推", "肩外展", "肩屈", "肩后束", "胸内收", "垂直拉", "水平拉", "肩伸", "肩胛控制"].includes(pattern)) regions.add("肩");
  if (["肘伸", "肘屈", "水平推", "垂直拉", "水平拉"].includes(pattern)) regions.add("肘/腕");
  if (["髋主导", "水平拉"].includes(pattern)) regions.add("腰背");
  if (["髋主导", "膝主导", "单腿膝主导"].includes(pattern)) regions.add("髋");
  if (["膝主导", "单腿膝主导", "膝伸", "屈膝"].includes(pattern)) regions.add("膝");
  if (pattern === "提踵" || target === "calves") regions.add("踝");
  return [...regions];
}

function defaultsFor(pattern, isCore) {
  if (isCore) return { sets: 4, reps: 6, rest: 120 };
  if (["水平推", "垂直推", "垂直拉", "水平拉", "膝主导", "髋主导", "单腿膝主导"].includes(pattern)) {
    return { sets: 3, reps: 10, rest: 90 };
  }
  return { sets: 3, reps: 12, rest: 60 };
}

function cleanInstruction(step, equipment) {
  let text = String(step || "").trim().replace(/\s+/g, " ");
  text = text
    .replaceAll("电缆机", "绳索机")
    .replaceAll("电缆划船机", "绳索划船机")
    .replaceAll("电缆手柄", "绳索握把")
    .replaceAll("电缆附件", "绳索握把")
    .replaceAll("电缆杆", "握杆")
    .replaceAll("电缆", "绳索")
    .replaceAll("ez 杠铃", "曲杆")
    .replaceAll("EZ 杠铃", "曲杆")
    .replaceAll("臀肌提升机", "臀腿挺身器")
    .replaceAll("接合你的核心", "收紧核心")
    .replaceAll("调动核心力量", "收紧核心")
    .replaceAll("调动背部肌肉", "用背部发力")
    .replaceAll("调动臀肌和腿筋", "用臀肌和腘绳肌发力")
    .replaceAll("调动腿筋和臀肌", "用腘绳肌和臀肌发力")
    .replaceAll("启动背部肌肉", "用背部发力")
    .replaceAll("启动臀肌和腿筋", "用臀肌和腘绳肌发力")
    .replaceAll("启动腿筋和臀肌", "用腘绳肌和臀肌发力")
    .replaceAll("松开杠铃，慢慢将其", "控制杠铃缓慢")
    .replaceAll("慢慢松开杠铃回到", "控制握杆缓慢回到")
    .replaceAll("慢慢将杠铃释放回", "控制握杆缓慢回到")
    .replaceAll("天花板", "上方")
    .replaceAll("您的", "")
    .replaceAll("你的", "")
    .replaceAll("您", "")
    .replaceAll("重复所需的重复次数", "按计划完成目标次数")
    .replaceAll("重复所需次数", "按计划完成目标次数")
    .replaceAll("进行所需的重复次数", "按计划完成目标次数")
    .replaceAll("启动你的核心", "收紧核心")
    .replaceAll("启动核心", "收紧核心")
    .replaceAll("保持你的核心参与", "保持核心收紧")
    .replaceAll("挤压你的", "主动收缩")
    .replaceAll("挤压", "主动收缩");
  if (["绳索机", "高位下拉"].includes(equipment)) text = text.replaceAll("杠铃", "握把");
  return text;
}

const selected = [];
for (const [target, quota] of Object.entries(overrides.targetQuotas)) {
  const candidates = sourceRecords
    .filter((record) => record.target === target && isCandidate(record))
    .sort((a, b) => candidateScore(b, target) - candidateScore(a, target) || a.id.localeCompare(b.id));
  if (candidates.length < quota) throw new Error(`${target} 候选不足：需要 ${quota}，只有 ${candidates.length}`);
  selected.push(...candidates.slice(0, quota));
}

const currentHtml = fs.readFileSync(new URL("index.html", root), "utf8");
const librarySection = currentHtml.slice(currentHtml.indexOf("const EXERCISE_LIBRARY"), currentHtml.indexOf("const BACKUP_VERSION"));
const legacyNames = [...new Set([...librarySection.matchAll(/X\('([^']+)'/g)].map((match) => match[1]))].sort((a, b) => a.localeCompare(b, "zh-CN"));

const unresolvedNames = [];
const unresolvedPatterns = [];
const instructionWarnings = [];
const duplicateChinese = new Map();
const exercises = selected.map((record) => {
  const pattern = movementPattern(record);
  const nameZh = translateName(record);
  if (/[a-z]/i.test(nameZh)) unresolvedNames.push(`${record.id}\t${record.name}\t${nameZh}`);
  if (pattern === "待校对") unresolvedPatterns.push(`${record.id}\t${record.name}\t${record.target}`);
  const list = duplicateChinese.get(nameZh) || [];
  list.push(record.id);
  duplicateChinese.set(nameZh, list);
  const isCore = coreNames.has(normalizeName(record.name));
  return {
    exerciseId: `exds:${record.id}`,
    sourceId: record.id,
    nameZh,
    nameEn: record.name,
    aliasesZh: [],
    pplTags: pplFor(record.target),
    primaryMuscles: [muscleMap[record.target]],
    replacementMuscle: muscleMap[record.target],
    secondaryMuscles: [...new Set(record.secondary_muscles.map((muscle) => muscleMap[muscle]).filter(Boolean))],
    movementPatterns: [pattern],
    equipment: [equipmentFor(record)],
    loadRegions: loadRegions(pattern, record.target),
    roleEligibility: isCore ? ["核心", "辅助"] : ["辅助"],
    variantGroup: familyFor(record),
    substitutionGroup: `${pplFor(record.target)[0]}:${muscleMap[record.target]}`,
    balanceTags: balanceTags(pattern, record.target),
    recommendationStatus: "自动推荐",
    qualityTier: "A",
    trainingDefaults: defaultsFor(pattern, isCore),
    catalogVersion: lock.catalogVersion,
  };
});

const duplicateNameErrors = [...duplicateChinese.entries()].filter(([, ids]) => ids.length > 1).map(([name, ids]) => `${name}: ${ids.join(",")}`);
const byChineseName = new Map(exercises.map((exercise) => [exercise.nameZh, exercise.exerciseId]));
const legacyNameMap = Object.fromEntries(legacyNames.map((name) => [
  name,
  byChineseName.get(name) || `irontrack:legacy-${crypto.createHash("sha1").update(name).digest("hex").slice(0, 10)}`,
]));

const instructions = Object.fromEntries(selected.map((record) => {
  const steps = record.instruction_steps.zh
    .map((step) => cleanInstruction(step, equipmentFor(record)))
    .filter(Boolean)
    .slice(0, 6);
  if (!steps.length) instructionWarnings.push(`${record.id}\t${record.name}\t中文步骤为空`);
  steps.forEach((step, index) => {
    if (/[a-z]{2,}/i.test(step)) instructionWarnings.push(`${record.id}\t第${index + 1}步\t${step}`);
  });
  return [`exds:${record.id}`, steps];
}));

if (draft) {
  console.log(`DRAFT: selected=${exercises.length}, legacy=${legacyNames.length}`);
  console.log(`UNRESOLVED_NAMES=${unresolvedNames.length}`);
  if (unresolvedNames.length) console.log(unresolvedNames.join("\n"));
  console.log(`UNRESOLVED_PATTERNS=${unresolvedPatterns.length}`);
  if (unresolvedPatterns.length) console.log(unresolvedPatterns.join("\n"));
  console.log(`DUPLICATE_CHINESE=${duplicateNameErrors.length}`);
  if (duplicateNameErrors.length) console.log(duplicateNameErrors.join("\n"));
  console.log(`INSTRUCTION_WARNINGS=${instructionWarnings.length}`);
  if (instructionWarnings.length) console.log(instructionWarnings.join("\n"));
  if (listSelected) {
    console.log("SELECTED");
    exercises.forEach((exercise) => console.log([
      exercise.sourceId,
      exercise.pplTags[0],
      exercise.primaryMuscles[0],
      exercise.equipment[0],
      exercise.movementPatterns[0],
      exercise.nameZh,
      exercise.nameEn,
    ].join("\t")));
  }
  process.exit(0);
}

if (unresolvedNames.length || unresolvedPatterns.length || duplicateNameErrors.length || instructionWarnings.length) {
  throw new Error(`精选目录仍需校对：名称 ${unresolvedNames.length}，模式 ${unresolvedPatterns.length}，中文重名 ${duplicateNameErrors.length}，步骤 ${instructionWarnings.length}。请先运行 --draft 查看。`);
}

const catalog = {
  version: lock.catalogVersion,
  source: { repository: lock.repository, commit: lock.commit, license: "MIT" },
  generatedAt: "2026-09-02",
  exercises,
  legacyNameMap,
};

fs.mkdirSync(new URL("public/data/", root), { recursive: true });
fs.writeFileSync(new URL("public/data/exercise-catalog.v1.json", root), `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(new URL("public/data/exercise-instructions-zh.v1.json", root), `${JSON.stringify({ version: lock.catalogVersion, instructions }, null, 2)}\n`);

console.log(`PASS: 生成 ${exercises.length} 个精选动作，${Object.keys(legacyNameMap).length} 个旧名称映射`);
