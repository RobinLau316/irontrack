import fs from "node:fs";

const root = new URL("../", import.meta.url);
const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, root), "utf8"));
const catalogPath = new URL("public/data/exercise-catalog.v1.json", root);
const instructionsPath = new URL("public/data/exercise-instructions-zh.v1.json", root);
const catalog = readJson("public/data/exercise-catalog.v1.json");
const instructionBundle = readJson("public/data/exercise-instructions-zh.v1.json");
const lock = readJson("tools/exercise-catalog/source-lock.json");

const errors = [];
const requiredFields = [
  "exerciseId", "sourceId", "nameZh", "nameEn", "aliasesZh", "pplTags",
  "primaryMuscles", "replacementMuscle", "secondaryMuscles", "movementPatterns",
  "equipment", "loadRegions", "roleEligibility", "variantGroup", "substitutionGroup",
  "balanceTags", "recommendationStatus", "qualityTier", "trainingDefaults", "catalogVersion",
];
const validPpl = new Set(["push", "pull", "legs"]);
const validEquipment = new Set([
  "徒手", "哑铃", "杠铃", "绳索机", "史密斯机", "高位下拉",
  "腿举机", "腿弯举", "腿屈伸", "划船机", "壶铃", "椭圆机",
  "推胸器", "推肩器", "蝴蝶机", "龙门架", "引体架", "卧推架", "深蹲架",
]);
const ids = new Set();
const sourceIds = new Set();
const names = new Set();

if (catalog.version !== lock.catalogVersion) errors.push("动作库版本与锁定文件不一致");
if (catalog.source?.commit !== lock.commit) errors.push("动作库来源提交与锁定文件不一致");
if (instructionBundle.version !== catalog.version) errors.push("动作说明版本与目录版本不一致");
if (!Array.isArray(catalog.exercises) || catalog.exercises.length < 200 || catalog.exercises.length > 300) {
  errors.push(`正式动作数量应为 200～300，实际为 ${catalog.exercises?.length ?? "无"}`);
}

for (const exercise of catalog.exercises || []) {
  for (const field of requiredFields) {
    if (!(field in exercise)) errors.push(`${exercise.exerciseId || exercise.nameZh || "未知动作"} 缺少 ${field}`);
  }
  if (ids.has(exercise.exerciseId)) errors.push(`重复动作编号 ${exercise.exerciseId}`);
  if (sourceIds.has(exercise.sourceId)) errors.push(`重复来源编号 ${exercise.sourceId}`);
  if (names.has(exercise.nameZh)) errors.push(`重复中文名称 ${exercise.nameZh}`);
  ids.add(exercise.exerciseId);
  sourceIds.add(exercise.sourceId);
  names.add(exercise.nameZh);
  if (!exercise.exerciseId?.startsWith("exds:")) errors.push(`${exercise.nameZh} 的编号缺少来源前缀`);
  if (!exercise.nameZh || /[a-z]/i.test(exercise.nameZh)) errors.push(`${exercise.exerciseId} 的中文名称未完成校对`);
  if (!exercise.pplTags?.length || exercise.pplTags.some((tag) => !validPpl.has(tag))) errors.push(`${exercise.nameZh} 的 PPL 标签异常`);
  if (exercise.primaryMuscles?.length !== 1 || exercise.replacementMuscle !== exercise.primaryMuscles[0]) {
    errors.push(`${exercise.nameZh} 的主要肌群或替换肌群异常`);
  }
  if (exercise.equipment?.length !== 1 || !validEquipment.has(exercise.equipment[0])) errors.push(`${exercise.nameZh} 的器械未映射`);
  if (!exercise.movementPatterns?.length || exercise.movementPatterns.includes("待校对")) errors.push(`${exercise.nameZh} 的动作模式未校对`);
  if (exercise.recommendationStatus !== "自动推荐" || exercise.qualityTier !== "A") errors.push(`${exercise.nameZh} 不是合格自动推荐动作`);
  const defaults = exercise.trainingDefaults || {};
  if (![defaults.sets, defaults.reps, defaults.rest].every((value) => Number.isFinite(value) && value > 0)) {
    errors.push(`${exercise.nameZh} 的默认训练量异常`);
  }
  const steps = instructionBundle.instructions?.[exercise.exerciseId];
  if (!Array.isArray(steps) || steps.length < 4 || steps.length > 6 || steps.some((step) => !String(step).trim() || /[a-z]{2,}/i.test(step))) {
    errors.push(`${exercise.nameZh} 的中文步骤未通过检查`);
  }
}

const instructionIds = Object.keys(instructionBundle.instructions || {});
if (instructionIds.length !== ids.size || instructionIds.some((id) => !ids.has(id))) errors.push("动作说明与正式目录编号不一致");
const legacyEntries = Object.entries(catalog.legacyNameMap || {});
if (legacyEntries.length !== 91) errors.push(`旧动作映射应为 91 条，实际为 ${legacyEntries.length}`);
for (const [name, id] of legacyEntries) {
  if (!name || !(ids.has(id) || /^irontrack:legacy-[a-f0-9]{10}$/.test(id))) errors.push(`旧动作 ${name} 的映射异常`);
}

const catalogText = fs.readFileSync(catalogPath, "utf8");
const instructionsText = fs.readFileSync(instructionsPath, "utf8");
if (/"(?:image|gif_url|media_id)"\s*:/.test(`${catalogText}\n${instructionsText}`)) errors.push("正式资源包含上游媒体字段");
if (/\/images\/|\/videos\/|\.gif\b/i.test(`${catalogText}\n${instructionsText}`)) errors.push("正式资源包含媒体路径");
if (Buffer.byteLength(catalogText) > 250 * 1024) errors.push("精简目录超过 250KB 预算");
if (Buffer.byteLength(instructionsText) > 300 * 1024) errors.push("中文步骤超过 300KB 预算");

if (errors.length) {
  throw new Error(`动作库检查失败：\n${errors.slice(0, 30).join("\n")}${errors.length > 30 ? `\n另有 ${errors.length - 30} 项` : ""}`);
}

const upstreamMatches = legacyEntries.filter(([, id]) => id.startsWith("exds:")).length;
console.log(`PASS: ${catalog.exercises.length} 个精选动作，${instructionIds.length} 份中文步骤，旧动作 ${upstreamMatches} 条唯一匹配、${legacyEntries.length - upstreamMatches} 条保留自有编号`);
console.log(`PASS: 目录 ${Buffer.byteLength(catalogText)} bytes，步骤 ${Buffer.byteLength(instructionsText)} bytes，无上游媒体引用`);
