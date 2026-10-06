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
    setInterval:()=>1, clearInterval(){}, setTimeout(){}, clearTimeout(){}, alert(){}, confirm:()=>true,
    addEventListener(){}, scrollTo(){},
    document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll:()=>[],querySelector:()=>element(),addEventListener(){},body:element()},
    localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){if(c.fail?.(k,v))throw Error('injected write failure');store.set(k,String(v));},removeItem(k){if(c.failRemove?.(k))throw Error('injected removal failure');store.delete(k);}}
  };
  c.window=c;
  vm.createContext(c); vm.runInContext(source,c);
  const run = code=>vm.runInContext(code,c);
  const json = code=>JSON.parse(run(`JSON.stringify(${code})`));
  run("currentUser='audit';initUserData();");
  const start = () => run("setupSel={focus:'胸',state:'精力充沛',time:'30分钟',env:'健身房',discomfort:[],avoid:''};todayPlan=createLocalPlan();todayPlan.status='active';LS.set('today_plan',todayPlan);initDynamicTraining();trainState.records[trainState.day.exercises[0].id]=[{set:1,w:82.5,r:7}];persistTrainingState();");
  return {c,store,elements,run,json,start};
}
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS: '+name);}

await test('保存任一字段失败：保留训练、周期不推进，应急备份包含本次记录',()=>{
  for(const field of ['write_journal','sessions','today_index','cycle_variants','training_phase','body_records','today_plan','active_training']){
    const h=harness();h.start();
    const before=h.json('({index:todayIndex,variants:cycleVariants,phase:trainingPhase})');
    h.c.fail=(k,v)=>k===`irontrack_audit_${field}` && (field!=='active_training'||v==='null');
    h.run('finishTraining()');
    assert.equal(h.run('sessions.length'),0,field);
    assert.deepEqual(h.json('({index:todayIndex,variants:cycleVariants,phase:trainingPhase})'),before,field);
    assert.ok(h.run('todayPlan && trainState.pendingCompletion && !trainState.saved'),field);
    assert.ok(h.run("LS.get('active_training',null)"),field);
    assert.equal(h.run('buildBackupPayload().data.sessions[0].exercises[0].sets[0].w'),82.5,field);
    h.c.fail=null;h.run('finishTraining();finishTraining()');
    assert.equal(h.run('sessions.length'),1,field);
    assert.equal(h.run('trainingPhase.completedSessions'),1,field);
    assert.equal(h.run('cycleVariants.push'),'B',field);
    assert.equal(h.run("LS.get('active_training',null)"),null,field);
  }
});
await test('失败后刷新并重试：单条历史、一次周期推进',()=>{
  const h=harness();h.start();h.c.fail=k=>k.endsWith('_sessions');h.run('finishTraining()');
  const reloaded=harness(h.store);assert.ok(reloaded.run('trainState.pendingCompletion'));
  reloaded.run('finishTraining();finishTraining()');assert.equal(reloaded.run('sessions.length'),1);assert.equal(reloaded.run('trainingPhase.completedSessions'),1);
});
await test('跨日恢复原计划、动作和已完成组',()=>{
  const h=harness();h.start();h.run("todayPlan.date='2020-01-01';LS.set('today_plan',todayPlan);initUserData();enterTraining()");
  assert.equal(h.run('todayPlan.date'),'2020-01-01');assert.equal(h.run('trainState.records[trainState.day.exercises[0].id][0].r'),7);
});
await test('历史、已有归档与身体记录均不截断',()=>{
  const h=harness();h.start();h.run("sessions=Array.from({length:650},(_,i)=>({id:'old-'+i,date:'2020-01-01',exercises:[]}));LS.set('sessions',sessions);LS.set('sessions_archive',Array.from({length:450},(_,i)=>({id:'archive-'+i,exercises:[]})));bodyRecords=Array.from({length:40},()=>({date:'1/1',weight:78}));finishTraining()");
  assert.equal(h.run('sessions.length'),651);assert.equal(h.run("LS.get('sessions_archive',[]).length"),450);assert.equal(h.run('bodyRecords.length'),41);
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
  h.c.fail=k=>k.endsWith('_compat_recovery');h.run('ensureUserDataCompatibility();finishTraining()');
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
console.log(`PASS: ${passed} 组数据可靠性回归完成`);
