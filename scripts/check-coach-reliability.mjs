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
const f=harness();f.run(`profile={...profile,onboardingComplete:true,coachSummary:'旧摘要',coachPhase:'旧阶段',trainingDirection:'旧目标',trainingDays:3,experienceSummary:'新手',limitations:'无',coachIntakeFacts:{goal:'旧目标',daysPerWeek:3,experience:'新手',limitations:'无'}};todayPlan={id:'p1'};document.getElementById('pf-direction').value='新目标';document.getElementById('pf-days').value='4';document.getElementById('pf-experience').value='有经验';document.getElementById('pf-limitations').value='膝盖疼';saveProfile();`);
assert.deepEqual(f.json(`({goal:coachProfileContext().goal,days:coachProfileContext().daysPerWeek,experience:coachProfileContext().experience,limit:coachProfileContext().limitations,summary:coachProfileContext().knownSummary})`),{goal:'新目标',days:4,experience:'有经验',limit:'膝盖疼',summary:''});
assert.equal(f.run(`profile.coachPlanReviewId`),'p1');assert.equal(harness(f.store).run(`coachProfileContext().limitations`),'膝盖疼');
f.run(`document.getElementById('pf-limitations').value='';saveProfile()`);assert.equal(f.run(`coachProfileContext().limitations`),'','用户清空不能回退旧限制');
console.log('PASS: 最新档案优先、清空字段、旧计划提醒及刷新恢复');

const d=harness();d.run(`currentPage='training';getGlobalApiKey=()=> 'test';profile.coachDataConsent=true;aiCall=async()=>{throw Error('offline')};document.getElementById('coachAnswer').value='肩膀不舒服';saveCoachAnswer('肩膀不舒服');`);
await d.run('sendCoachIntake()');assert.equal(d.run(`LS.get('onboarding_draft',{}).answer`),'肩膀不舒服');assert.equal(d.run(`(LS.get('onboarding_draft',{}).messages||[]).length`),0);assert.match(d.elements.get('trainingContent').innerHTML,/肩膀不舒服/);
d.run(`aiCall=async()=>JSON.stringify({ready:false,summary:'有不适',question:'何时开始？',facts:{limitations:'肩膀不舒服'}});document.getElementById('coachAnswer').value='肩膀不舒服';`);await d.run('sendCoachIntake()');assert.equal(d.run(`LS.get('onboarding_draft',{}).messages.length`),1);assert.equal(d.run(`LS.get('onboarding_draft',{}).answer`),'');
console.log('PASS: 对话失败保留输入、成功重试不重复记录');

const g=harness();setup(g);g.run(`aiCall=()=>new Promise(resolve=>{resolveAI=resolve})`);const generated=g.run('generateTodayPlan()');g.run(`currentUser='other';initUserData();currentUser='audit';initUserData();resolveAI(response)`);await generated;assert.equal(g.run('todayPlan'),null);assert.equal(g.run("LS.get('today_plan',null)"),null);
console.log('PASS: 生成请求切换用户后即使切回仍不能写入');

const p=harness();setup(p);await p.run('generateTodayPlan()');const before=p.json('todayPlan');p.c.fail=k=>k.endsWith('_today_plan');await p.run(`requestPlanChange('调整')`);assert.deepEqual(p.json('todayPlan'),before);assert.deepEqual(p.json("LS.get('today_plan',null)"),before);p.run(`updatePreviewField(0,'weight',25)`);assert.deepEqual(p.json('todayPlan'),before);p.c.fail=null;
console.log('PASS: AI调整与手动修改保存失败均保留原计划');

const n=harness();setup(n);await n.run('generateTodayPlan()');n.run(`aiCall=()=>new Promise(resolve=>{pendingResolvers.push(resolve)});pendingResolvers=[];`);const first=n.run(`requestPlanChange('第一条',true)`);const second=n.run(`requestPlanChange('第二条',true)`);n.run('pendingResolvers[1](response)');await second;n.run('pendingResolvers[0](response)');await first;assert.equal(n.run('todayPlan.userRequest'),'第二条');
console.log('PASS: 旧请求不能覆盖较新的计划调整');

const c=harness();setup(c);await c.run('generateTodayPlan()');c.run(`aiCall=()=>new Promise(resolve=>{resolveAI=resolve});`);const change=c.run(`requestPlanChange('调整')`);c.run(`startConfirmedPlan();resolveAI(response)`);await change;assert.equal(c.run('todayPlan.status'),'active');assert.ok(c.run("LS.get('active_training',null)"));
console.log('PASS: 训练开始后过期结果不能覆盖进度');

const i=harness();i.run(`currentPage='training';getGlobalApiKey=()=> 'test';profile.coachDataConsent=true;document.getElementById('coachAnswer').value='我的目标';saveCoachAnswer('我的目标');aiCall=()=>new Promise(resolve=>{resolveAI=resolve});`);const intake=i.run('sendCoachIntake()');i.run(`currentUser='other';initUserData();currentUser='audit';initUserData();resolveAI(JSON.stringify({ready:true,summary:'旧请求'}));`);await intake;assert.equal(i.run(`LS.get('onboarding_draft',{}).answer`),'我的目标');assert.equal(i.run(`LS.get('onboarding_draft',{}).summary||''`),'');
console.log('PASS: 对话请求切换用户后不串写且草稿保留');
const st=harness();st.run(`currentPage='training';getGlobalApiKey=()=> 'test';profile.coachDataConsent=true;LS.set('onboarding_draft',{mode:'review',summary:'已确认',messages:[]});aiCall=()=>new Promise(resolve=>{resolveAI=resolve});`);
const stage=st.run('confirmCoachUnderstanding()');st.run(`currentUser='other';initUserData();currentUser='audit';initUserData();renderOnboarding();resolveAI('过期阶段计划');`);await stage;
assert.equal(st.run("LS.get('onboarding_draft',{}).mode"),'review');assert.match(st.elements.get('trainingContent').innerHTML,/重新确认/);
console.log('PASS: 阶段计划请求中断后可重新确认，不会卡在加载状态');
const edit=harness();edit.run(`currentPage='training';getGlobalApiKey=()=> 'test';profile.coachDataConsent=true;LS.set('onboarding_draft',{mode:'phase',summary:'目标',phase:'原计划',messages:[]});document.getElementById('coachPhaseEdit').value='缩短时间';aiCall=async()=>{throw Error('offline')};`);
await edit.run('acceptCoachPhase()');assert.equal(edit.run("LS.get('onboarding_draft',{}).phaseEdit"),'缩短时间');assert.match(edit.elements.get('trainingContent').innerHTML,/缩短时间/);
console.log('PASS: 阶段调整失败保留用户意见');
