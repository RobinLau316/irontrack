import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html',root),'utf8');
const source = [...html.matchAll(/<script src="([^"]+)"/g)].map(m=>fs.readFileSync(new URL(m[1],root),'utf8')).join('\n');
function harness(existing) {
  const store = existing || new Map(), elements = new Map();
  const element = () => ({value:'',textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){},contains(){return true;}},focus(){},addEventListener(){},querySelector(){return element();},querySelectorAll(){return [];}});
  const c = {
    console:{log(){},warn(){},error(){}}, Date, navigator:{},
    setInterval:()=>1, clearInterval(){}, setTimeout(){}, clearTimeout(){}, AbortController, alert(){}, confirm:()=>true,
    addEventListener(){}, scrollTo(){},
    document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll:()=>[],querySelector:()=>element(),addEventListener(){},body:element()},
    localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){if(c.fail?.(k,v))throw Error('injected write failure');store.set(k,String(v));},removeItem(k){if(c.failRemove?.(k))throw Error('injected removal failure');store.delete(k);}}
  };
  c.window=c;
  vm.createContext(c); vm.runInContext(source,c);
  const run = code=>vm.runInContext(code,c);
  const json = code=>JSON.parse(run(`JSON.stringify(${code})`));
  run("currentUser='audit';initUserData();");
  return {c,store,elements,run,json};
}


const fixture={warmup:[{name:'活动肩部',note:'站稳后缓慢活动肩部，做8次，保持轻松。'}],stretch:[{name:'放松肩部',note:'用舒适姿势放松肩部，每侧保持20秒，不强拉。'}],exercises:['测试动作一','测试动作二'].map(name=>({name,role:'primary',sets:1,reps:8,weight:0,rest:30,reason:'从轻重量开始',instructions:['站稳并准备。','缓慢完成动作。']})),summary:'测试安排'};
function setup(h){h.c.response=JSON.stringify(fixture);h.run(`getGlobalApiKey=()=> 'test-key'; aiCall=async()=>response; profile.coachDataConsent=true;profile.onboardingComplete=true;profile.coachSummary='目标';profile.coachPhase='阶段'; setupSel={time:'30分钟'};`);}
const h=harness();setup(h);await h.run('generateTodayPlan()');
const plan=h.json('todayPlan');h.run('enterTraining()');assert.deepEqual(h.json('todayPlan'),plan,'离开后保留预览');
const reloaded=harness(h.store);reloaded.run('enterTraining()');assert.deepEqual(reloaded.json('todayPlan'),plan,'刷新后保留预览');
h.run(`sessions=[{id:'new',date:'2026-11-10',duration:60,sessionDiscomfort:'肩部紧',exercises:[{name:'测试动作一',status:'completed',sets:[{w:10,r:8}]}]},{id:'old',date:'2026-11-01',duration:60,exercises:[{name:'测试动作一',sets:[{w:8,r:10}]}]}];LS.set('sessions',sessions);renderSessionHistory();`);
assert.match(h.elements.get('sessionHistory').innerHTML,/上次 2026-11-01/);assert.match(h.elements.get('sessionHistory').innerHTML,/肩部紧/);
h.c.document.getElementById('history-w-0-0-0').value='12';h.c.document.getElementById('history-r-0-0-0').value='9';h.run(`saveHistoryCorrection('sessions',0,0)`);
assert.equal(h.run('sessions[0].exercises[0].sets[0].w'),12);assert.equal(harness(h.store).run('sessions[0].exercises[0].sets[0].r'),9);
const result=await h.run('adaptPlanWithAI(createLocalPlan())');assert.equal(result.plan.workout[0].lastActual.sets[0].w,12);
h.run(`profile.coachLastReview='上一场复盘';profile.coachLastReviewSessionId='old';trainState={reviewSessionId:'new',reviewing:true,records:{},day:{name:'测试'},saved:true};renderComplete()`);
assert.doesNotMatch(h.elements.get('trainingContent').innerHTML,/上一场复盘/);assert.match(h.elements.get('trainingContent').innerHTML,/正在结合今天/);
console.log('PASS: 预览保存、训练历史、更正持久化、计划引用和复盘隔离');
const r=harness();setup(r);
r.run(`sessions=[{id:'review-test',date:'2026-11-10',duration:60,exercises:[{name:'测试动作一',sets:[{w:10,r:8,confirmedAt:'t'}]}]}];LS.set('sessions',sessions);trainState={reviewSessionId:'review-test',records:{},day:{name:'测试'},saved:true};currentPage='training';aiCall=()=>new Promise(resolve=>{resolveReview=resolve});`);
const pending=r.run(`requestCoachReview({id:'review-test',date:'2026-11-10',exercises:[{name:'测试动作一',sets:[{w:10,r:8,confirmedAt:'t'}]}]})`);
r.run(`currentUser='other';resolveReview('{"review":"测试复盘","needsConfirmation":false}')`);await pending;
assert.equal(r.run(`LS.get('sessions',[]).length`),0,'切换用户后不得写入其他用户');
assert.equal(r.store.get('irontrack_audit_profile')?.includes('测试复盘')||false,false,'切换后不得写入复盘');
const q=harness();setup(q);
q.run(`sessions=[{id:'review-test',date:'2026-11-10',duration:60,exercises:[{name:'测试动作一',sets:[{w:10,r:8,confirmedAt:'t'}]}]}];LS.set('sessions',sessions);trainState={reviewSessionId:'review-test',records:{},day:{name:'测试'},saved:true};currentPage='training';aiCall=async()=>'{"review":"本次复盘","needsConfirmation":false}';`);
await q.run(`requestCoachReview({id:'review-test',date:'2026-11-10',exercises:[{name:'测试动作一',sets:[{w:10,r:8,confirmedAt:'t'}]}]})`);
assert.equal(q.run(`sessions[0].coachReview`),'本次复盘');assert.match(q.elements.get('trainingContent').innerHTML,/本次复盘/);
console.log('PASS: 复盘与具体训练绑定，切换用户后不串写');
const u=harness();setup(u);await u.run('generateTodayPlan()');
u.run('startConfirmedPlan();setSection("workout");completeSet()');
assert.equal(u.run('Object.values(trainState.records).flat().length'),0,'未知重量不能被自动记录为零');
u.run('confirmBodyweight();completeSet()');assert.equal(u.run('Object.values(trainState.records).flat().length'),1);
const restored=harness(u.store);assert.equal(restored.run('trainState.lastConfirmed.exerciseId'),restored.run('trainState.day.exercises[0].id'),'刷新后保留撤销目标');
restored.run('undoLastSet()');assert.equal(restored.run('Object.values(trainState.records).flat().length'),0);assert.equal(restored.run('trainState.exIdx'),0);assert.equal(restored.run('trainState.isResting'),false);
restored.run('completeSet();skipRest()');assert.equal(restored.run('trainState.weightNeedsConfirmation'),true,'新动作须分别确认重量');
console.log('PASS: 新动作重量显式确认、撤销与刷新恢复');
const legacy=harness();setup(legacy);await legacy.run('generateTodayPlan()');
legacy.run(`delete todayPlan.workout[0].lastActual; todayPlan.status='active'; LS.set('today_plan',todayPlan); initDynamicTraining(); trainState.records[trainState.day.exercises[0].id]=[{set:1,w:8,r:10,confirmedAt:'legacy'}];persistTrainingState();`);
const legacyReload=harness(legacy.store);
assert.equal(legacyReload.run('trainState.records[trainState.day.exercises[0].id][0].w'),8,'旧进行中训练可恢复');
const backup=legacyReload.json('buildBackupPayload()');
for(const version of [1,2,3]){legacyReload.c.payload={...backup,version};assert.equal(legacyReload.run('checkedBackup(payload).active_training.state.records[Object.keys(payload.data.active_training.state.records)[0]][0].w'),8);}
console.log('PASS: 旧进行中训练恢复及 V1/V2/V3 备份读取');
