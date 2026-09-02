import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const engine = require("../public/exercise-engine.js");
const fixture = JSON.parse(fs.readFileSync(new URL("fixtures/exercise-engine-scenarios.json", import.meta.url), "utf8"));
const catalog = JSON.parse(fs.readFileSync(new URL("../public/data/exercise-catalog.v1.json", import.meta.url), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (let count = 6; count <= 13; count++) {
  const slots = engine.selectRotationSlots(count, "same-seed");
  const expected = Math.max(1, Math.min(count - 1, Math.round(count * 0.35)));
  assert(slots.length === expected, `${count} 个辅助动作的轮换槽位异常`);
  assert(new Set(slots).size === slots.length && slots.every(index => index >= 0 && index < count), "轮换槽位重复或越界");
}

const filtered = engine.filterCandidates(catalog, {
  focusKey:"push",
  environment:"家用哑铃",
  availableEquipment:["哑铃"],
  discomfort:["肘/腕"],
  avoidTerms:["侧平举"],
  pausedIds:["exds:0289"]
});
assert(filtered.length > 0, "筛选后不应为空");
assert(filtered.every(item => item.pplTags.includes("push")), "PPL 筛选失效");
assert(filtered.every(item => item.equipment.some(eq => eq === "哑铃" || eq === "徒手")), "家用哑铃筛选失效");
assert(filtered.every(item => !item.loadRegions.includes("肘/腕")), "不适部位筛选失效");
assert(filtered.every(item => !item.name.includes("侧平举")), "避开动作筛选失效");
assert(filtered.every(item => item.exerciseId !== "exds:0289"), "暂停推荐筛选失效");

const scenario = fixture.push;
const previous = scenario.candidates.slice(0, 6);
const options = {
  core:scenario.core,
  candidates:scenario.candidates,
  previous,
  count:8,
  focusKey:"push",
  seed:"push:B:2026-09-02",
  recentExerciseIds:previous.map(item => item.exerciseId),
  lastUsed:Object.fromEntries(previous.map((item, index) => [item.exerciseId, index]))
};
const first = engine.buildFallbackPlan(options);
const second = engine.buildFallbackPlan(options);
assert(JSON.stringify(first) === JSON.stringify(second), "相同输入未得到稳定结果");
assert(first.workout.length === 8, "计划动作数量异常");
assert(first.workout[0].exerciseId === "core:bench" && first.workout[1].exerciseId === "core:press", "核心动作未保持");
assert(first.rotatedSlots.length === 2, "6 个辅助动作应轮换 2 个");
for (const index of first.rotatedSlots) {
  const before = previous[index];
  const after = first.workout[index + scenario.core.length];
  assert(before.replacementMuscle === after.replacementMuscle, "替换动作的主要肌群发生变化");
}
assert(first.balance.valid, `计划结构失衡：${first.balance.missing.join("、")}`);

const aiSkeleton = first.workout.map((item, index) => ({ ...item, locked:index < scenario.core.length }));
const aiItems = first.workout.map((item) => ({ exerciseId:item.exerciseId }));
const aiAllowed = scenario.core.concat(scenario.candidates);
assert(engine.validateCandidateSequence(aiItems, aiSkeleton, aiAllowed, "push").valid, "合规 AI 动作序列被拒绝");
assert(!engine.validateCandidateSequence(aiItems.map((item,index) => index===2 ? { exerciseId:"outside:1" } : item), aiSkeleton, aiAllowed, "push").valid, "范围外 AI 动作未被拒绝");
assert(!engine.validateCandidateSequence(aiItems.map((item,index) => index===3 ? aiItems[2] : item), aiSkeleton, aiAllowed, "push").valid, "重复 AI 动作未被拒绝");
assert(!engine.validateCandidateSequence(aiItems.map((item,index) => index===0 ? { exerciseId:"push:5" } : item), aiSkeleton, aiAllowed, "push").valid, "AI 改动锁定核心动作未被拒绝");

const ranked = engine.scoreCandidates(scenario.candidates, {
  seed:"rank",
  recentExerciseIds:["push:1","push:3"],
  replacementMuscle:"肱三头肌"
});
assert(ranked[0].exercise.exerciseId !== "push:1", "近期动作未被降权");

const legacy = engine.resolveLegacyExercise("杠铃卧推", catalog);
assert(legacy && legacy.exerciseId === "exds:0025", "旧动作唯一映射失败");

const legacyData = {
  plan:{ days:[{ exercises:[{ name:"杠铃卧推", sets:5, reps:5, weight:80 }] }] },
  sessions:[{ id:"old-session", duration:1234, exercises:[
    { name:"杠铃卧推", feedback:"轻松", feedbackNote:"状态好", sets:[{ w:80, r:5 }] },
    { name:"无法识别的旧动作", feedback:"合适", sets:[{ w:10, r:12 }] },
  ] }],
  today_plan:{ workout:[{ name:"杠铃卧推", sets:5, reps:5 }] },
  active_training:{ state:{ day:{ exercises:[{ name:"杠铃卧推", sets:5, reps:5 }] } }, records:{ e1:[{ w:82.5, r:5 }] } },
};
const migrated = engine.migrateLegacyData(legacyData, catalog);
assert(!legacyData.sessions[0].exercises[0].exerciseId, "迁移修改了原始数据对象");
assert(migrated.data.sessions[0].exercises[0].exerciseId === "exds:0025", "旧历史没有补充稳定编号");
assert(migrated.data.sessions[0].exercises[0].name === "杠铃卧推", "迁移覆盖了旧名称");
assert(migrated.data.sessions[0].exercises[0].sets[0].w === 80 && migrated.data.sessions[0].exercises[0].feedback === "轻松", "迁移覆盖了历史重量或反馈");
assert(!migrated.data.sessions[0].exercises[1].exerciseId, "无法识别的旧动作不应被修改");
assert(migrated.data.active_training.records.e1[0].w === 82.5, "进行中训练记录被修改");
const migratedAgain = engine.migrateLegacyData(migrated.data, catalog);
assert(migratedAgain.changes === 0 && JSON.stringify(migratedAgain.data) === JSON.stringify(migrated.data), "兼容迁移重复执行不稳定");

const fullEquipment = ["徒手","哑铃","杠铃","绳索机","史密斯机","高位下拉","腿举机","腿弯举","腿屈伸","划船机","壶铃","推胸器","推肩器","蝴蝶机","龙门架","引体架","卧推架","深蹲架"];
const corePatterns = { push:["水平推","垂直推"], pull:["水平拉","垂直拉"], legs:["膝主导","髋主导"] };
const timeCounts = { "30分钟":8, "45分钟":10, "60分钟":12, "90分钟":15 };

for (const focusKey of ["push","pull","legs"]) {
  const candidates = engine.filterCandidates(catalog, { focusKey, environment:"健身房", availableEquipment:fullEquipment });
  const core = corePatterns[focusKey].map((pattern) => candidates.find((item) => item.movementPatterns.includes(pattern)));
  assert(core.every(Boolean), `${focusKey} 核心动作场景不完整`);
  for (const [time, count] of Object.entries(timeCounts)) {
    const firstPlan = engine.buildFallbackPlan({ core, candidates, previous:[], count, focusKey, seed:`${focusKey}:${time}:A` });
    assert(firstPlan.workout.length === count, `${focusKey} ${time} 未生成 ${count} 个动作`);
    assert(firstPlan.balance.valid, `${focusKey} ${time} 结构失衡：${firstPlan.balance.missing.join("、")}`);
    const previousAuxiliary = firstPlan.workout.slice(core.length);
    const rotatedPlan = engine.buildFallbackPlan({
      core,
      candidates,
      previous:previousAuxiliary,
      count,
      focusKey,
      seed:`${focusKey}:${time}:B`,
      recentExerciseIds:previousAuxiliary.map((item) => item.exerciseId),
    });
    const expectedRotation = Math.max(1, Math.min(previousAuxiliary.length - 1, Math.round(previousAuxiliary.length * 0.35)));
    assert(rotatedPlan.rotatedSlots.length === expectedRotation, `${focusKey} ${time} 轮换比例异常`);
    assert(rotatedPlan.workout.length === count && rotatedPlan.balance.valid, `${focusKey} ${time} 轮换后计划异常`);
    for (const index of rotatedPlan.rotatedSlots) {
      const before = previousAuxiliary[index];
      const after = rotatedPlan.workout[index + core.length];
      assert(before.replacementMuscle === after.replacementMuscle, `${focusKey} ${time} 替换后肌群不一致`);
    }
  }
}

for (const [environment, allowedEquipment] of [["家用徒手",["徒手"]],["家用哑铃",["徒手","哑铃"]]]) {
  for (const focusKey of ["push","pull","legs"]) {
    const candidates = engine.filterCandidates(catalog, { focusKey, environment, availableEquipment:allowedEquipment });
    assert(candidates.length > 0, `${focusKey} ${environment} 筛选后为空`);
    assert(candidates.every((item) => item.equipment.some((eq) => allowedEquipment.includes(eq))), `${focusKey} ${environment} 混入不可用器械`);
  }
}

console.log("PASS: 动作引擎覆盖推拉腿、四种时长、三类环境、稳定轮换、同肌群替换、结构平衡和非破坏式旧数据迁移");
