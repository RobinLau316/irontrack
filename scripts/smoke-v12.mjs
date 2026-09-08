import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

// 模拟浏览器全局
const LSstore = {};
const LS = {
  get: (k, d) => (k in LSstore ? LSstore[k] : d),
  set: (k, v) => { LSstore[k] = v; },
  setItem: (k, v) => { LSstore[k] = v; },
  getItem: (k) => (k in LSstore ? LSstore[k] : null),
  removeItem: (k) => { delete LSstore[k]; },
};
const makeEl = () => ({
  textContent: "", innerHTML: "", value: "", onClick: null, focus() {}, select() {},
  addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  classList: { add() {}, remove() {}, toggle() {} }, scrollIntoView() {},
});
const document = {
  getElementById: () => makeEl(),
  querySelectorAll: () => [],
  body: { classList: { add() {}, remove() {} } },
  addEventListener() {},
};
globalThis.localStorage = LS;
globalThis.window = { IronTrackExerciseEngine: null, addEventListener() {}, matchMedia: () => ({ addEventListener() {}, matches: false }) };
globalThis.document = document;
globalThis.alert = () => {};
globalThis.setTimeout = () => {};
globalThis.clearInterval = () => {};
globalThis.setInterval = () => {};

// 阻止脚本末尾自动渲染登录页（DOM 桩不完整），由测试自行调用函数。
const guardedScripts = scripts.map((s, i) =>
  i === scripts.length - 1 ? s.replace(/\nrenderLogin\(\);/, "") : s
);
const api = new Function(guardedScripts.join("\n") + `
;return {
  setSetup:(k,v)=>{ setupSel[k]=v; },
  setProfile:(p)=>{ profile = p; ensureUserDataCompatibility(); },
  setUser:(u)=>{ currentUser = u; },
  createLocalPlan:createLocalPlan,
  generateTodayPlan:generateTodayPlan,
  getSavedPlan:()=> { const v = localStorage.getItem("irontrack_test_today_plan", null); try { return v ? JSON.parse(v) : null; } catch(e){ return null; } },
};`)();

const ownProfile = {
  experience:'中级', goal:'增肌', equipment:['杠铃','哑铃','卧推架','深蹲架','绳索机','蝴蝶机','腿举机'], trainingDays:4, planTemplate:'ppl', weight:78, bodyFat:15, chest:0, waist:0, arm:0, thigh:0,
};
api.setUser('test');
api.setProfile(ownProfile);

let allOk = true;
function assert(cond, msg){ if(!cond){ console.log('  ❌ ' + msg); allOk=false; } else { console.log('  ✅ ' + msg); } }

function runDay(focusText){
  api.setSetup('focus', focusText);
  api.setSetup('state', '状态良好');
  api.setSetup('time', '30分钟');
  api.setSetup('env', '健身房');
  api.setSetup('discomfort', []);
  api.setSetup('avoid', '');
  return api.createLocalPlan();
}

// Push
let plan = runDay('推+胸+肩+三头');
let p = plan.workout.map(e=>e.pattern);
console.log('\n===== Push 推日 =====  ' + p.join(' / '));
assert(plan.workout.length===8, `Push默认8个动作，实际${plan.workout.length}`);
assert(p.filter(x=>['水平推','胸内收'].includes(x)).length>=2, `胸至少2个，实际${p.filter(x=>['水平推','胸内收'].includes(x)).length}`);
assert(p.filter(x=>['垂直推','肩外展','肩后束'].includes(x)).length>=1, `肩至少1个，实际${p.filter(x=>['垂直推','肩外展','肩后束'].includes(x)).length}`);
assert(p.includes('肘伸'), `应含三头（肘伸）`);

// Pull
plan = runDay('拉+背+二头');
p = plan.workout.map(e=>e.pattern);
console.log('\n===== Pull 拉日 =====  ' + p.join(' / '));
assert(plan.workout.length===8, `Pull默认8个动作，实际${plan.workout.length}`);
assert(p.filter(x=>['垂直拉','垂直拉变式'].includes(x)).length>=1, `应含垂直拉`);
assert(p.filter(x=>['水平拉'].includes(x)).length>=1, `应含水平拉`);
assert(p.includes('肘屈'), `应含二头（肘屈)`);

// Legs
plan = runDay('腿+股四+腘绳+臀');
p = plan.workout.map(e=>e.pattern);
console.log('\n===== Legs 腿日 =====  ' + p.join(' / '));
assert(plan.workout.length===8, `Legs默认8个动作，实际${plan.workout.length}`);
assert(p.filter(x=>['膝主导','膝伸'].includes(x)).length>=1, `应含股四主导`);
assert(p.filter(x=>['髋主导'].includes(x)).length>=1, `应含髋主导`);
assert(p.includes('核心'), `应含核心动作`);

// 家用哑铃 + 膝不适
api.setSetup('env','家用哑铃');
api.setSetup('discomfort',['膝']);
plan = api.createLocalPlan();
const bad = plan.workout.filter(e=>['膝主导','单腿膝主导','膝伸'].includes(e.pattern));
console.log('\n===== 家用哑铃 + 膝不适 =====  ' + plan.workout.map(e=>e.name).join(' / '));
assert(bad.length===0, `膝不适不应出现膝主导动作，实际 ${bad.map(e=>e.name).join(',')||'无'}`);
assert(plan.workout.length>=8, `家用哑铃+膝不适仍能生成≥8个动作，实际${plan.workout.length}`);

// generateTodayPlan：不依赖 AI、不卡住、立即生成并持久化
api.setSetup('focus', '推+胸+肩+三头');
api.setSetup('state', '状态良好');
api.setSetup('time', '30分钟');
api.setSetup('env', '健身房');
api.setSetup('discomfort', []);
api.setSetup('avoid', '');
const gp = await api.generateTodayPlan();
const saved = api.getSavedPlan();
console.log('\n===== generateTodayPlan =====  source=' + gp.source + ' 动作=' + gp.workout.length + ' 已存=' + (saved && saved.workout ? saved.workout.length : '无'));
assert(gp && gp.workout && gp.workout.length >= 8, `generateTodayPlan 应生成≥8个动作，实际${gp && gp.workout && gp.workout.length}`);
assert(gp.source === 'local', `计划来源应为 local，实际 ${gp.source}`);
assert(gp.notice && gp.notice.includes('本地规则'), `notice 应说明本地规则生成，实际 "${gp.notice}"`);
assert(saved && saved.workout && saved.workout.length >= 8, `today_plan 应持久化`);
assert(gp.workout[0].role === '核心', `首个动作应为核心（主动作稳定）`);

console.log(allOk ? '\n全部 V1.2 结构断言通过 ✅' : '\n存在未通过断言 ❌');
process.exit(allOk ? 0 : 1);