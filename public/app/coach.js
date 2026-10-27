// IronTrack 教练流程：直接围绕用户目标、真实训练记录和当天状态工作。
let coachBusy = false;

function coachRecentSessions(limit = 8) {
  return (sessions || []).slice(0, limit).map(session => ({
    date:session.date, duration:session.duration || 0, feedback:session.sessionFeedback || '', discomfort:session.sessionDiscomfort || '',
    exercises:(session.exercises || []).map(ex => ({
      name:ex.name, status:ex.status || '', feedback:ex.feedback || '',
      sets:(ex.sets || []).map(set => ({weight:Number(set.w)||0,reps:Number(set.r)||0}))
    })).filter(ex => ex.sets.length)
  }));
}

function coachProfileContext() {
  const hasPriorHistory=!!profile.onboardingComplete || (sessions||[]).length>0;
  const facts=profile.coachIntakeFacts||{};
  return {
    knownSummary:profile.coachSummary || '', phase:profile.coachPhase || '',
    goal:facts.goal||profile.coachSummary||(hasPriorHistory?(profile.trainingDirection || profile.goal || ''):''), daysPerWeek:facts.daysPerWeek|| (hasPriorHistory?profile.trainingDays:null),
    experience:facts.experience|| (hasPriorHistory?(profile.experienceSummary || profile.experience || ''):''), limitations:facts.limitations|| (hasPriorHistory?(profile.limitations || ''):''),
    equipment:facts.equipment|| (hasPriorHistory?(profile.equipment || []):[]), notes:profile.trainingNotes || [],
    body:{age:facts.age||profile.age||null,height:profile.coachBodyConfirmed?profile.height:null,weight:profile.coachBodyConfirmed?profile.weight:null}
  };
}

function saveCoachDraft(draft) {
  if (!LS.set('onboarding_draft', draft)) throw new Error('保存失败，请检查本机存储空间');
}

function enterTraining() {
  if (!currentUser) return;
  if (todayPlan?.status === 'active') { renderTrainingPage(); return; }
  if (todayPlan?.status === 'preview') { todayPlan = null; LS.set('today_plan', null); }
  if (!profile.onboardingComplete || !profile.coachSummary || !profile.coachPhase) { renderOnboarding(); return; }
  renderTrainingSetup();
}

function ensurePplPlan() { /* 训练安排由教练生成；保留旧计划数据供历史兼容。 */ }

function renderOnboarding(message = '') {
  setTrainingFixedAction(false);
  const draft = LS.get('onboarding_draft', {mode:'intro',messages:[],summary:'',question:''});
  const messages = Array.isArray(draft.messages) ? draft.messages : [];
  const transcript = messages.map(row => `<div class="coach-message ${row.role==='user'?'user':'assistant'}"><strong>${row.role==='user'?'你':'教练'}</strong><div>${escapeHtml(row.content)}</div></div>`).join('');
  let action = '';
  if (draft.mode === 'review') {
    action = `<div class="card coach-review"><div class="section-title">教练目前对你的了解</div><p>${escapeHtml(draft.summary)}</p><label class="setup-label" for="coachCorrection">需要补充或纠正吗？</label><textarea id="coachCorrection" class="setup-input" rows="2" maxlength="600" placeholder="可直接修改；没有需要改的就确认"></textarea><button class="btn btn-accent mt-3" onclick="confirmCoachUnderstanding()">确认，制定阶段安排</button></div>`;
  } else if (draft.mode === 'phase') {
    action = `<div class="card coach-review"><div class="section-title">第一阶段训练安排</div><p>${escapeHtml(draft.phase || '正在请教练制定安排…')}</p>${draft.phase?`<label class="setup-label" for="coachPhaseEdit">想微调哪里？（选填）</label><textarea id="coachPhaseEdit" class="setup-input" rows="2" maxlength="500" placeholder="例如：每次训练希望控制在45分钟"></textarea><button class="btn btn-accent mt-3" onclick="acceptCoachPhase()">确认安排，开始训练</button>`:''}</div>`;
  } else {
    const prompt = draft.question || (profile.coachSummary ? `我已掌握你的一些资料和 ${sessions.length} 条训练记录。最近最希望训练帮你实现什么？` : '我会像私人教练一样，根据你的目标和实际训练持续带你练。你为什么想开始训练？最希望自己发生什么改变？按自己的话说就好。');
    action = `<div class="card coach-review"><div class="setup-title">${escapeHtml(prompt)}</div><div class="setup-subtitle">不用健身术语。我会根据你说的内容继续了解，每次只问一个重点。</div><textarea id="coachAnswer" class="setup-input onboarding-answer" rows="3" maxlength="1000" oninput="saveCoachAnswer(this.value)" placeholder="写下你的想法，也可以说目前还不确定">${escapeHtml(draft.answer||'')}</textarea>${!profile.coachDataConsent?'<label class="data-consent"><input id="coachDataConsent" type="checkbox"> 我知道训练档案、身体限制和近期训练记录会发送给 DeepSeek，用于教练对话和计划；我的姓名不会发送。</label>':''}<button class="btn btn-accent mt-3" onclick="sendCoachIntake()">发送给教练</button></div>`;
  }
  document.getElementById('trainingContent').innerHTML = `<div class="training-header"><span class="text-accent font-bold">认识你的教练</span><span class="text-muted text-sm">首次设置</span></div>${transcript}${message?`<div class="reason-note">${escapeHtml(message)}</div>`:''}${action}<div id="coachStatus" class="text-center text-muted text-sm mt-3"></div>${!getGlobalApiKey()?'<div class="danger-note">教练需要 AI 才能了解你并制定计划。请先到“我的”设置 DeepSeek API Key。</div><button class="btn btn-outline mt-3" onclick="navigate(\'profile\')">去设置 API Key</button>':''}</div>`;
}

async function sendCoachIntake() {
  if (coachBusy) return;
  const answer = (document.getElementById('coachAnswer')?.value || '').trim();
  if (!getGlobalApiKey()) {const status=document.getElementById('coachStatus');if(status)status.textContent='你的回答已保存在本机。请先到“我的”设置 DeepSeek API Key，再发送给教练。';return;}
  if (!answer) return;
  if(!profile.coachDataConsent){if(!document.getElementById('coachDataConsent')?.checked){renderOnboarding('请先确认训练信息将发送给 DeepSeek，再继续。');return;}const next={...profile,coachDataConsent:true};if(!LS.set('profile',next)){renderOnboarding('无法保存设置，请重试。');return;}profile=next;}
  const draft = LS.get('onboarding_draft', {mode:'intro',messages:[],summary:'',question:''});
  draft.messages = [...(draft.messages||[]), {role:'user',content:answer}];
  draft.answer='';
  saveCoachDraft(draft);
  coachBusy = true; renderOnboarding();
  const status = document.getElementById('coachStatus'); if(status)status.textContent='教练正在整理你的情况…';
  const prompt = `你是 IronTrack 的专业私人健身教练。通过自然对话了解用户，逐步弄清目标、训练基础、每周可用时间、训练场地/器械、身体限制和偏好；年龄等个人特征仅在确实影响安排时询问。已知信息不得重复问；每轮只提出一个最重要的补充问题。结合下方现有档案和真实训练记录。只有目标、经验、训练可行性、重要限制已足够明确时才 ready=true；否则先追问。禁止推断未提供的事实。facts 只填写用户明确表达或档案已确认的内容，未知用空字符串/null/空数组。返回 JSON：{"ready":false,"summary":"基于已确认事实的简短理解，未知处标待了解","question":"一个自然的后续问题","facts":{"goal":"","daysPerWeek":null,"experience":"","limitations":"","equipment":[],"age":null}}。ready=true时question留空。\n档案：${JSON.stringify(coachProfileContext())}\n最近真实训练：${JSON.stringify(coachRecentSessions())}\n对话：${JSON.stringify(draft.messages)}`;
  try {
    const raw=await aiCall(prompt,true); if(!raw)throw new Error('AI 暂不可用');
    const result=safeParseAIJson(raw);
    draft.summary=String(result.summary||'').slice(0,1800);
    draft.facts=isPlainRecord(result.facts)?result.facts:(draft.facts||{});
    if(result.ready===true){draft.mode='review';draft.question='';}
    else {draft.mode='intro';draft.question=String(result.question||'还有什么训练条件需要我了解？').slice(0,300);}
    saveCoachDraft(draft);
  } catch(e) { draft.messages.pop(); saveCoachDraft(draft); renderOnboarding(`这次没有发送成功：${String(e.message||'连接失败')}。你的内容已保留，请重试。`); return; }
  finally { coachBusy=false; }
  renderOnboarding();
}

function saveCoachAnswer(value) {
  const draft=LS.get('onboarding_draft',{mode:'intro',messages:[],summary:'',question:''});
  draft.answer=String(value||'').slice(0,1000);
  LS.set('onboarding_draft',draft);
}

async function confirmCoachUnderstanding() {
  const correction=(document.getElementById('coachCorrection')?.value||'').trim();
  const draft=LS.get('onboarding_draft',{});
  if(correction){draft.messages=[...(draft.messages||[]),{role:'user',content:`请修正教练理解：${correction}`}];draft.mode='intro';draft.question='我会根据这条修正重新核对。还有其他需要补充的吗？';saveCoachDraft(draft);renderOnboarding();return;}
  draft.mode='phase';draft.phase='';saveCoachDraft(draft);renderOnboarding();coachBusy=true;
  const status=document.getElementById('coachStatus');if(status)status.textContent='教练正在制定第一阶段安排…';
  try {
    const prompt=`你是用户的专业私人健身教练。请根据已由用户确认的需求、身体限制、训练经历和实际历史记录，提出可执行的第一阶段训练规划。用通俗中文，交代阶段目标、每周大致安排、训练重点、如何判断进步、何时复盘；信息不足时明确写待了解，保持保守，不诊断疾病。输出一段不超过600字的自然中文，不用JSON。\n用户确认的理解：${draft.summary}\n档案：${JSON.stringify(coachProfileContext())}\n近期实际训练：${JSON.stringify(coachRecentSessions())}`;
    const raw=await aiCall(prompt,true);if(!raw)throw new Error('AI 暂不可用');
    draft.phase=String(raw).trim().replace(/^```[\s\S]*?\n|```$/g,'').slice(0,1800);saveCoachDraft(draft);renderOnboarding();
  } catch(e) { draft.mode='review';saveCoachDraft(draft);renderOnboarding(`阶段安排生成失败：${String(e.message||'连接失败')}。请重试。`); }
  finally { coachBusy=false; }
}

async function acceptCoachPhase() {
  const edit=(document.getElementById('coachPhaseEdit')?.value||'').trim();
  const draft=LS.get('onboarding_draft',{});
  if(edit){draft.messages=[...(draft.messages||[]),{role:'user',content:`请按我的意见微调阶段安排：${edit}`}];draft.mode='phase';saveCoachDraft(draft);renderOnboarding();
    try{const raw=await aiCall(`请根据用户确认的个人理解和阶段安排，按补充意见做小幅修改，保留其他已确认内容，使用通俗中文，不超过600字。\n了解：${draft.summary}\n原安排：${draft.phase}\n意见：${edit}`,true);if(!raw)throw new Error('AI 暂不可用');draft.phase=String(raw).trim().slice(0,1800);saveCoachDraft(draft);}catch(e){renderOnboarding(`微调失败，原安排已保留：${String(e.message||'连接失败')}`);return;}}
  const facts=draft.facts||{};
  const next={...profile,coachSummary:draft.summary,coachPhase:draft.phase,coachMessages:draft.messages||[],coachIntakeFacts:facts,onboardingComplete:true,aiPlanEnabled:true};
  if(facts.goal)next.trainingDirection=String(facts.goal).slice(0,500);
  if(Number.isInteger(Number(facts.daysPerWeek))&&Number(facts.daysPerWeek)>=1&&Number(facts.daysPerWeek)<=7)next.trainingDays=Number(facts.daysPerWeek);
  if(facts.experience)next.experienceSummary=String(facts.experience).slice(0,500);
  if(facts.limitations)next.limitations=String(facts.limitations).slice(0,500);
  if(Array.isArray(facts.equipment)&&facts.equipment.length)next.equipment=facts.equipment.map(x=>String(x).slice(0,80)).slice(0,30);
  if(facts.age&&Number(facts.age)>=13&&Number(facts.age)<=110)next.age=Number(facts.age);
  if(!LS.transaction({profile:next,onboarding_draft:{mode:'intro',messages:[],summary:'',question:''}})){renderOnboarding('保存失败，确认内容仍保留，请重试。');return;}
  profile=next;todayPlan=null;navigate('home');
}

function renderTrainingSetup(notice='') {
  setTrainingFixedAction(false);
  setupSel=Object.assign(cloneData(DEFAULT_SETUP_STATE),LS.get('setup_draft',{}));
  const target=document.getElementById('trainingContent');
  target.innerHTML=`<div class="training-header"><span class="text-accent font-bold">今天的训练</span><span class="text-muted text-sm">教练带练</span></div>
    ${notice?`<div class="resume-banner">${escapeHtml(notice)}</div>`:''}
    <div class="coach-message assistant"><strong>教练</strong><div>我会根据你的阶段安排和最近的真实训练记录来设计今天的训练。你告诉我今天能练多久、状态如何；如有特别想练的内容或不适，也可以一起说。</div></div>
    <div class="card coach-review"><label class="setup-label" for="coachToday">今天的情况</label><textarea id="coachToday" class="setup-input" rows="4" maxlength="700" placeholder="例如：40分钟，状态还好，右肩有点不舒服；今天想练上肢">${escapeHtml(setupSel.todayNote||'')}</textarea>
    <label class="setup-label mt-3" for="coachEquipment">今天能用的器械（可修改）</label><input id="coachEquipment" class="setup-input" maxlength="300" value="${escapeHtml(setupSel.equipmentText||(profile.coachIntakeFacts?(profile.coachIntakeFacts.equipment||[]).join('、'):((profile.coachSummary||sessions.length)?(profile.equipment||[]).join('、'):'')))}" placeholder="例如：健身房常用器械 / 家里只有一对哑铃">
    ${!profile.coachDataConsent?'<label class="data-consent"><input id="coachDataConsent" type="checkbox"> 我知道训练档案、身体限制和近期训练记录会发送给 DeepSeek，用于生成计划和训练复盘；我的姓名不会发送。</label>':''}
    <div class="danger-note mt-3">如果有明显疼痛或异常症状，先停止相关训练；教练不会通过程序诊断伤病。</div>
    <button class="btn btn-accent mt-3" onclick="confirmSetup()">请教练安排今天训练</button><div id="setupMsg" class="text-center text-muted text-sm mt-3"></div></div>`;
}

function createLocalPlan() {
  const note=setupSel.todayNote||'';
  const focus=note.match(/胸|背|腿|肩|手臂|上肢|下肢|全身/)?.[0]||'综合训练';
  return {id:'coach-'+Date.now(),date:getTodayStr(),status:'preview',source:'coach-ai',focus,focusKey:focusKeyFromText(focus),factors:{time:setupSel.time||'45分钟',state:setupSel.state||'状态一般',discomfortText:note},warmup:[],workout:[],stretch:[],notice:'教练根据阶段目标和训练记录拟定，确认后逐组带练。'};
}

function dynamicPlanPromptPayload(base, requestText='') {
  const knownEquipment=profile.coachIntakeFacts?(profile.coachIntakeFacts.equipment||[]):(profile.equipment||[]);
  return {profile:coachProfileContext(),recentRealSessions:coachRecentSessions(),today:{note:setupSel.todayNote||'',equipment:setupSel.equipmentText||knownEquipment.join('、'),minutes:setupSel.time||'45分钟',state:setupSel.state||'状态一般'},phaseProgress:{completedSessions:trainingPhase?.completedSessions||0,startedAt:trainingPhase?.startedAt||''},previousGuides:{warmup:base.warmup||[],stretch:base.stretch||[]},previousPlan:(base.workout||[]).map(ex=>({name:ex.name,sets:ex.sets,reps:ex.reps,weight:ex.weight})),userRequest:requestText};
}

function validateDynamicAIPlan(items, base, candidates) {
  if(!Array.isArray(items)||items.length<2||items.length>8)throw new Error('计划动作数量不合理');
  const names=new Set();
  const workout=items.map(item=>{
    const name=String(item?.name||'').trim();
    if(name.length<2||name.length>50)throw new Error('计划包含无法识别的动作名称');
    const normalized=name.toLowerCase().replace(/[\s·（）()\-]/g,'');
    if(names.has(normalized))throw new Error('计划包含重复动作');names.add(normalized);
    const sets=Number(item.sets),reps=Number(item.reps),weight=Number(item.weight),rest=Number(item.rest);
    if(!Number.isInteger(sets)||sets<1||sets>5||!Number.isInteger(reps)||reps<1||reps>30||!Number.isFinite(weight)||weight<0||weight>1000||!Number.isInteger(rest)||rest<20||rest>300)throw new Error('训练数字超出合理校验范围');
    const exact=(sessions||[]).flatMap(s=>(s.exercises||[]).filter(ex=>String(ex.name||'').toLowerCase()===name.toLowerCase()).flatMap(ex=>ex.sets||[]));
    const previous=exact.length?{weight:Math.max(...exact.map(x=>Number(x.w)||0)),reps:exact.at(-1)?.r}:null;
    if(!previous&&weight!==0)throw new Error(`“${name}”没有可核验的实际重量，建议重量应留空`);
    if(previous&&weight>previous.weight*1.15+2.5)throw new Error(`“${name}”建议重量高于近期实际记录的校验范围`);
    const instructions=Array.isArray(item.instructions)?item.instructions.map(x=>String(x).slice(0,180)).slice(0,6):String(item.instructions||'').split(/[。；\n]/).filter(Boolean).slice(0,6).map(x=>x.slice(0,180));
    if(instructions.length<2)throw new Error(`“${name}”缺少清楚的动作教学`);
    return {id:'coach-ex-'+Math.random().toString(36).slice(2,10),name,role:item.role==='primary'?'核心':'辅助',sets,reps,weight,rest,purpose:String(item.purpose||'').slice(0,180),reason:String(item.reason||'').slice(0,180),instructions,pattern:'综合'};
  });
  const budget=Math.min(30,Math.floor((Number(String(setupSel.time||'45').match(/\d+/)?.[0])||45)*0.55));
  if(workout.reduce((sum,ex)=>sum+ex.sets,0)>budget)throw new Error('总训练组数超出今天可用时间');
  return workout;
}

// 热身和拉伸使用训练页已有的 name/note 结构，缺失时不冒充完整计划。
function validateCoachGuides(items, label) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 6) throw new Error(`缺少完整的${label}安排，请重试`);
  const names = new Set();
  return items.map(item => {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const note = typeof item?.note === 'string' ? item.note.trim() : '';
    if (name.length < 2 || name.length > 60 || note.length < 8 || note.length > 600) throw new Error(`${label}需包含动作名称、做法及次数或时长`);
    const key = name.toLowerCase().replace(/[\s·（）()\-]/g, '');
    if (names.has(key)) throw new Error(`${label}包含重复动作`);
    names.add(key);
    return {name, note};
  });
}

function renderCoachGuidePreview(items, title) {
  if (!Array.isArray(items) || !items.length) return `<div class="card mt-3"><div class="section-title">${title}</div><div class="text-muted">这份计划尚未包含${title}安排。</div></div>`;
  return `<div class="card mt-3"><div class="section-title">${title}</div><div class="guide-list">${items.map(item => `<div><div class="guide-info"><div class="guide-name">${escapeHtml(item.name)}</div><div class="guide-note">${escapeHtml(item.note)}</div></div></div>`).join('')}</div></div>`;
}

let coachGuidesBusy = false;
function missingCoachGuidesAction() {
  return `${!profile.coachDataConsent?'<label class="data-consent"><input id="coachGuidesConsent" type="checkbox"> 我知道训练档案、身体限制和当前计划会发送给 DeepSeek，用于补充热身和拉伸。</label>':''}<button class="btn btn-outline mt-3" onclick="supplementCoachGuides()" ${coachGuidesBusy?'disabled':''}>${coachGuidesBusy?'教练正在补充…':'请教练补充热身和拉伸'}</button><div id="coachGuidesMsg" class="text-sm text-muted mt-2" role="status"></div>`;
}

async function supplementCoachGuides() {
  if (coachGuidesBusy || !todayPlan) return;
  const showMessage = text => { const el = document.getElementById('coachGuidesMsg'); if (el) el.textContent = text; };
  if (!getGlobalApiKey()) { showMessage('请先到“我的”设置 DeepSeek API Key，再补充安排。'); return; }
  if (!profile.coachDataConsent) {
    if (!document.getElementById('coachGuidesConsent')?.checked) { showMessage('请先确认向 DeepSeek 发送训练资料，再补充安排。'); return; }
    const nextProfile = {...profile, coachDataConsent:true};
    if (!LS.set('profile', nextProfile)) { showMessage('设置保存失败，请重试。'); return; }
    profile = nextProfile;
  }
  const base = todayPlan, user = currentUser;
  const missingWarmup = !base.warmup?.length, missingStretch = !base.stretch?.length;
  if (!missingWarmup && !missingStretch) return;
  coachGuidesBusy = true; renderTrainingPage();
  try {
    const prompt = `你是用户的私人健身教练。只为这份既有训练补充热身和训练后拉伸，不改动正式动作。根据个人限制、器械、正式动作和可用时间，各安排1至6项易理解的动作。每项note用通俗中文说明做法、次数或时长及注意点，避免诱发已知不适。总时长包括热身、正式训练和拉伸。返回JSON：{"warmup":[{"name":"动作名","note":"做法、次数或时长及注意点"}],"stretch":[{"name":"动作名","note":"做法、次数或时长及注意点"}]}。\n档案：${JSON.stringify(coachProfileContext())}\n既有计划：${JSON.stringify({factors:base.factors,workout:base.workout,warmup:base.warmup,stretch:base.stretch})}`;
    const raw = await aiCall(prompt, true);
    if (!raw) throw new Error('AI 暂不可用，请重试');
    const result = safeParseAIJson(raw);
    const warmup = missingWarmup ? validateCoachGuides(result.warmup, '热身') : base.warmup;
    const stretch = missingStretch ? validateCoachGuides(result.stretch, '拉伸') : base.stretch;
    // 等待期间可能结束训练、切换用户或修改计划，不能覆盖更新后的状态。
    if (currentUser !== user || todayPlan !== base || (base.status === 'active' && trainState.complete)) return;
    const next = {...base, warmup, stretch};
    if (!LS.set('today_plan', next)) throw new Error('补充安排保存失败，请重试');
    todayPlan = next;
    renderTrainingPage();
  } catch (error) {
    if (currentUser === user && todayPlan === base) showMessage(`未能补充：${error.message || '请重试'}。原计划和训练进度已保留。`);
  } finally {
    coachGuidesBusy = false;
    const button = document.querySelector('[onclick="supplementCoachGuides()"]');
    if (button) { button.disabled = false; button.textContent = '请教练补充热身和拉伸'; }
  }
}

async function adaptPlanWithAI(base, requestText='') {
  if(!getGlobalApiKey())return {plan:{...base,aiFailure:'请先在“我的”设置 DeepSeek API Key。'},usedAI:false,error:'请先设置 API Key'};
  setupSel={...setupSel,...(base.factors||{})};
  const payload=dynamicPlanPromptPayload(base,requestText);
  const prompt=`你是用户长期合作的专业私人健身教练。根据档案、阶段目标、真实已完成训练和今天状态，独立制定或微调当天完整力量训练计划。动作库已弃用：请自行选择用户容易理解、当前器械可用、适合其经验的动作，使用清楚的通俗中文名称。优先延续熟悉且有记录的有效动作；避免同一计划中训练目的相同的近似动作堆叠。每个动作提供2至6条可照做的步骤，说明起始姿势、动作过程和关键注意点；讲解不可声称已观察用户动作。考虑训练时间、疲劳、限制和不适，不诊断疾病；明显疼痛时给出保守安排并提醒停止诱发疼痛的动作。只把真实记录当成能力依据，不编造完成记录。动作有可核验记录时重量不得高于该动作近期最高实际重量15%再加2.5kg；没有精确记录时weight必须为0。动作2至8个，每个1至5组、1至30次、休息20至300秒；总组数按时间控制。用户提出小调整时尽量保留其他安排并说明改动原因。必须生成完整的warmup和stretch数组，各1至6项，根据当天正式动作、器械和身体限制安排；每项包含通俗名称name和说明note，note写清如何做、次数或时长及注意点，不能只在summary里提建议。可用时间须包含热身、正式训练和拉伸，必要时减少正式训练组数。返回完整有效 JSON，不要markdown：{"warmup":[{"name":"热身动作名","note":"做法、次数或时长及注意点"}],"stretch":[{"name":"拉伸动作名","note":"做法、次数或时长及注意点"}],"exercises":[{"name":"通俗中文动作名","role":"primary|auxiliary","sets":3,"reps":8,"weight":0,"rest":90,"purpose":"训练作用","reason":"安排理由","instructions":["准备姿势","动作过程","关键注意点"]}],"summary":"今天的安排和依据，用通俗话说明"}。\n输入：${JSON.stringify(payload)}`;
  try {
    const raw=await aiCall(prompt,true);if(!raw)throw new Error('AI 暂不可用');
    const result=safeParseAIJson(raw),workout=validateDynamicAIPlan(result.exercises,base,[]);
    const warmup=validateCoachGuides(result.warmup,'热身'),stretch=validateCoachGuides(result.stretch,'拉伸');
    return {plan:{...base,workout,warmup,stretch,source:'coach-ai',aiUsed:true,notice:String(result.summary||'教练已结合你的记录和今天状态制定计划。').slice(0,300),aiFailure:''},usedAI:true};
  } catch(e) {return {plan:{...base,aiFailure:String(e.message||'AI 计划未通过校验').slice(0,180)},usedAI:false,error:e.message};}
}

async function generateTodayPlan() {
  const base=createLocalPlan();
  const result=await adaptPlanWithAI(base,'');
  if(!result.usedAI){dataRecoveryNotice=`今天的 AI 训练计划没有生成：${result.error||'请稍后重试'}。`;
    const msg=document.getElementById('setupMsg');if(msg)msg.textContent=`${dataRecoveryNotice}原有训练记录已保留。`;return null;}
  const generated={...result.plan,aiUsed:true};
  todayPlan=generated;
  if(!LS.transaction({today_plan:generated,active_training:null})){todayPlan=null;dataRecoveryNotice='计划保存失败，尚未开始训练。请重试。';return null;}
  return generated;
}

async function confirmSetup() {
  const note=(document.getElementById('coachToday')?.value||'').trim();
  setupSel.todayNote=note;setupSel.equipmentText=(document.getElementById('coachEquipment')?.value||'').trim();
  const timeMatch=note.match(/(\d{1,3})\s*(?:分钟|分)/);if(timeMatch){const minutes=Math.max(10,Math.min(180,Number(timeMatch[1])));setupSel.time=`${minutes}分钟`;}
  saveSetupDraft();
  const msg=document.getElementById('setupMsg');if(!getGlobalApiKey()){msg.textContent='请先到“我的”设置 DeepSeek API Key。';return;}
  if(!profile.coachDataConsent){if(!document.getElementById('coachDataConsent')?.checked){msg.textContent='请先确认训练信息将发送给 DeepSeek，再生成计划。';return;}const next={...profile,coachDataConsent:true};if(!LS.set('profile',next)){msg.textContent='无法保存设置，请重试。';return;}profile=next;}
  msg.textContent='教练正在结合你的训练路线和实际记录安排今天…';
  const btn=document.querySelector('#trainingContent .btn-accent');if(btn)btn.disabled=true;
  try{const generated=await generateTodayPlan();if(generated){renderTrainingPage();window.scrollTo(0,0);}}
  catch(e){msg.textContent=`计划生成失败：${String(e.message||'请重试')}`;}
  finally{if(btn)btn.disabled=false;}
}

function exerciseInstructionBlock(exercise, targetId) {
  const steps=Array.isArray(exercise?.instructions)?exercise.instructions:[];
  const detail=steps.length?`<ol>${steps.map(step=>`<li>${escapeHtml(step)}</li>`).join('')}</ol>`:'<div>先用轻重量熟悉动作；不确定时暂停并询问教练。</div>';
  return `<div id="${escapeHtml(targetId)}" class="instruction-panel open"><div class="reason-note">${escapeHtml(exercise?.purpose||'')}</div>${detail}</div>`;
}

function renderPlanPreview() {
  setTrainingFixedAction(false);
  const items=todayPlan.workout.map((ex,index)=>`<div class="preview-item"><div class="preview-head"><span class="preview-role ${ex.role==='核心'?'':'aux'}">${ex.role==='核心'?'主要训练':'辅助训练'}</span><div style="flex:1"><div class="font-bold">${index+1}. ${escapeHtml(ex.name)}</div>${exerciseInstructionBlock(ex,`coach-preview-${index}`)}</div></div><div class="edit-grid"><div class="edit-field"><label>组数</label><input type="number" min="1" max="5" value="${ex.sets}" oninput="updatePreviewField(${index},'sets',this.value)"></div><div class="edit-field"><label>次数</label><input type="number" min="1" max="30" value="${ex.reps}" oninput="updatePreviewField(${index},'reps',this.value)"></div><div class="edit-field"><label>重量 kg</label><input type="number" min="0" step="0.5" value="${ex.weight}" oninput="updatePreviewField(${index},'weight',this.value)"></div><div class="edit-field"><label>休息秒</label><input type="number" min="20" max="300" value="${ex.rest}" oninput="updatePreviewField(${index},'rest',this.value)"></div></div><button class="mini-btn mt-2" onclick="swapPlanExercise(${index})">教练，换一个我更容易做的动作</button></div>`).join('');
  document.getElementById('trainingContent').innerHTML=`<div class="training-header"><span class="text-accent font-bold">教练为今天安排</span><span class="text-muted text-sm">计划预览</span></div><div class="coach-message assistant"><strong>教练</strong><div>${escapeHtml(todayPlan.notice||'')}</div></div><div class="plan-request card"><label class="setup-label" for="planRequest">想微调什么？</label><textarea id="planRequest" class="setup-input" rows="2" maxlength="500" placeholder="例如：今天只有30分钟；我不会这个动作">${escapeHtml(todayPlan.userRequest||'')}</textarea><button class="mini-btn mt-2" onclick="applyPlanRequest()">请教练调整</button><div id="planRequestMsg" class="text-sm text-muted mt-2">教练会尽量保留你没有要求改动的部分。</div></div>${renderCoachGuidePreview(todayPlan.warmup,'训练前热身')}<div class="card mt-3"><div class="section-title">正式训练 · ${escapeHtml(todayPlan.focus)} · ${todayPlan.workout.length} 个动作 · ${escapeHtml(todayPlan.factors.time||'')}</div>${items}</div>${renderCoachGuidePreview(todayPlan.stretch,'训练后拉伸')}${!todayPlan.warmup?.length||!todayPlan.stretch?.length?missingCoachGuidesAction():''}<button class="btn btn-accent mt-3" onclick="startConfirmedPlan()">确认，开始热身</button><button class="btn btn-outline mt-3" onclick="discardTodayPlan()">返回修改今天的情况</button>`;
}

async function retryAIPlan() { const result=await adaptPlanWithAI(todayPlan,todayPlan.userRequest||'');if(result.usedAI){todayPlan=result.plan;LS.set('today_plan',todayPlan);renderPlanPreview();}else{todayPlan={...todayPlan,...result.plan};LS.set('today_plan',todayPlan);renderPlanPreview();} }
async function applyPlanRequest() {const request=(document.getElementById('planRequest')?.value||'').trim(),msg=document.getElementById('planRequestMsg');if(!request){msg.textContent='告诉教练你想微调什么。';return;}msg.textContent='教练正在调整…';const result=await adaptPlanWithAI(todayPlan,request);if(result.usedAI){todayPlan={...result.plan,userRequest:request};if(LS.set('today_plan',todayPlan))renderPlanPreview();else msg.textContent='调整结果保存失败，原计划仍保留。';}else msg.textContent=`${result.error||'暂时无法调整'}，当前计划保留，请重试。`;}
async function swapPlanExercise(index) {await applyCoachPlanChange(`把第${index+1}个动作“${todayPlan.workout[index]?.name}”换成我更容易理解和完成的动作，训练作用保持一致。`);}
async function applyCoachPlanChange(request) {const result=await adaptPlanWithAI(todayPlan,request);if(result.usedAI){todayPlan=result.plan;LS.set('today_plan',todayPlan);renderPlanPreview();}}

function renderHomePage() {
  if(!currentUser)return;
  const last=getLastSessionSummary();
  const title=todayPlan?.status==='active'?'继续上次训练':!profile.onboardingComplete||!profile.coachSummary?'先认识一下你的教练':'开始今天的训练';
  const detail=todayPlan?.status==='active'?`已保留训练进度 · ${todayPlan.workout.length} 个动作`:profile.coachPhase||'教练会根据你的目标、实际训练记录和当天状态来安排。';
  document.getElementById('homeContent').innerHTML=`<header class="app-masthead"><div><div class="brand-word">IRONTRACK</div><div class="brand-meta">你的私人训练教练</div></div><div class="user-pill">${escapeHtml(currentUser)}</div></header><section class="home-hero" onclick="navigate('training')" role="button" tabindex="0"><div class="hero-kicker">${todayPlan?.status==='active'?'训练进行中':'教练跟进'}</div><div class="hero-title">${escapeHtml(title)}</div><div class="hero-summary">${escapeHtml(detail)}</div><div class="hero-action"><span>${todayPlan?.status==='active'?'继续训练':'进入教练流程'}</span><span>→</span></div></section><div class="home-section-label">训练进展</div><div class="home-list"><div class="home-row"><div><div class="home-row-label">已记录训练</div><div class="home-row-value">${sessions.length} 次 · 本周 ${getWeekSessions().length} 次</div></div></div>${last?`<div class="home-row"><div><div class="home-row-label">上次训练 · ${escapeHtml(last.date)}</div><div class="home-row-value">${escapeHtml(last.dayName)} · ${last.totalSets} 组实际记录</div></div><div class="home-row-side">${last.duration}</div></div>`:''}<div class="home-row" onclick="navigate('plan')"><div><div class="home-row-label">我的训练路线</div><div class="home-row-value">${escapeHtml(profile.trainingDirection||'等待与教练确认目标')}</div></div><span class="home-row-arrow">→</span></div><div class="home-row" onclick="navigate('data')"><div><div class="home-row-label">我的进展</div><div class="home-row-value">查看实际训练和身体记录</div></div><span class="home-row-arrow">→</span></div></div>`;
}

function renderPlanPage() {
  if(!currentUser)return;
  const phase=profile.coachPhase||'还没有训练路线。进入训练页，先和教练聊聊你的目标。';
  document.getElementById('systemContent').innerHTML=`<div class="training-header"><span class="text-accent font-bold">我的训练路线</span><span class="text-muted text-sm">教练建议</span></div>${profile.coachPendingPhase?`<div class="coach-review"><div class="section-title">教练建议调整阶段安排</div><p>${escapeHtml(profile.coachPendingPhase)}</p><button class="btn btn-accent" onclick="acceptCoachPhaseChange()">确认调整</button></div>`:''}<div class="coach-message assistant"><strong>阶段安排</strong><div>${escapeHtml(phase)}</div></div><div class="card"><div class="section-title">教练目前对你的了解</div><p>${escapeHtml(profile.coachSummary||'尚未建立')}</p><div class="reason-note">阶段内已记录 ${trainingPhase?.completedSessions||0} 次训练。完成训练后，教练会结合实际表现调整细节；目标或每周安排明显变化时会请你确认。</div><button class="btn btn-accent mt-3" onclick="renderOnboarding()">更新训练需求</button></div><button class="btn btn-outline" onclick="navigate('training')">进入今天的训练</button>`;
}

function completeSet() {
  const s=trainState,ex=s.day.exercises[s.exIdx];s.reps=validReps(s.reps,validReps(ex.reps,8));if(s.reps<1){alert('实际次数至少为 1。');return;}
  if(!s.records[ex.id])s.records[ex.id]=[];s.records[ex.id].push({set:s.set,w:s.weight,r:s.reps,confirmedAt:new Date().toISOString()});persistTrainingState();
  if(s.set<ex.sets){s.set++;startRestTimer();return;}
  advanceAfterExercise();
}

function renderFinishPrompt() {
  setTrainingFixedAction(false);
  const s=trainState,actual=Object.values(s.records||{}).reduce((n,rows)=>n+rows.length,0);
  document.getElementById('trainingContent').innerHTML=`<div class="training-header"><span class="text-accent font-bold">训练复盘</span><span class="text-muted text-sm">${actual} 组实际记录</span></div><div class="coach-message assistant"><strong>教练</strong><div>实际完成内容我已记录。有什么特别顺利、困难或不舒服的地方，可以告诉我；没有也可以直接保存。</div></div><div class="card"><label class="setup-label" for="sessionDiscomfort">今天想补充什么？（选填）</label><textarea id="sessionDiscomfort" class="setup-input" rows="3" maxlength="500" placeholder="例如：最后两组很吃力；某个动作不太会">${escapeHtml(s.sessionDiscomfort||'')}</textarea><div id="finishMsg" class="text-center text-muted text-sm mt-2"></div><button class="btn btn-accent mt-3" onclick="confirmFinishTraining()">保存训练并查看复盘</button><button class="btn btn-outline mt-3" onclick="returnToWorkout()">返回训练</button></div>`;
}

function renderComplete() {
  setTrainingFixedAction(false);
  const s=trainState,actual=Object.values(s.records||{}).reduce((n,rows)=>n+rows.length,0);
  const review=profile.coachLastReview||'';
  document.getElementById('trainingContent').innerHTML=`<div class="complete-container"><div class="complete-icon">✓</div><div class="complete-title">${s.saved?'训练记录已保存':'训练结束，等待保存'}</div><div class="complete-time">${escapeHtml(s.day?.name||'今日训练')} · ${actual} 组实际记录 · ${formatTime(s.sessionTime||0)}</div>${s.saveError?`<div class="danger-note">${escapeHtml(s.saveError)}</div>`:''}${review?`<div class="coach-message assistant"><strong>教练复盘</strong><div>${escapeHtml(review)}</div></div>`:s.reviewing?'<div class="reason-note">教练正在结合今天的表现整理复盘…</div>':''}${profile.coachPendingPhase?`<div class="coach-review"><div class="section-title">教练建议调整阶段安排</div><p>${escapeHtml(profile.coachPendingPhase)}</p><button class="btn btn-accent" onclick="acceptCoachPhaseChange()">确认调整</button></div>`:''}${s.saved?'<button class="btn btn-accent mt-3" onclick="resetTraining();navigate(\'home\')">完成</button>':'<button class="btn btn-accent" onclick="retryFinishSave()">重试保存</button>'}<button class="btn btn-outline mt-3" onclick="navigate(\'home\')">返回首页</button></div>`;
}

function acceptCoachPhaseChange() {
  if(!profile.coachPendingPhase)return;
  const next={...profile,coachPhase:profile.coachPendingPhase,coachPendingPhase:''};
  if(LS.set('profile',next)){profile=next;renderComplete();}
}

async function requestCoachReview(session) {
  if(!profile.coachDataConsent){profile={...profile,coachLastReview:''};renderComplete();return;}
  trainState.reviewing=true;renderComplete();
  try{
    const prompt=`你是用户持续合作的私人健身教练。根据阶段安排、历史真实完成记录和本次实际记录做简短复盘。不可把计划值当作完成值；数据不足就明确说不足；不作医疗诊断。日常动作、组数和重量调整无需确认；阶段目标、每周频率或整体训练方式明显变化时，必须给出建议并标记 needsConfirmation=true。没有明显变化时 nextPhase 留空。返回 JSON：{"review":"不超过180字的对用户复盘","needsConfirmation":false,"nextPhase":"仅填写需要用户确认的明显阶段调整建议"}\n阶段安排：${profile.coachPhase||''}\n历史：${JSON.stringify(coachRecentSessions(5))}\n本次：${JSON.stringify(session)}`;
    const raw=await aiCall(prompt,true);if(!raw)throw new Error('AI 暂不可用');const result=safeParseAIJson(raw);
    const needsConfirmation=result.needsConfirmation===true && String(result.nextPhase||'').trim();
    const next={...profile,coachLastReview:String(result.review||'训练记录已保存，后续会结合连续表现继续观察。').slice(0,500),coachPendingPhase:needsConfirmation?String(result.nextPhase).slice(0,1800):'',coachPhase:profile.coachPhase||''};
    if(LS.set('profile',next))profile=next;
  }catch(e){profile={...profile,coachLastReview:'训练记录已保存。暂时无法生成 AI 复盘，之后打开时仍可结合这些实际记录继续安排。'};LS.set('profile',profile);}
  trainState.reviewing=false;renderComplete();
}

async function confirmFinishTraining() {
  const s=trainState;if(s.saved||!todayPlan){if(s.pendingCompletion)saveSession();renderComplete();return;}
  s.sessionDiscomfort=(document.getElementById('sessionDiscomfort')?.value||'').trim();s.sessionFeedback=s.sessionDiscomfort?'用户补充反馈':'';s.advancePpl=false;s.complete=true;
  if(s.timerInterval)clearInterval(s.timerInterval);if(s.restInterval)clearInterval(s.restInterval);persistTrainingState();
  const pendingSession={id:'session-'+todayPlan.id,date:getTodayStr(),dayName:todayPlan.focus||'训练',focusArea:todayPlan.focus||'训练',exercises:s.day.exercises.map(ex=>({name:ex.name,role:ex.role,targetSets:ex.sets,targetReps:ex.reps,targetWeight:ex.weight,completed:(s.records[ex.id]||[]).length>=ex.sets,status:(s.records[ex.id]||[]).length>=ex.sets?'completed':(s.records[ex.id]||[]).length?'partial':'not_started',feedback:'',sets:(s.records[ex.id]||[]).map(row=>({w:row.w,r:row.r,confirmedAt:row.confirmedAt}))})),duration:s.sessionTime,sessionFeedback:s.sessionFeedback,sessionDiscomfort:s.sessionDiscomfort,source:'coach-ai'};
  s.saved=saveSession();
  if(!s.saved){renderComplete();return;}
  requestCoachReview(pendingSession);
}
