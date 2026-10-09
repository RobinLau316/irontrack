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
  const start = () => run("setupSel={focus:'胸',state:'精力充沛',time:'30分钟',env:'健身房',discomfort:[],discomfortText:'无',avoid:''};todayPlan=createLocalPlan();todayPlan.status='active';LS.set('today_plan',todayPlan);initDynamicTraining();trainState.records[trainState.day.exercises[0].id]=[{set:1,w:82.5,r:7}];trainState.sessionFeedback='刚刚好';trainState.advancePpl=true;persistTrainingState();");
  return {c,store,elements,run,json,start,end:()=>run('confirmFinishTraining()')};
}
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS: '+name);}

await test('保存任一字段失败：保留训练、周期不推进，应急备份包含本次记录',()=>{
  for(const field of ['write_journal','sessions','today_index','cycle_variants','training_phase','today_plan','active_training']){
    const h=harness();h.start();
    const before=h.json('({index:todayIndex,variants:cycleVariants,phase:trainingPhase})');
    h.c.fail=(k,v)=>k===`irontrack_audit_${field}` && (field!=='active_training'||v==='null');
    h.end();
    assert.equal(h.run('sessions.length'),0,field);
    assert.deepEqual(h.json('({index:todayIndex,variants:cycleVariants,phase:trainingPhase})'),before,field);
    assert.ok(h.run('todayPlan && trainState.pendingCompletion && !trainState.saved'),field);
    assert.ok(h.run("LS.get('active_training',null)"),field);
    assert.equal(h.run('buildBackupPayload().data.sessions[0].exercises[0].sets[0].w'),82.5,field);
    h.c.fail=null;h.end();h.end();
    assert.equal(h.run('sessions.length'),1,field);
    assert.equal(h.run('trainingPhase.completedSessions'),0,field);
    assert.equal(h.run('cycleVariants.push'),'A',field,'PPL不再使用A/B轮换');
    assert.equal(h.run("LS.get('active_training',null)"),null,field);
  }
});
await test('失败后刷新并重试：单条历史、一次周期推进',()=>{
  const h=harness();h.start();h.c.fail=k=>k.endsWith('_sessions');h.end();
  const reloaded=harness(h.store);assert.ok(reloaded.run('trainState.pendingCompletion'));
  reloaded.end();reloaded.end();assert.equal(reloaded.run('sessions.length'),1);assert.equal(reloaded.run('trainingPhase.completedSessions'),0);
});
await test('跨日恢复原计划、动作和已完成组',()=>{
  const h=harness();h.start();h.run("todayPlan.date='2020-01-01';LS.set('today_plan',todayPlan);initUserData();enterTraining()");
  assert.equal(h.run('todayPlan.date'),'2020-01-01');assert.equal(h.run('trainState.records[trainState.day.exercises[0].id][0].r'),7);
});
await test('历史、已有归档与身体记录均不截断',()=>{
  const h=harness();h.start();h.run("sessions=Array.from({length:650},(_,i)=>({id:'old-'+i,date:'2020-01-01',exercises:[]}));LS.set('sessions',sessions);LS.set('sessions_archive',Array.from({length:450},(_,i)=>({id:'archive-'+i,exercises:[]})));bodyRecords=Array.from({length:40},()=>({date:'1/1',weight:78}))");h.end();
  assert.equal(h.run('sessions.length'),651);assert.equal(h.run("LS.get('sessions_archive',[]).length"),450);assert.equal(h.run('bodyRecords.length'),40);
  assert.equal(h.run('buildBackupPayload().data.sessions.at(-1).id'),'old-649');
});
await test('有效 V1/V2 备份保留旧历史，API Key 不进入备份',async()=>{
  for(const version of [1,2]){
    const h=harness();h.run("setGlobalApiKey('fake-key-only-for-test')");
    await h.run(`importBackupFile({text:async()=>JSON.stringify({app:'IronTrack',version:${version},data:{profile:DEFAULT_PROFILE,plan:DEFAULT_PLAN,sessions:[{id:'old',date:'2020-01-01',exercises:[{name:'旧名称',sets:[{w:80,r:5}]}]}]}})})`);
    assert.equal(h.run('sessions[0].id'),'old');assert.ok(!h.run("JSON.stringify(buildBackupPayload()).includes('fake-key-only-for-test')"));
  }
});
await test('畸形备份写入前拒绝，原数据完全不变',async()=>{
  for(const mutation of ["p.plan.days[0].exercises=[null]","p.sessions=[{exercises:[{name:'bad',sets:null}]}]","p.profile.weight='not-a-number'","p.body_records=[null]","p.today_plan={workout:[null]}","p.active_training={planId:'missing',state:{}}"]){
    const h=harness();const before=[...h.store.entries()];
    await h.run(`importBackupFile({text:async()=>{const p=cloneData(buildBackupPayload(false).data);${mutation};return JSON.stringify({app:'IronTrack',version:2,data:p});}})`);
    assert.deepEqual([...h.store.entries()],before,mutation);
    assert.match(h.elements.get('backupMsg').textContent,/导入未完成/);
  }
});
await test('导入中途失败回滚全部用户字段，报告真实结果',async()=>{
  const h=harness();h.start();const before=h.json('buildBackupPayload(false).data');
  h.c.fail=k=>k.endsWith('_sessions');
  await h.run("importBackupFile({text:async()=>JSON.stringify({app:'IronTrack',version:2,data:{profile:{...DEFAULT_PROFILE,weight:99},plan:DEFAULT_PLAN,sessions:[]}})})");
  assert.deepEqual(h.json('buildBackupPayload(false).data'),before);
  assert.match(h.elements.get('backupMsg').textContent,/已核验恢复/);
});
await test('导入前快照可恢复，且可撤销恢复',async()=>{
  const h=harness();h.run("LS.set('sessions',[{id:'original',exercises:[]}]);initUserData()");
  await h.run("importBackupFile({text:async()=>JSON.stringify({app:'IronTrack',version:2,data:{profile:DEFAULT_PROFILE,plan:DEFAULT_PLAN,sessions:[{id:'imported',exercises:[]}]}})})");
  h.run("restoreRecoverySnapshot('pre_import_backup')");assert.equal(h.run('sessions[0].id'),'original');
  h.run("restoreRecoverySnapshot('pre_restore_backup')");assert.equal(h.run('sessions[0].id'),'imported');
});
await test('导入后初始化意外失败仍恢复原数据',async()=>{
  const h=harness();h.start();const before=h.json('buildBackupPayload(false).data');
  h.run("const originalInit=initUserData;let firstInit=true;initUserData=()=>{if(firstInit){firstInit=false;throw Error('injected init failure');}return originalInit();}");
  await h.run("importBackupFile({text:async()=>JSON.stringify({app:'IronTrack',version:2,data:{profile:DEFAULT_PROFILE,plan:DEFAULT_PLAN,sessions:[]}})})");
  assert.deepEqual(h.json('buildBackupPayload(false).data'),before);
  assert.match(h.elements.get('backupMsg').textContent,/已恢复操作前数据/);
});
await test('坏 JSON 与坏历史隔离原文，正常记录仍可统计',()=>{
  const h=harness();h.run("localStorage.setItem('irontrack_audit_measurements','{broken');LS.set('sessions',[{id:'good',date:getTodayStr(),exercises:[{name:'卧推',sets:[{w:80,r:5}]}]},{id:'bad',exercises:[{name:'bad',sets:null}]}]);initUserData();updateWeekStats()");
  assert.equal(h.run('sessions.length'),1);assert.equal(h.run('sessions[0].id'),'good');
  assert.ok(h.run("JSON.stringify(recoveryBundle()).includes('{broken')"));assert.ok(h.run("JSON.stringify(recoveryBundle()).includes('bad')"));
  const count=h.run("LS.get('compat_recovery',null).entries.length");h.run('initUserData()');assert.equal(h.run("LS.get('compat_recovery',null).entries.length"),count);
});
await test('隔离快照无法保存时不覆盖异常原文',()=>{
  const h=harness();h.run("localStorage.setItem('irontrack_audit_sessions','{broken')");h.c.fail=k=>k.endsWith('_compat_recovery');h.run('initUserData()');
  assert.equal(h.store.get('irontrack_audit_sessions'),'{broken');assert.equal(h.run('LS.blocked'),true);assert.ok(h.run('pendingRecoveryData'));
});
await test('隔离失败后结束训练仍不能覆盖原文，应急备份可重新导入',()=>{
  const h=harness();h.start();h.run("localStorage.setItem('irontrack_audit_sessions','{broken')");
  h.c.fail=k=>k.endsWith('_compat_recovery');h.run('ensureUserDataCompatibility()');h.end();
  assert.equal(h.store.get('irontrack_audit_sessions'),'{broken');
  assert.equal(h.run('checkedBackup(buildBackupPayload()).sessions.length'),1);
});
await test('写入中断后重开自动回滚；回滚失败则阻止后续覆盖',()=>{
  const h=harness();const before=h.store.get('irontrack_audit_sessions');
  h.store.set('irontrack_audit_write_journal',JSON.stringify({version:1,before:{sessions:before}}));h.store.set('irontrack_audit_sessions',JSON.stringify([{id:'partial',exercises:[]}]));
  const resumed=harness(h.store);assert.equal(resumed.store.get('irontrack_audit_sessions'),before);
  resumed.store.set('irontrack_audit_write_journal',JSON.stringify({version:1,before:{sessions:before}}));resumed.store.set('irontrack_audit_sessions','[]');
  resumed.c.fail=k=>k.endsWith('_sessions');
  // Different before value forces a real rollback write.
  resumed.store.set('irontrack_audit_write_journal',JSON.stringify({version:1,before:{sessions:'[{"id":"saved","exercises":[]}]'}}));
  assert.equal(resumed.run('LS.recover()'),false);assert.equal(resumed.run("LS.set('today_index',2)"),false);assert.equal(resumed.run("LS.get('sessions',[])[0].id"),'saved');
});
await test('次数保护仍有效，合法 0 次保持兼容',()=>{
  const h=harness();for(const v of ['', ' ', '6-8', 'abc', 1.5, -1]){h.c.input=v;assert.equal(h.run('validReps(input,8)'),8);}assert.equal(h.run('validReps(0,8)'),0);
});
await test('新用户档案逐题可恢复，旧档案不会重复问卷',()=>{
  const h=harness();assert.equal(h.run('profile.onboardingComplete'),false);
  h.run("onboardingDraft={step:2,direction:'建立规律',frequency:'3次',experience:'刚开始',limitations:''};LS.set('onboarding_draft',onboardingDraft);finishOnboarding()");
  assert.equal(h.run('profile.trainingDirection'),'建立规律');assert.equal(h.run('profile.trainingDays'),3);assert.equal(h.run('profile.onboardingComplete'),true);
  const old=harness();old.run("const legacyProfile={...DEFAULT_PROFILE,goal:'增肌'};delete legacyProfile.onboardingComplete;LS.set('profile',legacyProfile);initUserData()");assert.equal(old.run('profile.onboardingComplete'),true);
});
await test('PPL短时计划最多6个、长时最多8个，并保留旧历史',()=>{
  const h=harness();h.run("plan={name:'旧四日计划',days:[{name:'上肢',focus:'胸+背',exercises:[]},{name:'腿',focus:'腿',exercises:[]},{name:'肩',focus:'肩',exercises:[]},{name:'手臂',focus:'手臂',exercises:[]}]};todayIndex=2;sessions=[{id:'legacy-history',date:'2020-01-01',exercises:[]}];ensurePplPlan()");
  assert.equal(h.run('plan.days.length'),3);assert.equal(h.run('todayIndex'),0);assert.equal(h.run("sessions[0].id"),'legacy-history');
  for(const [time,count] of [['30分钟',6],['45分钟',8],['60分钟',8],['90分钟',8]]){h.run(`setupSel={focus:'胸',state:'状态一般',time:'${time}',env:'健身房',discomfort:[],discomfortText:'无',avoid:''}`);assert.equal(h.run('createLocalPlan().workout.length'),count,time);}
});
await test('已有用户可切换推拉腿；预览取消不推进循环，确认后按所选日衔接',()=>{
  const h=harness();h.run("todayIndex=0;sessions=[{id:'kept-history',date:'2020-01-01',exercises:[]}];LS.set('sessions',sessions);renderTrainingSetup()");
  assert.match(h.elements.get('trainingContent').innerHTML,/推日/);assert.match(h.elements.get('trainingContent').innerHTML,/拉日/);assert.match(h.elements.get('trainingContent').innerHTML,/腿日/);
  h.run("pickFocus('pull');setupSel.trainingFocus='以背部为重点';saveSetupDraft();todayPlan=createLocalPlan();LS.set('today_plan',todayPlan)");
  assert.equal(h.run('todayPlan.focusKey'),'pull');assert.equal(h.run('todayIndex'),0);
  h.run('discardTodayPlan()');assert.equal(h.run('todayIndex'),0);assert.equal(h.run("sessions[0].id"),'kept-history');assert.equal(h.run('setupSel.focusKey'),'pull');
  h.run("todayPlan=createLocalPlan();todayPlan.status='active';LS.set('today_plan',todayPlan);initDynamicTraining();trainState.records=Object.fromEntries(trainState.day.exercises.map(ex=>[ex.id,Array.from({length:ex.sets},(_,i)=>({set:i+1,w:0,r:ex.reps}))]));trainState.sessionFeedback='刚刚好';confirmFinishTraining()");
  assert.equal(h.run("focusKeyFromText(sessions[0].focusArea)"),'pull');assert.equal(h.run('todayIndex'),2,'确认拉日后下一日应为腿日');assert.equal(h.run("sessions.some(s=>s.id==='kept-history')"),true);
});
await test('训练中切换训练日先保存已确认组，失败或返回不会静默丢失',()=>{
  const h=harness();h.start();h.run('requestFocusChange()');
  assert.equal(h.run('trainState.changeFocusAfterSaving'),true);assert.equal(h.run('todayPlan.status'),'active');
  h.run('returnToWorkout()');assert.equal(h.run('trainState.changeFocusAfterSaving'),false);assert.equal(h.run('trainState.records[Object.keys(trainState.records)[0]].length'),1);
  h.run('requestFocusChange()');
  h.run("setSessionFeeling('刚刚好');choosePplAdvance(true)");h.c.fail=k=>k.endsWith('_today_index');h.run('confirmFinishTraining()');
  assert.ok(h.run('todayPlan&&trainState.pendingCompletion&&!trainState.saved'),'保存失败时仍须保留活动训练和切换意图');
  h.c.fail=null;h.run('retryFinishSave()');
  assert.equal(h.run('sessions.length'),1);assert.equal(h.run('sessions[0].exercises[0].sets[0].w'),82.5);assert.equal(h.run('todayPlan'),null);assert.equal(h.run('todayIndex'),1);
  h.run("pickFocus('legs');todayPlan=createLocalPlan()");assert.equal(h.run('todayPlan.focusKey'),'legs');assert.equal(h.run('todayIndex'),1);
});
await test('结束部分训练需选推进方式，计划值与实际值分开保存',()=>{
  const h=harness();h.start();const targetWeight=h.run('todayPlan.workout[0].weight');h.run("trainState.advancePpl=false;confirmFinishTraining()");
  const saved=h.json('sessions[0]');assert.equal(saved.progressionAdvanced,false);assert.equal(saved.exercises[0].targetWeight,targetWeight);assert.equal(saved.exercises[0].sets[0].w,82.5);assert.equal(saved.exercises[0].status,'partial');assert.ok(saved.exercises.slice(1).every(ex=>ex.status==='not_started'&&!ex.sets.length));assert.equal(h.run('todayIndex'),0);
  assert.equal(h.run('getWeekSessions().length'),0);assert.equal(h.run('getStreak()'),0);assert.equal(h.run('trainingPhase.completedSessions'),0);
  h.run('updateWeekStats()');const stats=h.elements.get('weekStats').innerHTML;assert.match(stats,/<div class="val">0<\/div><div class="lbl">完成训练/);assert.match(stats,/<div class="val">1<\/div><div class="lbl">总组数/);
});
await test('完整训练只按已确认组计数，且不伪造体重记录',()=>{
  const h=harness();assert.equal(h.run('bodyRecords.length'),0);h.run("setupSel={focus:'胸',state:'状态一般',time:'30分钟',env:'健身房',discomfort:[],discomfortText:'无',avoid:''};todayPlan=createLocalPlan();todayPlan.status='active';LS.set('today_plan',todayPlan);initDynamicTraining();trainState.records=Object.fromEntries(trainState.day.exercises.map(ex=>[ex.id,Array.from({length:ex.sets},(_,i)=>({set:i+1,w:ex.weight,r:ex.reps}))]));trainState.sessionFeedback='刚刚好';confirmFinishTraining()");
  assert.ok(h.run('sessions[0].exercises.every(ex=>ex.completed&&ex.status===\'completed\')'));assert.equal(h.run('sessions[0].exercises.reduce((n,ex)=>n+ex.sets.length,0)'),h.run('sessions[0].exercises.reduce((n,ex)=>n+ex.targetSets,0)'));assert.equal(h.run('bodyRecords.length'),0);
  assert.equal(h.run('getWeekSessions().length'),1);assert.equal(h.run('trainingPhase.completedSessions'),1);
});
await test('可选 AI 从全局安全候选动态构建重点计划，并校验记录、负荷和失败回退',async()=>{
  const h=harness(),catalog=JSON.parse(fs.readFileSync(new URL('public/data/exercise-catalog.v1.json',root),'utf8'));
  h.run(`exerciseCatalog=${JSON.stringify(catalog)};profile.aiPlanEnabled=true;profile.trainingDirection='规律训练';setupSel={focus:'胸',focusKey:'push',trainingFocus:'以胸部为重点',state:'状态一般',time:'30分钟',env:'健身房',discomfort:[],discomfortText:'无',avoid:''};todayPlan=createCatalogPlan();setGlobalApiKey('synthetic-test-key')`);
  const choices=h.json("getCatalogCandidates('push').filter(ex=>ex.primaryMuscles.some(m=>m.includes('胸'))).slice(0,3).concat(getCatalogCandidates('push').filter(ex=>!ex.primaryMuscles.some(m=>m.includes('胸'))).slice(0,1)).map(ex=>({exerciseId:ex.exerciseId,weight:ex.weight,pattern:ex.pattern,name:ex.name}))");
  assert.equal(choices.length,4,'安全候选中应有重点肌群和辅助动作');
  h.run(`sessions=[{id:'actual-chest',date:'2026-10-08',focusArea:'推',dayName:'推训练日',sessionFeedback:'刚刚好',exercises:[{exerciseId:'${choices[0].exerciseId}',name:'历史胸推',pattern:'${choices[0].pattern}',status:'completed',feedback:'轻松',sets:[{w:80,r:8}]}]}]`);
  const target=choices.map((ex,index)=>({exerciseId:ex.exerciseId,role:index<2?'primary':'auxiliary',sets:3,reps:10,weight:index===0?80:0,rest:90,reason:'按胸部重点安排',purpose:index<3?'主要或辅助刺激胸部':'补足推日整体安排'}));
  let sent='';h.c.fetch=async(url,options)=>{sent=options.body;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({exercises:target,summary:'胸部为主要训练，辅助动作照顾推日整体。'})}}]})};};
  const adapted=await h.run('adaptPlanWithAI(todayPlan)');assert.equal(adapted.usedAI,true,adapted.error);assert.equal(adapted.plan.workout.length,4);assert.equal(adapted.plan.workout.filter(ex=>ex.role==='核心').length,2);assert.ok(sent.includes('以胸部为重点'));assert.ok(sent.includes('80'));assert.ok(!sent.includes('流程用户'));
  assert.equal(adapted.plan.factors.focusKey,'push');assert.equal(h.run('todayIndex'),0,'生成或预览不推进循环');
  const invalid=target.map((item,index)=>index===0?{...item,weight:10000}:item);h.c.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({exercises:invalid,summary:'无效'})}}]})});
  const fallback=await h.run('adaptPlanWithAI(todayPlan)');assert.equal(fallback.usedAI,false);assert.ok(fallback.plan.aiFailure);assert.ok(fallback.plan.notice.includes('AI 个性化计划未生成'));
  assert.equal(h.run('dynamicSetBudget("30分钟","比较疲劳")'),12);assert.equal(h.run('dynamicSetBudget("60分钟","状态一般")'),27);
});
console.log(`PASS: ${passed} 组数据可靠性回归完成`);
