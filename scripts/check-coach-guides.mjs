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

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS: '+name); }
const fixture = {
  warmup:[{name:'活动肩部',note:'站稳后缓慢活动肩部，做8次，保持轻松。'}],
  stretch:[{name:'放松肩部',note:'用舒适姿势放松肩部，每侧保持20秒，不强拉。'}],
  exercises:['测试动作一','测试动作二'].map(name=>({name,role:'primary',sets:1,reps:8,weight:0,rest:30,instructions:['站稳并准备。','缓慢完成动作。']})),
  summary:'测试完整安排'
};
function setup(h, result=fixture) {
  h.c.response=JSON.stringify(result);
  h.run(`getGlobalApiKey=()=> 'test-key'; aiCall=async prompt=>{capturedPrompt=prompt;return response;}; profile.coachDataConsent=true; setupSel={time:'30分钟'};`);
}
await test('生成计划包含三部分，预览与训练页都显示AI说明',async()=>{
  const h=harness();setup(h);await h.run('generateTodayPlan()');
  assert.deepEqual(h.json('todayPlan.warmup'),fixture.warmup);
  assert.deepEqual(h.json('todayPlan.stretch'),fixture.stretch);
  h.run('renderPlanPreview()');
  const preview=h.elements.get('trainingContent').innerHTML;
  assert.ok(preview.includes('训练前热身') && preview.includes('训练后拉伸'));
  assert.ok(preview.indexOf(fixture.warmup[0].name)<preview.indexOf('正式训练 ·'));
  assert.ok(preview.indexOf(fixture.stretch[0].name)>preview.indexOf('正式训练 ·'));
  h.run('startConfirmedPlan();toggleGuide("warmup",0)');
  assert.equal(h.run('trainState.section'),'warmup');
  assert.ok(h.elements.get('trainingContent').innerHTML.includes(fixture.warmup[0].note));
  const reload=harness(h.store);
  assert.deepEqual(reload.json('trainState.warmupDone'),[0]);
  reload.run('setSection("workout");completeSet();skipRest();completeSet();');
  assert.equal(reload.run('trainState.section'),'stretch');
  assert.ok(reload.elements.get('trainingContent').innerHTML.includes(fixture.stretch[0].note));
  reload.run('toggleGuide("stretch",0)');
  const again=harness(h.store);
  assert.deepEqual(again.json('trainState.stretchDone'),[0]);
  assert.equal(again.run('Object.values(trainState.records).flat().length'),2,'热身拉伸不计入正式组数');
});
await test('缺失、空白或重复的热身拉伸不能成为成功的新计划',async()=>{
  for(const key of ['warmup','stretch']) for(const bad of [undefined,[],[{name:'动作',note:' '}],[fixture[key][0],fixture[key][0]]]){
    const h=harness();setup(h,{...fixture,[key]:bad});
    const result=await h.run('adaptPlanWithAI(createLocalPlan())');
    assert.equal(result.usedAI,false);
    assert.match(result.error,new RegExp(key==='warmup'?'热身':'拉伸'));
  }
});
await test('微调请求携带既有热身拉伸，返回的新建议同步入计划',async()=>{
  const h=harness();setup(h);await h.run('generateTodayPlan()');
  const changed={...fixture,warmup:[{name:'新的热身',note:'按新的安排缓慢活动，做8次，保持轻松。'}]};
  h.c.response=JSON.stringify(changed);
  const result=await h.run('adaptPlanWithAI(todayPlan,"换个热身")');
  assert.deepEqual(JSON.parse(JSON.stringify(result.plan.warmup)),changed.warmup);
  assert.ok(h.c.capturedPrompt.includes('previousGuides'));
});
await test('旧计划补充指南保留正式动作、已完成组及已有热身勾选',async()=>{
  const h=harness();setup(h);await h.run('generateTodayPlan()');
  h.run('todayPlan.stretch=[];startConfirmedPlan();toggleGuide("warmup",0);setSection("workout");completeSet();skipRest();setSection("stretch");');
  const before=h.json('({workout:todayPlan.workout,state:trainState})');
  await h.run('supplementCoachGuides()');
  assert.deepEqual(h.json('todayPlan.workout'),before.workout);
  assert.deepEqual(h.json('trainState'),before.state);
  assert.deepEqual(h.json('todayPlan.stretch'),fixture.stretch);
  assert.deepEqual(harness(h.store).json('trainState.records'),before.state.records);
});
await test('AI失败或保存失败时保留旧计划及进度，可重试补充',async()=>{
  for(const failure of ['ai','storage']){
    const h=harness();setup(h);await h.run('generateTodayPlan()');
    h.run('todayPlan.warmup=[];todayPlan.stretch=[];startConfirmedPlan()');
    const before=h.json('({plan:todayPlan,state:trainState})');
    if(failure==='ai')h.c.response='{}';else h.c.fail=k=>k.endsWith('_today_plan');
    await h.run('supplementCoachGuides()');
    assert.deepEqual(h.json('({plan:todayPlan,state:trainState})'),before);
    h.c.response=JSON.stringify(fixture);h.c.fail=null;
    await h.run('supplementCoachGuides()');
    assert.equal(h.run('todayPlan.warmup.length'),1);
  }
});
await test('补充请求期间切换用户或结束训练不会写入过期结果',async()=>{
  for(const action of ["currentUser='another'",'todayPlan=null']){
    const h=harness();setup(h);await h.run('generateTodayPlan()');
    h.run('todayPlan.warmup=[];startConfirmedPlan();aiCall=()=>new Promise(resolve=>{resolveGuide=resolve});');
    const pending=h.run('supplementCoachGuides()');
    const before=[...h.store.entries()];
    h.run(action);h.run('resolveGuide(response)');await pending;
    assert.deepEqual([...h.store.entries()],before);
  }
});
await test('旧计划补充需确认资料发送，确认后在当前页继续',async()=>{
  const h=harness();setup(h);await h.run('generateTodayPlan()');
  h.run('todayPlan.warmup=[];startConfirmedPlan();profile.coachDataConsent=false;');
  h.c.capturedPrompt='';
  await h.run('supplementCoachGuides()');
  assert.equal(h.c.capturedPrompt,'');
  h.run('document.getElementById("coachGuidesConsent").checked=true;');
  await h.run('supplementCoachGuides()');
  assert.equal(h.run('todayPlan.warmup.length'),1);
  assert.equal(h.run('profile.coachDataConsent'),true);
});
console.log(`PASS: ${passed} 组教练热身与拉伸回归检查`);
