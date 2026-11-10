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
async function completedFixture(){const h=harness();setup(h);h.run(`setupSel={time:'30分钟',state:'正常',todayNote:'',equipmentText:'家中哑铃'};requestCoachReview=()=>{};`);await h.run('generateTodayPlan()');h.run(`startConfirmedPlan();setSection('workout');confirmBodyweight();completeSet();skipRest();confirmBodyweight();completeSet();finishTraining()`);await h.run('confirmFinishTraining()');return h;}
function form(h,{state='正常',note='',equipment='家中哑铃',time='30分钟'}={}){h.c.document.getElementById('coachToday').value=note;h.c.document.getElementById('coachEquipment').value=equipment;h.c.document.querySelector=selector=>({value:selector.includes('quickState')?state:selector.includes('quickTime')?time:'',disabled:false});}
const h=await completedFixture();assert.equal(h.run('sessions.length'),1);assert.ok(h.run('!!getReusableSnapshot()'));assert.ok(h.run('!!profile.reusablePlan'));assert.equal(harness(h.store).run('!!getReusableSnapshot()'),true);
form(h);h.run('reusePreviousPlan()');assert.equal(h.run('todayPlan.source'),'reused-plan');assert.equal(h.run('todayPlan.status'),'preview');assert.ok(h.run('todayPlan.workout.every(ex=>!ex.weightConfirmedByUser)'));assert.equal(h.run('sessions.length'),1,'预览不应生成实际记录');
console.log('PASS: 完整计划可离线预览，记录与计划分离，刷新可恢复');
const no=harness();setup(no);no.run(`sessions=[{id:'old',date:'2026-01-01',exercises:[{name:'旧动作',sets:[{w:10,r:10}]}]}];LS.set('sessions',sessions);`);assert.equal(no.run('getReusableSnapshot()'),null,'旧记录不能被拼凑为完整计划');
const bad=await completedFixture();form(bad,{state:'有不适',note:'肩疼'});bad.run('reusePreviousPlan()');assert.equal(bad.run('todayPlan'),null);assert.match(bad.elements.get('setupMsg').textContent,/状态正常/);
form(bad,{state:''});bad.run('reusePreviousPlan()');assert.equal(bad.run('todayPlan'),null,'状态未确认不得直接复用');
bad.run(`profile={...profile,limitations:'膝盖疼',coachProfileOverrides:{limitations:'膝盖疼'}}`);assert.equal(bad.run('getReusableSnapshot()'),null,'身体限制变化后旧计划不能直接复用');
console.log('PASS: 旧记录、不适、未确认状态及限制变化时不复用');
const fail=await completedFixture();form(fail);const savedProfile=fail.json('profile');fail.c.fail=k=>k.endsWith('_today_plan');fail.run('reusePreviousPlan()');assert.equal(fail.run('todayPlan'),null);assert.deepEqual(fail.json('profile'),savedProfile);assert.match(fail.elements.get('setupMsg').textContent,/未能保存/);
console.log('PASS: 旧计划保存失败不产生训练记录或覆盖原数据');
const optional=harness();setup(optional);optional.run(`setupSel={time:'30分钟',state:'正常',todayNote:'',equipmentText:'哑铃'};requestCoachReview=()=>{};`);await optional.run('generateTodayPlan()');optional.run(`startConfirmedPlan();setSection('workout');confirmBodyweight();completeSet();skipRest();confirmBodyweight();completeSet();finishTraining()`);optional.c.fail=(k,v)=>k.endsWith('_profile')&&v.includes('reusablePlan');await optional.run('confirmFinishTraining()');assert.equal(optional.run('sessions.length'),1);assert.equal(optional.run('todayPlan'),null);assert.equal(optional.run('!!profile.reusablePlan'),false);
console.log('PASS: 可选旧计划快照写入失败时仍保存实际训练');
const reminder=harness();reminder.run(`sessions=[{id:'old',date:getTodayStr(),exercises:[]}];profile.lastBackupRequestedAt='';profile.backupReminderDismissedAt='';`);assert.equal(reminder.run('homeBackupReminder()'),true);reminder.run('dismissBackupReminder()');assert.equal(reminder.run('homeBackupReminder()'),false);
console.log('PASS: 备份提示可暂时关闭，不声称文件已保存');
const cancel=await completedFixture();form(cancel);cancel.c.confirm=()=>false;cancel.run('reusePreviousPlan()');assert.equal(cancel.run('todayPlan'),null,'用户取消确认不能生成计划');
const shape=await completedFixture();shape.run('profile.reusablePlan.plan.workout[0].reps=999');assert.equal(shape.run('getReusableSnapshot()'),null,'异常快照不可复用');
const skipped=await completedFixture();skipped.run(`sessions.unshift({id:'partial',date:getTodayStr(),exercises:[{name:'中断',status:'partial',sets:[{w:0,r:1}]}]})`);assert.equal(skipped.run('getReusableSnapshot()'),null,'后续发生未完成训练时旧快照不可直接使用');
console.log('PASS: 取消确认、异常快照和后续部分训练均不复用旧计划');
const guard=await completedFixture();form(guard);guard.run("profile.coachDataConsent=false;getGlobalApiKey=()=>'';aiCall=()=>{throw Error('不应调用AI')};reusePreviousPlan();");assert.equal(guard.run('todayPlan.source'),'reused-plan');guard.run('startConfirmedPlan()');assert.equal(guard.run('trainState.weightNeedsConfirmation'),true,'参考旧计划的0kg仍需再次确认');
const guardBackup=guard.json('buildBackupPayload()');guard.c.guardBackup=guardBackup;assert.ok(guard.run('!!checkedBackup(guardBackup).profile.reusablePlan'));
console.log('PASS: 无Key、未授权资料发送时仍可本地预览，0kg须确认，快照可备份');
const stale=await completedFixture();stale.run('profile.coachSummaryNeedsUpdate=true');assert.equal(stale.run('getReusableSnapshot()'),null,'阶段或档案待确认时不使用旧计划');
console.log('PASS: 阶段档案待确认时不复用旧计划');
const unwell=await completedFixture();form(unwell,{state:'正常',note:'今天肩膀不舒服'});unwell.run('reusePreviousPlan()');assert.equal(unwell.run('todayPlan'),null,'出现新不适不能参考旧计划');form(unwell,{state:'正常',note:'今天发烧'});unwell.run('reusePreviousPlan()');assert.equal(unwell.run('todayPlan'),null,'报告发热不能参考旧计划');
console.log('PASS: 报告不适或发热时不复用旧计划');
