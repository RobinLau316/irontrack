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
const p=harness();setup(p);p.run(`document.getElementById('phase-focus').value='动作稳定';document.getElementById('phase-next').value='下一次练上肢';document.getElementById('phase-review').value='2027-01-12';savePhaseDetails()`);
assert.deepEqual(p.json(`({focus:trainingPhase.focus,next:trainingPhase.nextStep,date:trainingPhase.reviewDate})`),{focus:'动作稳定',next:'下一次练上肢',date:'2027-01-12'});
const reload=harness(p.store);assert.equal(reload.run('trainingPhase.focus'),'动作稳定');assert.equal(reload.run('trainingPhase.completedSessions'),0,'计划不应被当作已完成');
assert.equal(p.run('dynamicPlanPromptPayload(createLocalPlan()).phaseProgress.nextStep'),'下一次练上肢');
console.log('PASS: 阶段信息明确保存、恢复并提供给教练');
const a=harness();setup(a);a.run(`sessions=[{id:'old',date:'2026-11-01',duration:20,exercises:[{name:'坐姿划船',sets:[{w:20,r:10}]}]}];LS.set('sessions',sessions);`);await a.run('generateTodayPlan()');
assert.equal(a.run("exerciseHistoryFor('测试动作一').length"),0,'不能自动关联近似名称');a.c.document.getElementById('exercise-link-0').value='坐姿划船';a.run('linkExercise(0)');
assert.equal(a.run("exerciseHistoryFor('测试动作一')[0].sets[0].w"),20);assert.equal(a.run('todayPlan.workout[0].lastActual.sets[0].w'),20);assert.equal(a.run('todayPlan.workout[0].requireWeightConfirmation'),true);assert.equal(harness(a.store).run("exerciseHistoryFor('测试动作一').length"),1);
a.run('startConfirmedPlan()');assert.equal(a.run('trainState.weightNeedsConfirmation'),true,'关联后不能自动把未知重量当作0');
console.log('PASS: 仅经确认关联旧动作，数据刷新后保留且重量需确认');
const x=harness();setup(x);x.run(`sessions=[{date:'2026-11-01',duration:10,exercises:[{name:'历史动作',sets:[{w:20,r:8}]}]}];LS.set('sessions',sessions);`);await x.run('generateTodayPlan()');x.c.document.getElementById('exercise-link-0').value='历史动作';const before=x.json('todayPlan');x.c.fail=k=>k.endsWith('_today_plan');x.run('linkExercise(0)');assert.deepEqual(x.json('todayPlan'),before);assert.equal(x.run('exerciseAliasEntries().length'),0);x.c.fail=null;x.run('linkExercise(0)');x.run('todayPlan.workout[0].weight=20;unlinkExercise(0)');assert.equal(x.run('todayPlan.workout[0].weight'),0);assert.equal(x.run('todayPlan.workout[0].lastActual'),null);
console.log('PASS: 关联失败回滚，取消关联不会保留无依据的建议重量');
assert.equal(p.run("concerningSymptoms('胸痛，还有头晕')"),true);assert.equal(p.run("concerningSymptoms('没有胸痛')"),false);assert.equal(p.run("concerningSymptoms('没有胸痛，但是头晕')"),true);
console.log('PASS: 关键症状提示检测及常见否定表达');
const d=harness();d.run(`sessions=[{date:'2026-11-10',exercises:[{name:'深蹲',sets:[{w:0,r:12,loadType:'bodyweight'}]}]},{date:'2026-11-03',exercises:[{name:'划船',sets:[{w:20,r:8}]}]}];selectedPerformanceExercise='深蹲';renderDataChart();`);assert.match(d.elements.get('dataChart').innerHTML,/徒手/);assert.match(d.elements.get('dataChart').innerHTML,/再记录一次可比较/);d.run("selectPerformanceExercise('划船')");assert.match(d.elements.get('dataChart').innerHTML,/20 kg/);
console.log('PASS: 数据页可选择动作，明确区分确认徒手与历史零重量');
const backupAlias=a.json('buildBackupPayload()');a.c.backupAlias=backupAlias;assert.equal(a.run("checkedBackup(backupAlias).profile.exerciseAliases[0].canonical"),'坐姿划船');
p.c.phaseBackup=p.json('buildBackupPayload()');assert.equal(p.run('checkedBackup(phaseBackup).training_phase.nextStep'),'下一次练上肢');
console.log('PASS: 阶段与用户确认的动作关联纳入备份并可读取');
const failPhase=harness();setup(failPhase);const priorPhase=failPhase.json('trainingPhase');failPhase.run(`document.getElementById('phase-focus').value='新重点';document.getElementById('phase-next').value='';document.getElementById('phase-review').value='';`);failPhase.c.fail=k=>k.endsWith('_training_phase');failPhase.run('savePhaseDetails()');assert.deepEqual(failPhase.json('trainingPhase'),priorPhase);assert.equal(harness(failPhase.store).run("LS.get('training_phase',{}).focus||''"),'');
console.log('PASS: 阶段资料保存失败保留原值');
const race=harness();setup(race);race.run(`aiCall=()=>new Promise(resolve=>{resolveAI=resolve})`);const waiting=race.run('generateTodayPlan()');race.run(`trainingPhase={...trainingPhase,focus:'新的阶段重点'};resolveAI(response)`);await waiting;assert.equal(race.run('todayPlan'),null);
console.log('PASS: 阶段信息变化后，旧生成结果不会覆盖');
const mode=harness();setup(mode);await mode.run('generateTodayPlan()');mode.run(`startConfirmedPlan();setSection('workout');confirmBodyweight();completeSet();skipRest();confirmBodyweight();completeSet();finishTraining()`);mode.c.document.getElementById('sessionDiscomfort').value='';await mode.run('confirmFinishTraining()');assert.equal(mode.run("sessions[0].exercises[0].sets[0].loadType"),'bodyweight');const modeReload=harness(mode.store);assert.equal(modeReload.run("sessions[0].exercises[0].sets[0].loadType"),'bodyweight');
console.log('PASS: 用户确认徒手后，实际记录及刷新保留标识');
