// IronTrack 教练流程：直接围绕用户目标、真实训练记录和当天状态工作。
let coachBusy = false;
let coachSessionEpoch = 0, coachIntakeRequest = 0, coachPlanRequest = 0, coachGuidesRequest = 0;
function invalidateCoachRequests() { coachSessionEpoch++; coachIntakeRequest++; coachPlanRequest++; coachGuidesRequest++; coachBusy=false; coachGuidesBusy=false; }
function requestIdentity() { return {user:currentUser, epoch:coachSessionEpoch}; }
function requestIdentityMatches(identity) { return !!identity.user && currentUser===identity.user && coachSessionEpoch===identity.epoch; }
function intakeRequestMatches(request) { return requestIdentityMatches(request.identity) && request.id===coachIntakeRequest && sameData(profile,request.profile) && sameData(LS.get('onboarding_draft',null),request.draft); }
function planRequestMatches(request) { return requestIdentityMatches(request.identity) && request.id===coachPlanRequest && sameData(profile,request.profile) && sameData(trainingPhase,request.phase) && sameData(todayPlan,request.plan) && sameData(LS.get('setup_draft',null),request.setupDraft); }
function beginPlanRequest() { return {identity:requestIdentity(),id:++coachPlanRequest,profile:cloneData(profile),phase:cloneData(trainingPhase),plan:cloneData(todayPlan),setupDraft:cloneData(LS.get('setup_draft',null))}; }
function renderCoachIfVisible() { if(currentPage==='training')renderOnboarding(); }


// 动作名称的关联只来自用户明确确认，不自动推断相似动作。
function exerciseNameKey(name) { return String(name||'').trim().toLowerCase(); }
function exerciseAliasEntries() { return Array.isArray(profile?.exerciseAliases)?profile.exerciseAliases.filter(row=>row&&typeof row.name==='string'&&typeof row.canonical==='string'):[]; }
function canonicalExerciseName(name) { const text=String(name||'').trim(), match=exerciseAliasEntries().find(row=>exerciseNameKey(row.name)===exerciseNameKey(text));return match?match.canonical:text; }
function sameExerciseName(a,b) { return exerciseNameKey(canonicalExerciseName(a))===exerciseNameKey(canonicalExerciseName(b)); }
function exerciseHistoryFor(name,limit=Infinity) {
  const archived=LS.get('sessions_archive',[]), all=[...(sessions||[]),...(Array.isArray(archived)?archived:[])];
  return all.flatMap(session=>(session.exercises||[]).filter(ex=>sameExerciseName(ex.name,name)&&(ex.sets||[]).length).map(ex=>({date:session.date,name:ex.name,sets:ex.sets}))).slice(0,limit);
}
function exerciseHistoryNames() {
  const archived=LS.get('sessions_archive',[]), all=[...(sessions||[]),...(Array.isArray(archived)?archived:[])], names=[];
  for(const session of all)for(const ex of (session.exercises||[]))if((ex.sets||[]).length && !names.some(name=>exerciseNameKey(name)===exerciseNameKey(ex.name)))names.push(ex.name);
  return names;
}
function concerningSymptoms(text) {
  const value=String(text||''),pattern=/(胸痛|胸闷|胸口痛|呼吸困难|喘不过气|晕厥|昏厥|晕倒|头晕|心悸)/g;
  for(const match of value.matchAll(pattern)){
    const before=value.slice(Math.max(0,match.index-5),match.index);
    if(!/(没有|并无|无明显|不再|未出现|无)$/.test(before))return true;
  }
  return false;
}

function coachRecentSessions(limit = 8) {
  return (sessions || []).slice(0, limit).map(session => ({
    date:session.date, duration:session.duration || 0, feedback:session.sessionFeedback || '', discomfort:session.sessionDiscomfort || '',
    exercises:(session.exercises || []).map(ex => ({
      name:canonicalExerciseName(ex.name), recordedName:ex.name, status:ex.status || '', feedback:ex.feedback || '',
      sets:(ex.sets || []).map(set => ({weight:Number(set.w)||0,reps:Number(set.r)||0,...(set.loadType==='bodyweight'?{loadType:'bodyweight'}:{})}))
    })).filter(ex => ex.sets.length)
  }));
}

function coachProfileIsStale() {
  const facts=profile.coachIntakeFacts||{};
  return !!profile.coachSummaryNeedsUpdate || !!(profile.onboardingComplete && (
    (facts.goal && profile.trainingDirection && facts.goal!==profile.trainingDirection) ||
    (facts.daysPerWeek && profile.trainingDays && Number(facts.daysPerWeek)!==Number(profile.trainingDays)) ||
    (facts.experience && profile.experienceSummary && facts.experience!==profile.experienceSummary) ||
    (facts.limitations && profile.limitations && facts.limitations!==profile.limitations)
  ));
}
function currentPlanNeedsReview() { return !!todayPlan && profile.coachPlanReviewId===todayPlan.id; }
function coachProfileContext() {
  const hasPriorHistory=!!profile.onboardingComplete || (sessions||[]).length>0;
  const facts=profile.coachIntakeFacts||{}, overrides=profile.coachProfileOverrides||{};
  const current=(key,visible,fallback)=>Object.prototype.hasOwnProperty.call(overrides,key)?overrides[key]:(hasPriorHistory && visible ? visible : fallback);
  return {
    knownSummary:coachProfileIsStale()?'':(profile.coachSummary || ''), phase:profile.coachPhase || '',
    goal:current('goal',profile.trainingDirection||profile.goal,facts.goal||''),
    daysPerWeek:current('daysPerWeek',profile.trainingDays,facts.daysPerWeek||null),
    experience:current('experience',profile.experienceSummary||profile.experience,facts.experience||''),
    limitations:current('limitations',profile.limitations,facts.limitations||''),
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
  if (todayPlan?.status === 'preview') { renderTrainingPage(); return; }
  if (!profile.onboardingComplete || !profile.coachSummary || !profile.coachPhase) { renderOnboarding(); return; }
  renderTrainingSetup();
}

function ensurePplPlan() { /* 训练安排由教练生成；保留旧计划数据供历史兼容。 */ }

function renderOnboarding(message = '') {
  setTrainingFixedAction(false);
  const draft = LS.get('onboarding_draft', {mode:'intro',messages:[],summary:'',question:''});
  if(draft.mode==='phase' && !draft.phase && !coachBusy){draft.mode='review';saveCoachDraft(draft);message=message||'阶段安排尚未生成，请重新确认。';}
  const messages = Array.isArray(draft.messages) ? draft.messages : [];
  const transcript = messages.map(row => `<div class="coach-message ${row.role==='user'?'user':'assistant'}"><strong>${row.role==='user'?'你':'教练'}</strong><div>${escapeHtml(row.content)}</div></div>`).join('');
  let action = '';
  if (draft.mode === 'review') {
    action = `<div class="card coach-review"><div class="section-title">教练目前对你的了解</div><p>${escapeHtml(draft.summary)}</p><label class="setup-label" for="coachCorrection">需要补充或纠正吗？</label><textarea id="coachCorrection" class="setup-input" rows="2" maxlength="600" placeholder="可直接修改；没有需要改的就确认"></textarea><button class="btn btn-accent mt-3" onclick="confirmCoachUnderstanding()">确认，制定阶段安排</button></div>`;
  } else if (draft.mode === 'phase') {
    action = `<div class="card coach-review"><div class="section-title">第一阶段训练安排</div><p>${escapeHtml(draft.phase || '正在请教练制定安排…')}</p>${draft.phase?`<label class="setup-label" for="coachPhaseEdit">想微调哪里？（选填）</label><textarea id="coachPhaseEdit" class="setup-input" rows="2" maxlength="500" oninput="savePhaseEdit(this.value)" placeholder="例如：每次训练希望控制在45分钟">${escapeHtml(draft.phaseEdit||'')}</textarea><button class="btn btn-accent mt-3" onclick="acceptCoachPhase()">确认安排，开始训练</button>`:''}</div>`;
  } else {
    const prompt = draft.question || (profile.coachSummary ? `我已掌握你的一些资料和 ${sessions.length} 条训练记录。最近最希望训练帮你实现什么？` : '我会像私人教练一样，根据你的目标和实际训练持续带你练。你为什么想开始训练？最希望自己发生什么改变？按自己的话说就好。');
    action = `<div class="card coach-review"><div class="setup-title">${escapeHtml(prompt)}</div><div class="setup-subtitle">不用健身术语。我会根据你说的内容继续了解，每次只问一个重点。</div><textarea id="coachAnswer" class="setup-input onboarding-answer" rows="3" maxlength="1000" oninput="saveCoachAnswer(this.value)" ${coachBusy?'disabled':''} placeholder="写下你的想法，也可以说目前还不确定">${escapeHtml(draft.answer||'')}</textarea>${!profile.coachDataConsent?'<label class="data-consent"><input id="coachDataConsent" type="checkbox"> 我知道训练档案、身体限制和近期训练记录会发送给 DeepSeek，用于教练对话和计划；我的姓名不会发送。</label>':''}<button class="btn btn-accent mt-3" onclick="sendCoachIntake()" ${coachBusy?'disabled':''}>发送给教练</button></div>`;
  }
  document.getElementById('trainingContent').innerHTML = `<div class="training-header"><span class="text-accent font-bold">认识你的教练</span><span class="text-muted text-sm">首次设置</span></div><div class="reason-note">${!getGlobalApiKey()?'第 1 步：设置 AI 连接':draft.mode==='phase'?'第 3 步：确认阶段安排':'第 2 步：告诉教练你的情况'}</div>${transcript}${message?`<div class="reason-note">${escapeHtml(message)}</div>`:''}${action}<div id="coachStatus" class="text-center text-muted text-sm mt-3"></div>${!getGlobalApiKey()?'<div class="danger-note">教练需要 AI 才能了解你并制定计划。请先到“我的”设置 DeepSeek API Key。</div><button class="btn btn-outline mt-3" onclick="openCoachSettings()">去设置 API Key</button>':''}</div>`;
}

async function sendCoachIntake() {
  if (coachBusy) return;
  const answer=(document.getElementById('coachAnswer')?.value||'').trim();
  if(!getGlobalApiKey()){const status=document.getElementById('coachStatus');if(status)status.textContent='你的回答已保存在本机。请先到“我的”设置 DeepSeek API Key，再发送给教练。';return;}
  if(!answer)return;
  if(!profile.coachDataConsent){if(!document.getElementById('coachDataConsent')?.checked){renderOnboarding('请先确认训练信息将发送给 DeepSeek，再继续。');return;}const next={...profile,coachDataConsent:true};if(!LS.set('profile',next)){renderOnboarding('无法保存设置，请重试。');return;}profile=next;}
  const draft=LS.get('onboarding_draft',{mode:'intro',messages:[],summary:'',question:''});
  draft.answer=answer;
  try{saveCoachDraft(draft);}catch(e){renderOnboarding('回答尚未保存，请检查本机存储后重试。');return;}
  const request={identity:requestIdentity(),id:++coachIntakeRequest,profile:cloneData(profile),draft:cloneData(draft)};
  const messages=[...(draft.messages||[]),{role:'user',content:answer}];
  coachBusy=true;renderOnboarding();
  const status=document.getElementById('coachStatus');if(status)status.textContent='教练正在整理你的情况…';
  const prompt=`你是 IronTrack 的专业私人健身教练。通过自然对话了解用户，逐步弄清目标、训练基础、每周可用时间、训练场地/器械、身体限制和偏好；年龄等个人特征仅在确实影响安排时询问。已知信息不得重复问；每轮只提出一个最重要的补充问题。结合下方现有档案和真实训练记录，以当前明确档案为准，不要沿用与之冲突的旧总结。只有目标、经验、训练可行性、重要限制已足够明确时才 ready=true；否则先追问。禁止推断未提供的事实。facts 只填写用户明确表达或档案已确认的内容，未知用空字符串/null/空数组。返回 JSON：{"ready":false,"summary":"基于已确认事实的简短理解，未知处标待了解","question":"一个自然的后续问题","facts":{"goal":"","daysPerWeek":null,"experience":"","limitations":"","equipment":[],"age":null}}。ready=true时question留空。\n档案：${JSON.stringify(coachProfileContext())}\n最近真实训练：${JSON.stringify(coachRecentSessions())}\n对话：${JSON.stringify(messages)}`;
  let error='';
  try {
    const raw=await aiCall(prompt,true);if(!raw)throw new Error('AI 暂不可用');
    if(!intakeRequestMatches(request))return;
    const result=safeParseAIJson(raw);
    const next={...draft,messages,answer:'',summary:String(result.summary||'').slice(0,1800),facts:isPlainRecord(result.facts)?result.facts:(draft.facts||{})};
    if(result.ready===true){next.mode='review';next.question='';}else{next.mode='intro';next.question=String(result.question||'还有什么训练条件需要我了解？').slice(0,300);}
    saveCoachDraft(next);
  } catch(e){if(intakeRequestMatches(request))error=`这次没有发送成功：${String(e.message||'连接失败')}。你的内容已保留；请检查网络、AI 连接后重试。`;}
  finally {if(requestIdentityMatches(request.identity)&&request.id===coachIntakeRequest){coachBusy=false;if(currentPage==='training')renderOnboarding(error);}}
}

function saveCoachAnswer(value) {
  const draft=LS.get('onboarding_draft',{mode:'intro',messages:[],summary:'',question:''});
  draft.answer=String(value||'').slice(0,1000);
  LS.set('onboarding_draft',draft);
}

function savePhaseEdit(value) {
  const draft=LS.get('onboarding_draft',{});draft.phaseEdit=String(value||'').slice(0,500);LS.set('onboarding_draft',draft);
}

async function confirmCoachUnderstanding() {
  if(coachBusy)return;
  const correction=(document.getElementById('coachCorrection')?.value||'').trim();
  const draft=LS.get('onboarding_draft',{});
  if(correction){draft.messages=[...(draft.messages||[]),{role:'user',content:`请修正教练理解：${correction}`}];draft.mode='intro';draft.question='我会根据这条修正重新核对。还有其他需要补充的吗？';saveCoachDraft(draft);renderOnboarding();return;}
  draft.mode='phase';draft.phase='';saveCoachDraft(draft);
  const request={identity:requestIdentity(),id:++coachIntakeRequest,profile:cloneData(profile),draft:cloneData(draft)};
  coachBusy=true;renderOnboarding();const status=document.getElementById('coachStatus');if(status)status.textContent='教练正在制定第一阶段安排…';
  let error='';
  try {
    const prompt=`你是用户的专业私人健身教练。请根据已由用户确认的需求、身体限制、训练经历和实际历史记录，提出可执行的第一阶段训练规划。用通俗中文，按以下五项分行写清：阶段目标、每周安排、主要训练重点、进步判断方法、复盘时机；主要动作保持一段时间以便比较，漏练根据实际记录继续，不机械补课。信息不足时明确写待了解，保持保守，不诊断疾病。输出一段不超过600字的自然中文，不用JSON。\n用户确认的理解：${draft.summary}\n档案：${JSON.stringify(coachProfileContext())}\n近期实际训练：${JSON.stringify(coachRecentSessions())}`;
    const raw=await aiCall(prompt,true);if(!raw)throw new Error('AI 暂不可用');
    if(!intakeRequestMatches(request)){if(requestIdentityMatches(request.identity)&&request.id===coachIntakeRequest&&sameData(LS.get('onboarding_draft',null),request.draft)){draft.mode='review';saveCoachDraft(draft);error='档案已更新，请重新确认后制定阶段安排。';}return;}
    draft.phase=String(raw).trim().replace(/^```[\s\S]*?\n|```$/g,'').slice(0,1800);saveCoachDraft(draft);
  } catch(e) {if(intakeRequestMatches(request)){draft.mode='review';saveCoachDraft(draft);error=`阶段安排生成失败：${String(e.message||'连接失败')}。请重试。`;}}
  finally {if(requestIdentityMatches(request.identity)&&request.id===coachIntakeRequest){coachBusy=false;if(currentPage==='training')renderOnboarding(error);}}
}

async function acceptCoachPhase() {
  if(coachBusy)return;
  const edit=(document.getElementById('coachPhaseEdit')?.value||'').trim();
  const draft=LS.get('onboarding_draft',{});
  if(edit){
    draft.phaseEdit=edit;try{saveCoachDraft(draft);}catch(e){renderOnboarding('调整意见尚未保存，请检查本机存储后重试。');return;}
    const request={identity:requestIdentity(),id:++coachIntakeRequest,profile:cloneData(profile),draft:cloneData(draft)};
    coachBusy=true;let error='';
    const status=document.getElementById('coachStatus');if(status)status.textContent='教练正在调整…';
    try{
      const raw=await aiCall(`请根据用户确认的个人理解和阶段安排，按补充意见做小幅修改，保留其他已确认内容，使用通俗中文，不超过600字。\n了解：${draft.summary}\n原安排：${draft.phase}\n意见：${edit}`,true);
      if(!raw)throw new Error('AI 暂不可用');if(!intakeRequestMatches(request)){if(requestIdentityMatches(request.identity)&&request.id===coachIntakeRequest&&currentPage==='training')renderOnboarding('档案或对话已变化，请重新调整。');return;}
      draft.messages=[...(draft.messages||[]),{role:'user',content:`请按我的意见微调阶段安排：${edit}`}];draft.phase=String(raw).trim().slice(0,1800);draft.phaseEdit='';saveCoachDraft(draft);
    }catch(e){if(intakeRequestMatches(request))error=`微调失败，原安排已保留：${String(e.message||'连接失败')}`;}
    finally{if(requestIdentityMatches(request.identity)&&request.id===coachIntakeRequest)coachBusy=false;}
    if(!requestIdentityMatches(request.identity)||request.id!==coachIntakeRequest)return;
    if(error){if(currentPage==='training')renderOnboarding(error);return;}
    // 修改后的安排先给用户查看，不自动视为确认。
    if(currentPage==='training')renderOnboarding();return;
  }
  const facts=draft.facts||{};
  const next={...profile,coachSummary:draft.summary,coachSummaryNeedsUpdate:false,coachProfileOverrides:{...(profile.coachProfileOverrides||{})},coachPhase:draft.phase,coachMessages:draft.messages||[],coachIntakeFacts:facts,onboardingComplete:true,aiPlanEnabled:true};
  if(facts.goal){next.trainingDirection=String(facts.goal).slice(0,500);next.goal=next.trainingDirection;next.coachProfileOverrides.goal=next.trainingDirection;}
  if(Number.isInteger(Number(facts.daysPerWeek))&&Number(facts.daysPerWeek)>=1&&Number(facts.daysPerWeek)<=7){next.trainingDays=Number(facts.daysPerWeek);next.coachProfileOverrides.daysPerWeek=next.trainingDays;}
  if(facts.experience){next.experienceSummary=String(facts.experience).slice(0,500);next.coachProfileOverrides.experience=next.experienceSummary;}
  if(facts.limitations){next.limitations=String(facts.limitations).slice(0,500);next.coachProfileOverrides.limitations=next.limitations;}
  if(Array.isArray(facts.equipment)&&facts.equipment.length)next.equipment=facts.equipment.map(x=>String(x).slice(0,80)).slice(0,30);
  if(facts.age&&Number(facts.age)>=13&&Number(facts.age)<=110)next.age=Number(facts.age);
  const phase={startedAt:getTodayStr(),completedSessions:0};
  if(!LS.transaction({profile:next,training_phase:phase,onboarding_draft:{mode:'intro',messages:[],summary:'',question:''}})){renderOnboarding('保存失败，确认内容仍保留，请重试。');return;}
  profile=next;trainingPhase=phase;todayPlan=null;navigate('home');
}

function openCoachSettings() {
  navigate('profile');
  const section=document.getElementById('ai-settings');if(section)section.open=true;
  const input=document.getElementById('pf-apiKey');if(input)input.focus();
}
function reuseContext() {
  const info=coachProfileContext();
  return {goal:info.goal,daysPerWeek:info.daysPerWeek,experience:info.experience,limitations:info.limitations,notes:info.notes,body:info.body,phase:{startedAt:trainingPhase?.startedAt||'',focus:trainingPhase?.focus||'',nextStep:trainingPhase?.nextStep||''}};
}
function reuseDiscomfortMentioned(text) { return /疼|痛|不适|不舒服|受伤|伤病|发烧|发热|头晕|眩晕|胸闷|心悸|乏力|疲惫|呼吸困难|气短|咳嗽|恶心/.test(String(text||'')); }
function reusablePlanHasCompleteShape(plan) {
  if(!plan||!Array.isArray(plan.workout)||plan.workout.length<2||plan.workout.length>8||!plan.factors?.equipmentText)return false;
  try {validateCoachGuides(plan.warmup,'热身');validateCoachGuides(plan.stretch,'拉伸');}catch(e){return false;}
  return plan.workout.every(ex=>typeof ex.name==='string'&&ex.name.trim()&&Number.isInteger(ex.sets)&&ex.sets>=1&&ex.sets<=5&&Number.isInteger(ex.reps)&&ex.reps>=1&&ex.reps<=30&&Number.isFinite(ex.weight)&&ex.weight>=0&&ex.weight<=1000&&Number.isInteger(ex.rest)&&ex.rest>=20&&ex.rest<=300&&Array.isArray(ex.instructions)&&ex.instructions.length>=2&&ex.instructions.every(step=>typeof step==='string'&&step.trim()));
}
function reusableSnapshotFor(plan,session) {
  if(!plan || !sessionIsComplete(session) || currentPlanNeedsReview() || !plan.reuseContext || !sameData(plan.reuseContext,reuseContext()))return null;
  if(!Array.isArray(plan.warmup)||!plan.warmup.length||!Array.isArray(plan.stretch)||!plan.stretch.length||!plan.factors?.equipmentText)return null;
  if(plan.factors.state==='有不适'||session.sessionFeedback==='有不适'||session.sessionDiscomfort||concerningSymptoms(plan.factors.discomfortText||''))return null;
  if(reuseDiscomfortMentioned(plan.factors.discomfortText))return null;
  try {
    const candidate=normalizeTodayPlanData(cloneData(plan));
    if(!reusablePlanHasCompleteShape(candidate))return null;
    return {version:1,sessionId:session.id,date:session.date,context:cloneData(plan.reuseContext),plan:candidate};
  }catch(e){return null;}
}
function getReusableSnapshot() {
  const snapshot=profile?.reusablePlan;
  if(!isPlainRecord(snapshot)||snapshot.version!==1||!snapshot.plan||coachProfileIsStale()||!sameData(snapshot.context,reuseContext()))return null;
  if(!(sessions||[]).length||sessions[0].id!==snapshot.sessionId||!sessionIsComplete(sessions[0]))return null;
  try {const plan=normalizeTodayPlanData(snapshot.plan);if(!reusablePlanHasCompleteShape(plan))return null;return {...snapshot,plan};}catch(e){return null;}
}
function reusePreviousPlan() {
  if(todayPlan){return;}
  const msg=document.getElementById('setupMsg'),snapshot=getReusableSnapshot();
  if(!snapshot){if(msg)msg.textContent='没有可用的完整旧计划，请联网生成。';return;}
  const state=document.querySelector('[name="quickState"]:checked')?.value||'',note=(document.getElementById('coachToday')?.value||'').trim(),equipment=(document.getElementById('coachEquipment')?.value||'').trim();
  if(state!=='正常'||concerningSymptoms(note)||reuseDiscomfortMentioned(note)){if(msg)msg.textContent='仅在今天状态正常且没有新增不适时可参考旧计划；否则请重新制定。';return;}
  if(!equipment){if(msg)msg.textContent='请先填写今天能用的器械。';return;}
  const choice=document.querySelector('[name="quickTime"]:checked')?.value||setupSel.time||'45分钟',custom=document.getElementById('customMinutes')?.value;
  if(choice==='other'&&(!Number.isInteger(Number(custom))||Number(custom)<10||Number(custom)>180)){if(msg)msg.textContent='请输入 10 到 180 分钟。';return;}
  const minutes=choice==='other'?`${Number(custom)}分钟`:choice, old=snapshot.plan;
  if(!confirm(`上次计划：${snapshot.date} · ${old.factors.time||'时间未记录'} · ${old.factors.equipmentText}\n今天：${minutes} · ${equipment}\n\n旧计划不会按今天的条件重新评估。请确认器械、时间和身体状态适合，并在下一页逐项检查。`))return;
  const workout=old.workout.map(ex=>{const last=exerciseHistoryFor(ex.name,1)[0],next={...ex,id:'reuse-ex-'+Math.random().toString(36).slice(2,10),lastActual:last?{date:last.date,sets:last.sets.map(st=>({w:st.w,r:st.r,...(st.loadType?{loadType:st.loadType}:{})}))}:null,weightConfirmedByUser:false};if(!last){next.weight=0;next.requireWeightConfirmation=true;}else if(Number(next.weight)===0)next.requireWeightConfirmation=true;return next;});
  const generated={...old,id:'reuse-'+Date.now(),date:getTodayStr(),status:'preview',source:'reused-plan',aiUsed:false,workout,reuseContext:reuseContext(),factors:{...old.factors,state,note,discomfortText:note,equipmentText:equipment,requestedTime:minutes},notice:`参考 ${snapshot.date} 的计划，未经教练重新评估；请逐项检查。`,userRequest:''};
  if(!LS.transaction({today_plan:generated,active_training:null})){if(msg)msg.textContent='旧计划未能保存，请重试。';return;}
  todayPlan=generated;renderTrainingPage();window.scrollTo(0,0);
}
function renderTrainingSetup(notice='') {
  setTrainingFixedAction(false);
  const draft=LS.get('setup_draft',{});
  setupSel=Object.assign(cloneData(DEFAULT_SETUP_STATE),{time:profile.quickTime||'45分钟',state:''},draft||{});
  const equipment=setupSel.equipmentText||profile.quickEquipment||(profile.coachIntakeFacts?.equipment||profile.equipment||[]).join('、');
  document.getElementById('trainingContent').innerHTML=`<div class="simple-heading"><span class="eyebrow">TODAY</span><h1>今天的训练</h1></div>${notice?`<div class="resume-banner">${escapeHtml(notice)}</div>`:''}
  <fieldset class="quick-field"><legend>可用时间</legend><div class="quick-options">${['30分钟','45分钟','60分钟'].map(v=>`<label><input type="radio" name="quickTime" value="${v}" ${setupSel.time===v?'checked':''}><span>${v}</span></label>`).join('')}<label><input type="radio" name="quickTime" value="other" ${!['30分钟','45分钟','60分钟'].includes(setupSel.time)?'checked':''}><span>其他</span></label></div><input id="customMinutes" class="setup-input mt-2" type="number" min="10" max="180" inputmode="numeric" placeholder="输入分钟数" value="${!['30分钟','45分钟','60分钟'].includes(setupSel.time)?escapeHtml(parseInt(setupSel.time)||''):''}" ${['30分钟','45分钟','60分钟'].includes(setupSel.time)?'hidden':''}></fieldset>
  <fieldset class="quick-field"><legend>今天状态 <span class="text-muted text-xs">选填</span></legend><div class="quick-options">${['正常','有点累','有不适'].map(v=>`<label><input type="radio" name="quickState" value="${v}" ${setupSel.state===v?'checked':''}><span>${v}</span></label>`).join('')}</div></fieldset>
  <div id="symptomAlert" class="danger-note" ${concerningSymptoms(setupSel.todayNote||'')?'':'hidden'}>你提到了胸痛、呼吸困难、晕厥、头晕或心悸等情况。如果目前存在，请停止运动并及时就医。<label class="data-consent"><input id="symptomClear" type="checkbox"> 我确认上述症状目前不存在</label></div>
  <div id="discomfortHint" class="danger-note" ${setupSel.state==='有不适'?'':'hidden'}>明显疼痛或异常症状时，请停止相关训练。请说明不适，以便调整计划。</div>
  <details class="simple-detail" ${setupSel.todayNote?'open':''}><summary>补充情况 <span>选填</span></summary><textarea id="coachToday" class="setup-input mt-2" rows="2" maxlength="700" placeholder="例如：右肩不舒服，今天想练下肢">${escapeHtml(setupSel.todayNote||'')}</textarea></details>
  <details class="simple-detail"><summary>可用器械 <span>${escapeHtml(equipment||'请填写')}</span></summary><input id="coachEquipment" class="setup-input mt-2" maxlength="300" value="${escapeHtml(equipment)}" placeholder="例如：健身房常用器械"></details>
  ${!profile.coachDataConsent?'<label class="data-consent"><input id="coachDataConsent" type="checkbox"> 我知道训练档案、身体限制和近期训练记录会发送给 DeepSeek，用于生成计划和训练复盘；我的姓名不会发送。</label>':''}
  <button class="btn btn-accent mt-3" onclick="confirmSetup()">查看今天计划</button>${getReusableSnapshot()?'<button class="btn btn-outline mt-3" onclick="reusePreviousPlan()">参考上次完整计划</button>':''}<div id="setupMsg" class="text-center text-muted text-sm mt-3" role="status"></div>`;
  const saveDraft=()=>{const t=document.querySelector('[name="quickTime"]:checked')?.value;const custom=document.getElementById('customMinutes').value;setupSel.time=t==='other'?(custom?custom+'分钟':'其他'):t||setupSel.time;setupSel.state=document.querySelector('[name="quickState"]:checked')?.value||'';setupSel.todayNote=document.getElementById('coachToday').value;setupSel.equipmentText=document.getElementById('coachEquipment').value;saveSetupDraft();};
  document.querySelectorAll('[name="quickTime"]').forEach(input=>input.addEventListener('change',()=>{document.getElementById('customMinutes').hidden=input.value!=='other';saveDraft();}));
  document.querySelectorAll('[name="quickState"]').forEach(input=>input.addEventListener('change',()=>{const warning=document.getElementById('discomfortHint');warning.hidden=input.value!=='有不适';if(input.value==='有不适')document.getElementById('coachToday').closest('details').open=true;saveDraft();}));
  ['customMinutes','coachToday','coachEquipment'].forEach(id=>document.getElementById(id).addEventListener('input',event=>{if(id==='coachToday'){document.getElementById('symptomAlert').hidden=!concerningSymptoms(event.target.value);document.getElementById('symptomClear').checked=false;}saveDraft();}));
}

function createLocalPlan() {
  const note=setupSel.todayNote||'';
  const focus=note.match(/胸|背|腿|肩|手臂|上肢|下肢|全身/)?.[0]||'综合训练';
  return {id:'coach-'+Date.now(),date:getTodayStr(),status:'preview',source:'coach-ai',focus,focusKey:focusKeyFromText(focus),factors:{time:setupSel.time||'45分钟',state:setupSel.state||'未提供',discomfortText:note,symptomClear:!!setupSel.symptomClear,equipmentText:setupSel.equipmentText||''},warmup:[],workout:[],stretch:[],notice:'教练根据阶段目标和训练记录拟定，确认后逐组带练。'};
}

function dynamicPlanPromptPayload(base, requestText='') {
  const knownEquipment=profile.coachIntakeFacts?(profile.coachIntakeFacts.equipment||[]):(profile.equipment||[]);
  return {profile:coachProfileContext(),recentRealSessions:coachRecentSessions(),today:{note:setupSel.todayNote||'',equipment:setupSel.equipmentText||knownEquipment.join('、'),minutes:setupSel.time||'45分钟',state:setupSel.state||'未提供',symptomStatus:setupSel.symptomClear?'用户确认所述症状目前不存在':''},phaseProgress:{completedSessions:trainingPhase?.completedSessions||0,startedAt:trainingPhase?.startedAt||'',weekCompleted:getWeekSessions().length,weeklyTarget:profile.trainingDays||null,focus:trainingPhase?.focus||'',reviewDate:trainingPhase?.reviewDate||'',nextStep:trainingPhase?.nextStep||''},previousGuides:{warmup:base.warmup||[],stretch:base.stretch||[]},previousPlan:(base.workout||[]).map(ex=>({name:ex.name,sets:ex.sets,reps:ex.reps,weight:ex.weight})),userRequest:requestText};
}

function validateDynamicAIPlan(items, base, candidates) {
  if(!Array.isArray(items)||items.length<2||items.length>8)throw new Error('计划动作数量不合理');
  const names=new Set();
  const workout=items.map(item=>{
    const name=String(item?.name||'').trim();
    if(name.length<2||name.length>50)throw new Error('计划包含无法识别的动作名称');
    const normalized=exerciseNameKey(canonicalExerciseName(name)).replace(/[\s·（）()\-]/g,'');
    if(names.has(normalized))throw new Error('计划包含重复动作');names.add(normalized);
    const sets=Number(item.sets),reps=Number(item.reps),weight=Number(item.weight),rest=Number(item.rest);
    if(!Number.isInteger(sets)||sets<1||sets>5||!Number.isInteger(reps)||reps<1||reps>30||!Number.isFinite(weight)||weight<0||weight>1000||!Number.isInteger(rest)||rest<20||rest>300)throw new Error('训练数字超出合理校验范围');
    const exact=(sessions||[]).slice(0,8).flatMap(s=>(s.exercises||[]).filter(ex=>sameExerciseName(ex.name,name)).flatMap(ex=>ex.sets||[]));
    const previous=exact.length?{weight:Math.max(...exact.map(x=>Number(x.w)||0)),reps:exact.at(-1)?.r}:null;
    if(!previous&&weight!==0)throw new Error(`“${name}”没有可核验的实际重量，建议重量应留空`);
    if(previous&&weight>previous.weight*1.15+2.5)throw new Error(`“${name}”建议重量高于近期实际记录的校验范围`);
    const instructions=Array.isArray(item.instructions)?item.instructions.map(x=>String(x).slice(0,180)).slice(0,6):String(item.instructions||'').split(/[。；\n]/).filter(Boolean).slice(0,6).map(x=>x.slice(0,180));
    if(instructions.length<2)throw new Error(`“${name}”缺少清楚的动作教学`);
    const last=exerciseHistoryFor(name,1)[0];
    const lastActual=last?{date:last.date,sets:last.sets.map(st=>({w:st.w,r:st.r,...(st.loadType?{loadType:st.loadType}:{})}))}:null;
    return {lastActual,id:'coach-ex-'+Math.random().toString(36).slice(2,10),name,role:item.role==='primary'?'核心':'辅助',sets,reps,weight,rest,purpose:String(item.purpose||'').slice(0,180),reason:String(item.reason||'').slice(0,180),instructions,pattern:'综合'};
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
  const base = todayPlan, user = currentUser, identity=requestIdentity(), profileAtStart=cloneData(profile), guideId=++coachGuidesRequest;
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
    if (!requestIdentityMatches(identity) || guideId!==coachGuidesRequest || !sameData(profile,profileAtStart) || currentUser !== user || todayPlan !== base || (base.status === 'active' && trainState.complete)) return;
    const next = {...base, warmup, stretch};
    if (!LS.set('today_plan', next)) throw new Error('补充安排保存失败，请重试');
    todayPlan = next;
    renderTrainingPage();
  } catch (error) {
    if (requestIdentityMatches(identity) && currentUser === user && todayPlan === base) showMessage(`未能补充：${error.message || '请重试'}。原计划和训练进度已保留。`);
  } finally {
    if(requestIdentityMatches(identity)&&guideId===coachGuidesRequest){coachGuidesBusy = false;
      const button = document.querySelector('[onclick="supplementCoachGuides()"]');
      if (button) { button.disabled = false; button.textContent = '请教练补充热身和拉伸'; }}
  }
}

async function adaptPlanWithAI(base, requestText='') {
  if(!getGlobalApiKey())return {plan:{...base,aiFailure:'请先在“我的”设置 DeepSeek API Key。'},usedAI:false,error:'请先设置 API Key'};
  setupSel={...setupSel,...(base.factors||{})};
  const payload=dynamicPlanPromptPayload(base,requestText);
  const prompt=`用户记录的阶段重点和下一次安排只是用户计划，不代表已经完成。只根据明确确认的名称关联比较历史记录，不要自己合并相似动作。标记为bodyweight的记录是用户确认的徒手动作；未标记的0kg不推断为徒手。你是用户长期合作的专业私人健身教练。根据档案、阶段目标、真实已完成训练和今天状态，独立制定或微调当天完整力量训练计划。动作库已弃用：请自行选择用户容易理解、当前器械可用、适合其经验的动作，使用清楚的通俗中文名称。如果现有阶段安排或旧总结与当前档案冲突，优先采用当前档案并提醒用户重新确认阶段安排。优先延续熟悉且有记录的有效动作；避免同一计划中训练目的相同的近似动作堆叠。每个动作提供2至6条可照做的步骤，说明起始姿势、动作过程和关键注意点；讲解不可声称已观察用户动作。考虑训练时间、疲劳、限制和不适，不诊断疾病；明显疼痛时给出保守安排并提醒停止诱发疼痛的动作。只把真实记录当成能力依据，不编造完成记录。动作有可核验记录时重量不得高于该动作近期最高实际重量15%再加2.5kg；没有精确记录时weight必须为0。动作2至8个，每个1至5组、1至30次、休息20至300秒；总组数按时间控制。根据最近真实记录、用户反馈和阶段安排，给每个动作写清依据或数据不足时如何保守开始；不要凭空声称动作标准或用户有余力。用户提出小调整时尽量保留其他安排并说明改动原因。必须生成完整的warmup和stretch数组，各1至6项，根据当天正式动作、器械和身体限制安排；每项包含通俗名称name和说明note，note写清如何做、次数或时长及注意点，不能只在summary里提建议。可用时间须包含热身、正式训练和拉伸，必要时减少正式训练组数。summary用一句简短中文说明今天最重要的安排，避免重复，安全提示不可省略。返回完整有效 JSON，不要markdown：{"warmup":[{"name":"热身动作名","note":"做法、次数或时长及注意点"}],"stretch":[{"name":"拉伸动作名","note":"做法、次数或时长及注意点"}],"exercises":[{"name":"通俗中文动作名","role":"primary|auxiliary","sets":3,"reps":8,"weight":0,"rest":90,"purpose":"训练作用","reason":"安排理由","instructions":["准备姿势","动作过程","关键注意点"]}],"summary":"今天的安排和依据，用通俗话说明"}。\n输入：${JSON.stringify(payload)}`;
  try {
    const raw=await aiCall(prompt,true);if(!raw)throw new Error('AI 暂不可用');
    const result=safeParseAIJson(raw),workout=validateDynamicAIPlan(result.exercises,base,[]);
    const warmup=validateCoachGuides(result.warmup,'热身'),stretch=validateCoachGuides(result.stretch,'拉伸');
    return {plan:{...base,workout,warmup,stretch,source:'coach-ai',aiUsed:true,notice:String(result.summary||'教练已结合你的记录和今天状态制定计划。').slice(0,300),aiFailure:''},usedAI:true};
  } catch(e) {return {plan:{...base,aiFailure:String(e.message||'AI 计划未通过校验').slice(0,180)},usedAI:false,error:e.message};}
}

async function generateTodayPlan() {
  const request=beginPlanRequest(), base=createLocalPlan();
  const result=await adaptPlanWithAI(base,'');
  if(!planRequestMatches(request)){if(requestIdentityMatches(request.identity)&&request.id===coachPlanRequest&&currentPage==='training'){const msg=document.getElementById('setupMsg');if(msg)msg.textContent='训练信息已变化，请重新生成计划。';}return null;}
  if(!result.usedAI){const msg=document.getElementById('setupMsg');if(currentPage==='training'&&msg)msg.textContent=`计划未生成：${result.error||'请检查网络与 AI 连接后重试'}。已有记录已保留。`;return null;}
  const generated={...result.plan,aiUsed:true,reuseContext:reuseContext()};
  if(!LS.transaction({today_plan:generated,active_training:null})){dataRecoveryNotice='计划保存失败，尚未开始训练。请重试。';const msg=document.getElementById('setupMsg');if(currentPage==='training'&&msg)msg.textContent=dataRecoveryNotice;return null;}
  todayPlan=generated;return generated;
}

async function confirmSetup() {
  const note=(document.getElementById('coachToday')?.value||'').trim();
  const selectedTime=document.querySelector('[name="quickTime"]:checked')?.value||setupSel.time||'45分钟';
  const custom=document.getElementById('customMinutes')?.value;
  const msg=document.getElementById('setupMsg');
  if(selectedTime==='other'&&(!Number.isInteger(Number(custom))||Number(custom)<10||Number(custom)>180)){msg.textContent='请输入 10 到 180 分钟。';return;}
  setupSel.time=selectedTime==='other'?`${Number(custom)}分钟`:selectedTime;
  setupSel.state=document.querySelector('[name="quickState"]:checked')?.value||'';
  if(concerningSymptoms(note)&&!document.getElementById('symptomClear')?.checked){msg.textContent='请先确认当前症状；如果仍有症状，请停止运动并及时就医。';document.getElementById('symptomAlert').hidden=false;return;}
  setupSel.symptomClear=concerningSymptoms(note)&&!!document.getElementById('symptomClear')?.checked;
  if(setupSel.state==='有不适'&&!note){msg.textContent='请补充不适情况，以便教练调整。';document.getElementById('coachToday').closest('details').open=true;return;}
  setupSel.todayNote=note;setupSel.equipmentText=(document.getElementById('coachEquipment')?.value||'').trim();
  saveSetupDraft();
  if(!getGlobalApiKey()){msg.textContent='请先到“我的”设置 DeepSeek API Key；已有完整计划时也可选择参考上次计划。';return;}
  if(!profile.coachDataConsent){if(!document.getElementById('coachDataConsent')?.checked){msg.textContent='请先确认训练信息将发送给 DeepSeek，再生成计划。';return;}const next={...profile,coachDataConsent:true};if(!LS.set('profile',next)){msg.textContent='无法保存设置，请重试。';return;}profile=next;}
  const nextProfile={...profile,quickTime:setupSel.time,quickEquipment:setupSel.equipmentText};if(LS.set('profile',nextProfile))profile=nextProfile;
  msg.textContent='正在安排今天的训练…';
  const btn=document.querySelector('#trainingContent .btn-accent');if(btn)btn.disabled=true;
  try{const user=currentUser,epoch=coachSessionEpoch;const generated=await generateTodayPlan();if(generated&&currentUser===user&&coachSessionEpoch===epoch&&currentPage==='training'){renderTrainingPage();window.scrollTo(0,0);}}
  catch(e){msg.textContent=`计划生成失败：${String(e.message||'请重试')}`;}
  finally{if(btn)btn.disabled=false;}
}

function exerciseInstructionBlock(exercise, targetId) {
  const steps=Array.isArray(exercise?.instructions)?exercise.instructions:[];
  return `<details class="instruction-detail" id="${escapeHtml(targetId)}"><summary>动作说明</summary>${exercise?.purpose?`<p class="reason-note">${escapeHtml(exercise.purpose)}</p>`:''}${steps.length?`<ol>${steps.map(step=>`<li>${escapeHtml(step)}</li>`).join('')}</ol>`:'<p>先用轻重量熟悉动作；不确定时暂停。</p>'}</details>`;
}

function compactCoachText(text, fallback='查看教练建议') {
  const value=String(text||'').trim();
  if(!value)return '';
  const first=value.match(/^[^。！？\n]+[。！？]?/)?.[0]?.trim()||value;
  return first.length<=55?first:fallback;
}

function renderPlanPreview() {
  setTrainingFixedAction(false);
  const items=todayPlan.workout.map((ex,index)=>`<details class="plan-exercise"><summary><span class="plan-number">${String(index+1).padStart(2,'0')}</span><span class="plan-ex-main"><strong>${escapeHtml(ex.name)}</strong><small>${ex.lastActual?'上次 '+escapeHtml(ex.lastActual.date)+' · '+(ex.lastActual.sets[0]?.loadType==='bodyweight'?'徒手':escapeHtml(ex.lastActual.sets[0]?.w)+' kg')+' × '+escapeHtml(ex.lastActual.sets[0]?.r)+' 次':'首次记录 · 重量待确认'}</small>${todayPlan.source==='reused-plan'?`<small>${Number(ex.weight)>0?'原计划重量 '+escapeHtml(ex.weight)+' kg':'本次重量待确认'}</small>`:''}</span><span class="plan-target">${ex.sets} 组 × ${ex.reps} 次</span></summary><div class="plan-ex-detail">${ex.reason?`<div class="reason-note">${escapeHtml(ex.reason)}</div>`:''}${exerciseInstructionBlock(ex,`coach-preview-${index}`)}<div class="edit-grid"><div class="edit-field"><label>组数</label><input type="number" min="1" max="5" value="${ex.sets}" oninput="updatePreviewField(${index},'sets',this.value)"></div><div class="edit-field"><label>次数</label><input type="number" min="1" max="30" value="${ex.reps}" oninput="updatePreviewField(${index},'reps',this.value)"></div><div class="edit-field"><label>重量 kg</label><input type="number" min="0" step="0.5" value="${ex.weight}" oninput="updatePreviewField(${index},'weight',this.value)"></div><div class="edit-field"><label>休息秒</label><input type="number" min="20" max="300" value="${ex.rest}" oninput="updatePreviewField(${index},'rest',this.value)"></div></div><button class="mini-btn mt-2" onclick="swapPlanExercise(${index})">替换动作</button>${renderExerciseLinkChoice(ex,index)}</div></details>`).join('');
  const warning=/疼|不适|停止|暂停|伤|异常/.test(todayPlan.notice||'');
  document.getElementById('trainingContent').innerHTML=`<div class="simple-heading"><span class="eyebrow">TODAY'S PLAN</span><h1>今天 · ${escapeHtml(todayPlan.focus||'训练')}</h1><p>${todayPlan.workout.length} 个动作 · ${escapeHtml(todayPlan.factors.time||'')}</p></div>${currentPlanNeedsReview()?'<div class="danger-note">训练档案或阶段安排已更新，此计划根据旧资料生成。请检查计划，或返回重新安排。</div>':''}${todayPlan.factors?.state==='有不适'?'<div class="danger-note">今天报告了不适。请先检查安排；出现明显疼痛或异常症状时停止相关训练。</div>':''}<div class="text-muted text-xs">${todayPlan.source==='reused-plan'?'这是上次计划，未根据今天重新评估；请检查动作和负重。':'AI 计划供参考，请结合实际状态检查动作和负重。'}</div>${todayPlan.notice?warning?`<div class="danger-note">${escapeHtml(todayPlan.notice)}</div>`:`<details class="simple-detail coach-brief"><summary>${escapeHtml(compactCoachText(todayPlan.notice))}</summary><p>${escapeHtml(todayPlan.notice)}</p></details>`:''}
  <details class="simple-detail"><summary>热身 <span>${(todayPlan.warmup||[]).length} 项</span></summary>${renderCoachGuidePreview(todayPlan.warmup,'训练前热身')}</details><div id="planChangeStatus" class="text-sm text-muted" role="status"></div><div class="plan-list">${items}</div><details class="simple-detail"><summary>拉伸 <span>${(todayPlan.stretch||[]).length} 项</span></summary>${renderCoachGuidePreview(todayPlan.stretch,'训练后拉伸')}</details>${!todayPlan.warmup?.length||!todayPlan.stretch?.length?missingCoachGuidesAction():''}<button class="btn btn-accent mt-3" onclick="startConfirmedPlan()">开始热身</button><details class="simple-detail"><summary>调整计划</summary><label class="setup-label" for="planRequest">告诉教练想改什么</label><textarea id="planRequest" class="setup-input" rows="2" maxlength="500">${escapeHtml(todayPlan.userRequest||'')}</textarea><button class="mini-btn mt-2" onclick="applyPlanRequest()">调整</button><div id="planRequestMsg" class="text-sm text-muted mt-2" role="status"></div></details><button class="text-action" onclick="discardTodayPlan()">修改今天的情况</button>`;
}

function renderExerciseLinkChoice(ex,index) {
  const names=exerciseHistoryNames().filter(name=>exerciseNameKey(name)!==exerciseNameKey(ex.name));
  const existing=exerciseAliasEntries().find(row=>exerciseNameKey(row.name)===exerciseNameKey(ex.name));
  if(!names.length&&!existing)return '';
  return `<details class="instruction-detail"><summary>关联已有动作记录</summary><p>只有确定是同一个动作时才关联；相同名称的记录会一起比较，历史原文不会修改。</p>${existing?`<p>当前关联：${escapeHtml(existing.canonical)}</p><button class="mini-btn" onclick="unlinkExercise(${index})">取消关联</button>`:''}${names.length?`<label class="setup-label" for="exercise-link-${index}">选择已有动作</label><select id="exercise-link-${index}" class="setup-input"><option value="">请选择</option>${names.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}</select><button class="mini-btn mt-2" onclick="linkExercise(${index})">确认关联</button>`:''}</details>`;
}
function linkExercise(index) {
  const ex=todayPlan?.workout?.[index], selected=document.getElementById(`exercise-link-${index}`)?.value;
  if(!ex||todayPlan.status!=='preview'||!selected||!exerciseHistoryNames().includes(selected)){planChangeMessage('请选择已有动作。');return;}
  if(!confirm(`确认“${ex.name}”与“${selected}”是同一个动作？`))return;
  const canonical=canonicalExerciseName(selected);
  if(todayPlan.workout.some((item,i)=>i!==index&&exerciseNameKey(canonicalExerciseName(item.name))===exerciseNameKey(canonical))){planChangeMessage('该动作已在今天的计划中，请检查后再关联。');return;}
  const aliases=exerciseAliasEntries().filter(row=>exerciseNameKey(row.name)!==exerciseNameKey(ex.name));
  if(exerciseNameKey(ex.name)!==exerciseNameKey(canonical))aliases.push({name:ex.name,canonical});
  const nextProfile={...profile,exerciseAliases:aliases},nextPlan=cloneData(todayPlan);
  const oldProfile=profile;profile=nextProfile;const last=exerciseHistoryFor(ex.name,1)[0];profile=oldProfile;
  nextPlan.workout[index].lastActual=last?{date:last.date,sets:last.sets.map(st=>({w:st.w,r:st.r,...(st.loadType?{loadType:st.loadType}:{})}))}:null;
  if(Number(ex.weight)===0&&!ex.weightConfirmedByUser)nextPlan.workout[index].requireWeightConfirmation=true;
  if(!LS.transaction({profile:nextProfile,today_plan:nextPlan})){planChangeMessage('关联未保存，请重试。');return;}
  profile=nextProfile;todayPlan=nextPlan;renderPlanPreview();
}
function unlinkExercise(index) {
  const ex=todayPlan?.workout?.[index];if(!ex||todayPlan.status!=='preview')return;
  if(!confirm(`取消“${ex.name}”的记录关联？`))return;
  const nextProfile={...profile,exerciseAliases:exerciseAliasEntries().filter(row=>exerciseNameKey(row.name)!==exerciseNameKey(ex.name))},nextPlan=cloneData(todayPlan);
  const oldProfile=profile;profile=nextProfile;const last=exerciseHistoryFor(ex.name,1)[0];profile=oldProfile;
  nextPlan.workout[index].lastActual=last?{date:last.date,sets:last.sets.map(st=>({w:st.w,r:st.r,...(st.loadType?{loadType:st.loadType}:{})}))}:null;
  if(!last&&!ex.weightConfirmedByUser){nextPlan.workout[index].weight=0;nextPlan.workout[index].requireWeightConfirmation=true;}
  else if(Number(ex.weight)===0&&!ex.weightConfirmedByUser)nextPlan.workout[index].requireWeightConfirmation=true;
  if(!LS.transaction({profile:nextProfile,today_plan:nextPlan})){planChangeMessage('取消关联未保存，请重试。');return;}
  profile=nextProfile;todayPlan=nextPlan;renderPlanPreview();
}

function planChangeMessage(message) {
  if(currentPage!=='training')return;
  const status=document.getElementById('planChangeStatus');if(status)status.textContent=message;
}
async function requestPlanChange(requestText,rememberRequest=false) {
  if(!todayPlan||todayPlan.status!=='preview')return;
  if(!profile.coachDataConsent){planChangeMessage('请返回今天的情况，确认资料发送后再使用教练调整。');return;}
  const request=beginPlanRequest(),base=cloneData(todayPlan);
  planChangeMessage('教练正在调整…');
  const result=await adaptPlanWithAI(base,requestText);
  if(!planRequestMatches(request)){if(requestIdentityMatches(request.identity)&&request.id===coachPlanRequest)planChangeMessage('计划或档案已变化，请重新调整。');return;}
  if(!result.usedAI){planChangeMessage(`${result.error||'暂时无法调整'}，原计划已保留。`);return;}
  const next=rememberRequest?{...result.plan,userRequest:requestText}:result.plan;
  if(!LS.set('today_plan',next)){planChangeMessage('调整结果保存失败，原计划已保留，请重试。');return;}
  todayPlan=next;if(currentPage==='training')renderPlanPreview();
}
async function retryAIPlan() { if(todayPlan)await requestPlanChange(todayPlan.userRequest||'',!!todayPlan.userRequest); }
async function applyPlanRequest() {
  const request=(document.getElementById('planRequest')?.value||'').trim();
  if(!request){planChangeMessage('告诉教练你想调整什么。');return;}
  await requestPlanChange(request,true);
}
async function swapPlanExercise(index) {if(!todayPlan?.workout?.[index])return;await requestPlanChange(`把第${index+1}个动作“${todayPlan.workout[index].name}”换成我更容易理解和完成的动作，训练作用保持一致。`);}
async function applyCoachPlanChange(request) {await requestPlanChange(request);}

function homeBackupReminder() {
  if(!(sessions||[]).length)return false;
  const now=Date.now(), last=Date.parse(profile.lastBackupRequestedAt||''), dismissed=Date.parse(profile.backupReminderDismissedAt||'');
  if(Number.isFinite(last)&&now-last<30*86400000)return false;
  if(Number.isFinite(dismissed)&&now-dismissed<7*86400000)return false;
  return true;
}
function dismissBackupReminder() {
  const next={...profile,backupReminderDismissedAt:new Date().toISOString()};
  if(LS.set('profile',next)){profile=next;renderHomePage();}
}
function openBackupSection() {
  navigate('profile');const section=document.getElementById('data-backup');if(section){section.open=true;section.scrollIntoView({block:'start'});}
}
function relativeSessionDate(date) {
  const parse=value=>{const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));return match?Date.UTC(+match[1],+match[2]-1,+match[3]):NaN;};
  const n=Math.round((parse(getTodayStr())-parse(date))/86400000);
  return Number.isFinite(n)&&n>=0?(n===0?'今天':n===1?'昨天':`${n} 天前`):String(date||'');
}
function renderHomePage() {
  if(!currentUser)return;
  const last=getLastSessionSummary(),active=todayPlan?.status==='active',preview=todayPlan?.status==='preview';
  const title=active?'继续训练':preview?'继续查看计划':!profile.onboardingComplete||!profile.coachSummary?'认识你的教练':'开始今天的训练';
  const detail=active||preview?`${todayPlan.workout.length} 个动作 · ${todayPlan.factors?.time||''}`:(profile.trainingDirection||'按照你的阶段目标安排');
  document.getElementById('homeContent').innerHTML=`${dataRecoveryNotice||LS.error?`<div class="danger-note">${escapeHtml(dataRecoveryNotice||LS.error)} <button class="mini-btn" onclick="navigate('profile')">备份与恢复</button></div>`:''}<header class="app-masthead"><div><div class="brand-word">IRONTRACK</div><div class="brand-meta">个人训练</div></div><div class="user-pill">${escapeHtml(currentUser)}</div></header><section class="home-hero"><div class="hero-kicker">${active?'训练进行中':preview?'计划待确认':'今天'}</div><div class="hero-title">${escapeHtml(title)}</div><div class="hero-summary">${escapeHtml(detail)}</div><button class="hero-action hero-button" onclick="navigate('training')"><span>${active?'继续训练':preview?'查看计划':'开始'}</span><span aria-hidden="true">→</span></button></section><div class="home-section-label">本周</div><div class="home-list"><div class="home-row" onclick="navigate('data')"><div><div class="home-row-value">${getWeekSessions().length}${profile.trainingDays?' / '+escapeHtml(profile.trainingDays):''} 次训练</div>${last?`<div class="home-row-label">上次 · ${escapeHtml(relativeSessionDate(last.date))} · ${escapeHtml(last.dayName||'训练')}</div>`:''}</div><span class="home-row-arrow">→</span></div></div>${homeBackupReminder()?'<div class="backup-reminder"><span>训练记录只保存在此设备，建议备份。</span><button onclick="openBackupSection()">去备份</button><button onclick="dismissBackupReminder()" aria-label="暂不提醒备份">×</button></div>':''}`;
}

function renderPlanPage() {
  if(!currentUser)return;
  const phase=profile.coachPhase||'先与教练确认训练目标。',last=(sessions||[]).find(row=>(row.exercises||[]).some(ex=>(ex.sets||[]).length));
  const reviewDate=trainingPhase?.reviewDate||'',due=reviewDate&&reviewDate<=getTodayStr();
  document.getElementById('systemContent').innerHTML=`<div class="simple-heading"><span class="eyebrow">YOUR PLAN</span><h1>训练路线</h1><p>本周 ${getWeekSessions().length}${profile.trainingDays?' / '+escapeHtml(profile.trainingDays):''} 次 · 本阶段 ${trainingPhase?.completedSessions||0} 次</p></div>${profile.coachPendingPhase?`<div class="danger-note"><strong>阶段调整建议</strong><p>${escapeHtml(profile.coachPendingPhase)}</p><button class="mini-btn" onclick="acceptCoachPhaseChange()">确认调整</button></div>`:''}<div class="route-goal"><span class="eyebrow">当前目标</span><strong>${escapeHtml(profile.trainingDirection||'逐步建立训练习惯')}</strong></div><div class="phase-summary"><div><span>阶段重点</span><strong>${escapeHtml(trainingPhase?.focus||'尚未填写')}</strong></div><div><span>下一步计划</span><strong>${escapeHtml(trainingPhase?.nextStep||'由教练结合实际记录安排')}</strong></div><div><span>复盘时间</span><strong>${escapeHtml(reviewDate||'尚未设定')}${due?' · 可复盘':''}</strong></div>${last?`<div><span>最近训练</span><strong>${escapeHtml(last.date)} · ${escapeHtml(last.dayName||'训练')}</strong></div>`:''}</div><details class="simple-detail"><summary>记录阶段重点与复盘时间</summary><p>根据你和教练确认的安排填写；不会自动创建训练或复盘。</p><label class="setup-label" for="phase-focus">阶段重点（选填）</label><input id="phase-focus" class="setup-input" maxlength="160" value="${escapeHtml(trainingPhase?.focus||'')}"><label class="setup-label mt-3" for="phase-next">下一步计划（选填）</label><input id="phase-next" class="setup-input" maxlength="160" value="${escapeHtml(trainingPhase?.nextStep||'')}"><label class="setup-label mt-3" for="phase-review">复盘日期（选填）</label><input id="phase-review" class="setup-input" type="date" value="${escapeHtml(reviewDate)}"><button class="mini-btn mt-2" onclick="savePhaseDetails()">保存阶段信息</button><div id="phase-msg" class="text-sm text-muted mt-2" role="status"></div></details><details class="simple-detail"><summary>教练建议</summary><p class="preserve-lines">${escapeHtml(phase)}</p></details><details class="simple-detail"><summary>教练对你的了解</summary>${coachProfileIsStale()?'<p>档案已更新，以下为此前的教练总结；阶段安排可能需要重新确认。</p>':''}<p class="preserve-lines">${escapeHtml(profile.coachSummary||'尚未建立')}</p><button class="mini-btn" onclick="renderOnboarding()">更新训练需求</button></details><button class="btn btn-accent mt-3" onclick="navigate('training')">进入训练</button>`;
}
function savePhaseDetails() {
  const focus=(document.getElementById('phase-focus')?.value||'').trim(),nextStep=(document.getElementById('phase-next')?.value||'').trim(),reviewDate=(document.getElementById('phase-review')?.value||'').trim(),msg=document.getElementById('phase-msg');
  if(reviewDate&&!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate)){msg.textContent='请填写有效的日期。';return;}
  const nextPhase={...trainingPhase,focus:focus.slice(0,160),nextStep:nextStep.slice(0,160),reviewDate};
  const changed=!sameData(nextPhase,trainingPhase),nextProfile=changed&&todayPlan?{...profile,coachPlanReviewId:todayPlan.id}:profile;
  if(!LS.transaction({training_phase:nextPhase,profile:nextProfile})){msg.textContent='未能保存，请重试。';return;}
  trainingPhase=nextPhase;profile=nextProfile;renderPlanPage();
}

function completeSet() {
  const s=trainState,ex=s.day.exercises[s.exIdx];if(s.weightNeedsConfirmation){alert('请先填写实际重量，或确认徒手。');return;}s.reps=validReps(s.reps,validReps(ex.reps,8));if(s.reps<1){alert('实际次数至少为 1。');return;}
  if(!s.records[ex.id])s.records[ex.id]=[];const row={set:s.set,w:s.weight,r:s.reps,...(s.weightMode==='bodyweight'?{loadType:'bodyweight'}:{}),confirmedAt:new Date().toISOString()};s.records[ex.id].push(row);s.lastConfirmed={exerciseId:ex.id,confirmedAt:row.confirmedAt};persistTrainingState();
  if(s.set<ex.sets){s.set++;startRestTimer();return;}
  advanceAfterExercise();
}

function confirmBodyweight() {
  trainState.weight=0;trainState.weightMode='bodyweight';trainState.weightNeedsConfirmation=false;persistTrainingState();renderTrainingPage();
}

function undoLastSet() {
  const s=trainState, last=s.lastConfirmed;
  if(!last||s.complete)return;
  const index=s.day.exercises.findIndex(ex=>ex.id===last.exerciseId), rows=s.records[last.exerciseId]||[];
  if(index<0||!rows.length||rows[rows.length-1].confirmedAt!==last.confirmedAt)return;
  const removed=rows.pop();if(s.restInterval)clearInterval(s.restInterval);
  s.isResting=false;s.restTimer=0;s.restEndAt=0;s.exIdx=index;s.set=removed.set;s.weight=removed.w;s.weightMode=removed.loadType||'';s.reps=removed.r;s.weightNeedsConfirmation=false;s.section='workout';s.lastConfirmed=null;
  persistTrainingState();renderTrainingPage();
}

function renderFinishPrompt() {
  setTrainingFixedAction(false);
  const s=trainState,actual=Object.values(s.records||{}).reduce((n,rows)=>n+rows.length,0);
  document.getElementById('trainingContent').innerHTML=`<div class="simple-heading"><span class="eyebrow">WORKOUT COMPLETE</span><h1>训练完成</h1><p>${formatTime(s.sessionTime||0)} · ${actual} 组</p></div><fieldset class="quick-field"><legend>今天感觉如何 <span class="text-muted text-xs">选填</span></legend><div class="quick-options">${['轻松','合适','吃力','有不适'].map(v=>`<label><input type="radio" name="sessionEffort" value="${v}" ${s.sessionFeedback===v?'checked':''}><span>${v}</span></label>`).join('')}</div></fieldset><details class="simple-detail" ${s.sessionDiscomfort?'open':''}><summary>补充说明 <span>选填</span></summary><textarea id="sessionDiscomfort" class="setup-input mt-2" rows="2" maxlength="500" placeholder="例如：右肩不舒服">${escapeHtml(s.sessionDiscomfort||'')}</textarea></details><div id="finishSafety" class="danger-note" ${concerningSymptoms(s.sessionDiscomfort||'')?'':'hidden'}>如果目前有胸痛、呼吸困难或头晕等症状，请停止运动并及时就医。</div><div id="finishMsg" class="text-center text-muted text-sm mt-2" role="status"></div><button class="btn btn-accent mt-3" onclick="confirmFinishTraining()">保存训练</button><button class="text-action" onclick="returnToWorkout()">返回训练</button>`;
  document.querySelectorAll('[name="sessionEffort"]').forEach(input=>input.addEventListener('change',()=>{s.sessionFeedback=input.value;if(input.value==='有不适')document.getElementById('sessionDiscomfort').closest('details').open=true;persistTrainingState();}));
  document.getElementById('sessionDiscomfort').addEventListener('input',event=>{s.sessionDiscomfort=event.target.value;document.getElementById('finishSafety').hidden=!concerningSymptoms(event.target.value);persistTrainingState();});
}

function renderComplete() {
  setTrainingFixedAction(false);
  const s=trainState,actual=Object.values(s.records||{}).reduce((n,rows)=>n+rows.length,0);
  const review=s.reviewSessionId && profile.coachLastReviewSessionId===s.reviewSessionId ? (profile.coachLastReview||'') : '';
  document.getElementById('trainingContent').innerHTML=`<div class="complete-container"><div class="complete-icon">✓</div><div class="complete-title">${s.saved?'训练记录已保存':'训练结束，等待保存'}</div><div class="complete-time">${escapeHtml(s.day?.name||'今日训练')} · ${actual} 组实际记录 · ${formatTime(s.sessionTime||0)}</div>${s.saveError?`<div class="danger-note">${escapeHtml(s.saveError)}</div>`:''}${review?(/疼|不适|停止|暂停|伤|异常/.test(review)?`<div class="danger-note">${escapeHtml(review)}</div>`:`<details class="simple-detail coach-brief"><summary>${escapeHtml(compactCoachText(review,'查看教练复盘'))}</summary><p>${escapeHtml(review)}</p></details>`):s.reviewing?'<div class="reason-note">教练正在结合今天的表现整理复盘…</div>':''}${profile.coachPendingPhase?`<div class="coach-review"><div class="section-title">教练建议调整阶段安排</div><p>${escapeHtml(profile.coachPendingPhase)}</p><button class="btn btn-accent" onclick="acceptCoachPhaseChange()">确认调整</button></div>`:''}${s.saved?'<button class="btn btn-accent mt-3" onclick="resetTraining();navigate(\'home\')">完成</button>':'<button class="btn btn-accent" onclick="retryFinishSave()">重试保存</button>'}<button class="btn btn-outline mt-3" onclick="navigate(\'home\')">返回首页</button></div>`;
}

function acceptCoachPhaseChange() {
  if(!profile.coachPendingPhase)return;
  const next={...profile,coachPhase:profile.coachPendingPhase,coachPendingPhase:''};
  const phase={startedAt:getTodayStr(),completedSessions:0};
  if(LS.transaction({profile:next,training_phase:phase})){profile=next;trainingPhase=phase;if(currentPage==='plan')renderPlanPage();else renderComplete();}
}

async function requestCoachReview(session) {
  const user=currentUser, state=trainState, identity=requestIdentity(), profileAtStart=cloneData(profile), phaseAtStart=cloneData(trainingPhase);
  if(!profile.coachDataConsent){renderComplete();return;}
  state.reviewing=true;renderComplete();
  let review='', pending='';
  try {
    const prompt=`你是用户持续合作的私人健身教练。根据阶段安排、历史真实完成记录和本次实际记录，用一至两句简短复盘，指出下次训练值得注意的一件事；必要的安全提示不得省略。不可把计划值当作完成值；数据不足就明确说不足；不作医疗诊断。日常动作、组数和重量调整无需确认；阶段目标、每周频率或整体训练方式明显变化时，必须给出建议并标记 needsConfirmation=true。没有明显变化时 nextPhase 留空。返回 JSON：{"review":"不超过180字的对用户复盘","needsConfirmation":false,"nextPhase":"仅填写需要用户确认的明显阶段调整建议"}\n阶段安排：${profile.coachPhase||''}\n历史：${JSON.stringify(coachRecentSessions(5).filter(row=>row.date!==session.date))}\n本次：${JSON.stringify(session)}`;
    const raw=await aiCall(prompt,true);if(!raw)throw new Error('AI 暂不可用');const result=safeParseAIJson(raw);
    review=String(result.review||'训练记录已保存，后续会结合连续表现继续观察。').slice(0,500);
    pending=result.needsConfirmation===true?String(result.nextPhase||'').slice(0,1800):'';
  } catch(e) {review='训练记录已保存。暂时无法生成 AI 复盘，之后打开时仍可结合这些实际记录继续安排。';}
  // 异步请求返回时可能已切换用户或开始另一场训练。
  if(!requestIdentityMatches(identity)||currentUser!==user||!sameData(profile,profileAtStart)||!sameData(trainingPhase,phaseAtStart)) {state.reviewing=false;return;}
  const history=LS.get('sessions',[]), index=history.findIndex(row=>row.id===session.id);
  if(index<0) return;
  // 不把更正之前的分析附在更正之后的记录上。
  const unchanged=sameData(history[index].exercises.map(ex=>ex.sets),session.exercises.map(ex=>ex.sets));
  if(unchanged) {
    const nextHistory=cloneData(history); nextHistory[index].coachReview=review;
    const nextProfile={...profile,coachLastReviewSessionId:session.id,coachLastReview:review,coachPendingPhase:pending||profile.coachPendingPhase||''};
    if(LS.transaction({sessions:nextHistory,profile:nextProfile})){sessions=nextHistory;profile=nextProfile;}
  }
  state.reviewing=false;
  if(trainState===state && currentPage==='training')renderComplete();
}

async function confirmFinishTraining() {
  const s=trainState;if(s.saved||!todayPlan){if(s.pendingCompletion)saveSession();renderComplete();return;}
  s.sessionDiscomfort=(document.getElementById('sessionDiscomfort')?.value||'').trim();s.sessionFeedback=(document.querySelector('[name="sessionEffort"]:checked')?.value||'');s.advancePpl=false;s.complete=true;
  if(s.timerInterval)clearInterval(s.timerInterval);if(s.restInterval)clearInterval(s.restInterval);persistTrainingState();
  const pendingSession={id:'session-'+todayPlan.id,date:getTodayStr(),dayName:todayPlan.focus||'训练',focusArea:todayPlan.focus||'训练',exercises:s.day.exercises.map(ex=>({name:ex.name,role:ex.role,targetSets:ex.sets,targetReps:ex.reps,targetWeight:ex.weight,completed:(s.records[ex.id]||[]).length>=ex.sets,status:(s.records[ex.id]||[]).length>=ex.sets?'completed':(s.records[ex.id]||[]).length?'partial':'not_started',feedback:'',sets:(s.records[ex.id]||[]).map(row=>({w:row.w,r:row.r,...(row.loadType?{loadType:row.loadType}:{}),confirmedAt:row.confirmedAt}))})),duration:s.sessionTime,sessionFeedback:s.sessionFeedback,sessionDiscomfort:s.sessionDiscomfort,source:todayPlan.source||'coach-ai'};
  s.reviewSessionId=pendingSession.id;
  s.saved=saveSession();
  if(!s.saved){renderComplete();return;}
  requestCoachReview(pendingSession);
}
