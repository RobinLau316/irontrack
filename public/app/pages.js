// ============ 数据页 ============
let selectedPerformanceExercise='';
function formatSetLoad(set) { return set?.loadType==='bodyweight'?'徒手':`${escapeHtml(set?.w ?? 0)} kg`; }
function selectPerformanceExercise(value) { selectedPerformanceExercise=value;renderDataChart(); }
function renderDataChart() {
  if(!currentUser)return;
  const container=document.getElementById('dataChart');renderSessionHistory();updateWeekStats();
  const archived=LS.get('sessions_archive',[]),all=[...(sessions||[]),...(Array.isArray(archived)?archived:[])],groups=new Map();
  for(const session of all){
    const current=new Map();
    for(const ex of (session.exercises||[])){
      if(!(ex.sets||[]).length)continue;
      const canonical=canonicalExerciseName(ex.name),key=exerciseNameKey(canonical),best=ex.sets.reduce((a,b)=>Number(b.w)>Number(a.w)?b:a),prior=current.get(key);
      if(!prior||Number(best.w)>Number(prior.set.w))current.set(key,{name:canonical,set:best});
    }
    for(const [key,item] of current){const group=groups.get(key)||{name:item.name,rows:[]};group.rows.push({date:session.date,set:item.set});groups.set(key,group);}
  }
  const items=[...groups.entries()];
  if(!items.length){container.innerHTML='<div class="data-empty">完成训练后，可查看动作记录。</div>';return;}
  if(!groups.has(selectedPerformanceExercise))selectedPerformanceExercise=(items.find(([,group])=>group.rows.length>=2)||items[0])[0];
  const group=groups.get(selectedPerformanceExercise),latest=group.rows[0],previous=group.rows[1];
  container.innerHTML=`<label class="setup-label" for="performance-exercise">选择动作</label><select id="performance-exercise" class="setup-input" onchange="selectPerformanceExercise(this.value)">${items.map(([key,item])=>`<option value="${escapeHtml(key)}" ${key===selectedPerformanceExercise?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select><div class="data-caption mt-3">每次最高重量对应的一组</div><div class="performance-row"><div><strong>最近 · ${escapeHtml(latest.date)}</strong><div class="performance-date">${previous?'上次 · '+escapeHtml(previous.date):'再记录一次可比较'}</div></div><div class="performance-values"><strong>${formatSetLoad(latest.set)} × ${escapeHtml(latest.set.r)} 次</strong>${previous?`<span>上次 ${formatSetLoad(previous.set)} × ${escapeHtml(previous.set.r)} 次</span>`:''}</div></div>`;
}

function renderSessionHistory() {
  const el = document.getElementById('sessionHistory');
  if (!el) return;
  const archived = LS.get('sessions_archive', []);
  const records = [...sessions.map((session,index)=>({session,index,source:'sessions'})), ...(Array.isArray(archived)?archived:[]).map((session,index)=>({session,index,source:'sessions_archive'}))];
  if (!records.length) { el.innerHTML = '<div class="text-muted text-sm">完成训练后，这里会显示每组实际记录。</div>'; return; }
  el.innerHTML = records.map(({session,index,source},position) => {
    const exercises = session.exercises || [];
    const totalSets = exercises.reduce((sum,ex)=>sum+(ex.sets||[]).length,0);
    const status=sessionIsComplete(session)?'完成训练':(totalSets?'部分训练':'没有已确认组');
    const detail=exercises.map((ex,ei)=>{
      const states={completed:'已完成',partial:'部分完成',skipped:'已跳过',not_started:'未开始'};
      const previous=records.slice(position+1).map(row=>({date:row.session.date,ex:(row.session.exercises||[]).find(item=>sameExerciseName(item.name,ex.name)&&(item.sets||[]).length)})).find(row=>row.ex);
      const previousText=previous?`<div class="reason-note">上次 ${escapeHtml(previous.date)}：${previous.ex.sets.map(st=>formatSetLoad(st)+' × '+escapeHtml(st.r)+'次').join('；')}</div>`:'';
      const rows=(ex.sets||[]).map((set,si)=>`<div class="history-set">第 ${si+1} 组：${set.loadType==='bodyweight'?'<span class="text-muted text-xs">徒手 · </span>':''}<input aria-label="第${si+1}组重量" type="number" min="0" max="1000" step="0.5" value="${escapeHtml(set.w)}" id="history-w-${position}-${ei}-${si}" readonly> kg × <input aria-label="第${si+1}组次数" type="number" min="1" max="100" step="1" value="${escapeHtml(set.r)}" id="history-r-${position}-${ei}-${si}" readonly> 次</div>`).join('');
      return `<div class="history-exercise"><strong>${escapeHtml(ex.name)}</strong> <span class="text-muted text-xs">${escapeHtml(states[ex.status]||((ex.sets||[]).length?'已记录':'未开始'))}</span>${previousText}${rows||'<div class="text-muted text-xs">没有已确认的组</div>'}${ex.feedback?`<div class="reason-note">${escapeHtml(ex.feedback)} ${escapeHtml(ex.feedbackNote||'')}</div>`:''}</div>`;
    }).join('');
    return `<details class="history-card" id="history-card-${position}"><summary><strong>${escapeHtml(session.dayName||session.focusArea||'训练')} · ${status}</strong><span class="text-muted text-xs"> ${escapeHtml(session.date)} · ${totalSets} 组</span></summary><div class="reason-note">${formatTime(session.duration||0)}${session.sessionFeedback?' · 感觉：'+escapeHtml(session.sessionFeedback):''}${session.sessionDiscomfort?' · 补充：'+escapeHtml(session.sessionDiscomfort):''}</div>${session.coachReview?`<div class="reason-note">教练复盘：${escapeHtml(session.coachReview)}</div>`:''}${detail}${totalSets?`<button class="mini-btn mt-2" onclick="editHistory(${position})">✎ 更正</button><button class="mini-btn mt-2 history-save" hidden onclick="saveHistoryCorrection('${source}',${index},${position})">保存更正</button>`:''}</details>`;
  }).join('');
}

function editHistory(position) {
  const card=document.getElementById(`history-card-${position}`);if(!card)return;
  card.querySelectorAll('.history-set input').forEach(input=>input.readOnly=false);
  card.classList.add('editing');
  const save=card.querySelector('.history-save');if(save)save.hidden=false;
}

function saveHistoryCorrection(source,index,position) {
  if (!['sessions','sessions_archive'].includes(source)) return;
  const stored=LS.get(source, []);
  if(!Array.isArray(stored)||!stored[index]) { alert('记录已变化，请重新打开后再修改。'); return; }
  const updated=cloneData(stored), session=updated[index];
  for(let ei=0;ei<session.exercises.length;ei++) for(let si=0;si<session.exercises[ei].sets.length;si++) {
    const w=document.getElementById(`history-w-${position}-${ei}-${si}`)?.value;
    const r=document.getElementById(`history-r-${position}-${ei}-${si}`)?.value;
    if(w===''||r===''||!Number.isFinite(Number(w))||Number(w)<0||Number(w)>1000||!Number.isInteger(Number(r))||Number(r)<1||Number(r)>100) { alert('请填写有效的重量（0–1000 kg）和次数（1–100）。');return; }
    const updatedSet={...session.exercises[ei].sets[si],w:Number(w),r:Number(r)};
    if(updatedSet.loadType==='bodyweight'&&updatedSet.w!==0)delete updatedSet.loadType;
    session.exercises[ei].sets[si]=updatedSet;
  }
  delete session.coachReview; // 旧复盘基于更正前的数据。
  if(!LS.set(source,updated)){alert('更正未能保存，请检查本机存储后重试。');return;}
  if(source==='sessions') sessions=updated;
  renderDataChart(); alert('训练记录已更正。已生成的计划不会自动改变。');
}

function updateWeekStats() {
  const weekStart = getWeekStart();
  const records = sessions.filter(session=>session.date>=weekStart);
  const completed = records.filter(sessionIsComplete);
  const totalSets = records.reduce((s, sess) => s + (sess.exercises||[]).reduce((es, ex) => es + (ex.sets||[]).length, 0), 0);
  const totalTime = records.reduce((s, sess) => s + (sess.duration||0), 0);
  const statsEl = document.getElementById('weekStats');
  if (statsEl) {
    const target = Math.max(1, profile.trainingDays);
    const pct = Math.min(100, Math.round(completed.length / target * 100));
    statsEl.innerHTML = `
      <div class="stat-item-2"><div class="val">${completed.length}</div><div class="lbl">完成训练</div></div>
      <div class="stat-item-2"><div class="val">${totalSets}</div><div class="lbl">总组数</div></div>
      <div class="stat-item-2"><div class="val">${Math.round(totalTime/60)}</div><div class="lbl">实际分钟</div></div>
      <div class="stat-item-2" style="grid-column:1/-1;text-align:left">
        <div class="row mb-1"><span class="lbl" style="font-size:14px">本周完成率</span><span class="font-bold text-accent" style="font-size:18px">${pct}%</span></div>
        <div class="progress-bar" style="height:10px"><div class="progress-fill" style="width:${pct}%;background:var(--accent)"></div></div>
        <div class="lbl" style="font-size:12px;margin-top:4px">目标 ${target} 次/周 · 已完成 ${completed.length} 次</div>
      </div>`;
  }
}

// ============ 我的页 ============
function renderProfilePage() {
  if (!currentUser) return;
  renderUserSection();
  renderProfileContent();
}

function renderUserSection() {
  const el = document.getElementById('userSection');
  const apiKey = getGlobalApiKey();
  const apiStatus = apiKey ? '<span class="api-status set">API 已设置</span>' : '<span class="api-status unset">API 未设置</span>';
  el.innerHTML = `
    <div class="user-section">
      <div>
        <div class="user-name">${escapeHtml(currentUser)}</div>
        <div style="font-size:14px;color:var(--muted);margin-top:2px">${apiStatus}</div>
      </div>
      <button class="user-action" onclick="switchUser()">切换用户</button>
    </div>`;
}

function renderPausedExerciseRows() {
  const paused = Object.entries(exercisePreferences?.paused || {});
  if (!paused.length) return '<div class="text-muted text-sm">暂无暂停推荐的动作。</div>';
  return `<div class="paused-list">${paused.map(([exerciseId,item]) => {
    const date = item?.pausedAt ? String(item.pausedAt).slice(0,10) : '';
    return `<div class="paused-row">
      <div><div class="paused-row-name">${escapeHtml(item?.name || '未命名动作')}</div><div class="paused-row-note">${escapeHtml(item?.note || '曾记录不适')}${date?' · '+date:''}</div></div>
      <button class="mini-btn" onclick="restorePausedExercise('${encodeURIComponent(exerciseId)}')">恢复推荐</button>
    </div>`;
  }).join('')}</div>`;
}

function restorePausedExercise(encodedId) {
  const exerciseId = decodeURIComponent(encodedId);
  if (!exercisePreferences?.paused?.[exerciseId]) return;
  delete exercisePreferences.paused[exerciseId];
  LS.set('exercise_preferences', exercisePreferences);
  renderProfileContent();
}

function renderProfileContent() {
  const container = document.getElementById('profileContent');
  const apiKey = getGlobalApiKey();
  container.innerHTML = `
      <details class="card"><summary class="section-title">训练档案</summary>
        <label class="setup-label" for="pf-direction">接下来几周，你最想改善什么？</label><textarea id="pf-direction" class="setup-input onboarding-answer" maxlength="500">${escapeHtml(profile.trainingDirection||profile.goal||'')}</textarea>
        <label class="setup-label mt-3" for="pf-days">通常每周能练几次？</label><input id="pf-days" class="setup-input" type="number" min="1" max="7" inputmode="numeric" value="${escapeHtml(profile.trainingDays)}">
        <label class="setup-label mt-3" for="pf-experience">你的训练经验（选填）</label><textarea id="pf-experience" class="setup-input onboarding-answer" maxlength="500">${escapeHtml(profile.experienceSummary||profile.experience||'')}</textarea>
        <label class="setup-label mt-3" for="pf-limitations">长期疼痛、动作限制或其他需要记住的事（选填）</label><textarea id="pf-limitations" class="setup-input onboarding-answer" maxlength="500">${escapeHtml(profile.limitations||'')}</textarea>
        <label class="setup-label mt-3" for="pf-note">补充一条训练档案（选填）</label><input id="pf-note" class="setup-input" maxlength="240" placeholder="例如：深蹲时希望多注意动作稳定"><button class="mini-btn mt-2" onclick="addTrainingNote()">保存这条信息</button>
        ${(profile.trainingNotes||[]).length?`<div class="reason-note mt-2">已记住：${(profile.trainingNotes||[]).slice(-5).map(escapeHtml).join(' · ')}</div>`:''}
      </details>
      <details class="card"><summary class="section-title">身体数据（选填）</summary><div class="grid-2 mt-3">
        <label class="field-group"><span class="field-label">身高 cm</span><input class="field-value" id="pf-height" type="number" value="${escapeHtml(profile.height)}"></label>
        <label class="field-group"><span class="field-label">体重 kg</span><input class="field-value" id="pf-weight" type="number" step="0.1" value="${escapeHtml(profile.weight)}"></label>
        <label class="field-group"><span class="field-label">体脂率 %</span><input class="field-value" id="pf-bodyfat" type="number" step="0.1" value="${escapeHtml(profile.bodyFat)}"></label>
      </div><div class="text-xs text-muted mt-2">只有修改体重或体脂时才会记录一个测量点；开始训练不会自动记录身体数据。</div></details>
      <details class="card" id="ai-settings"><summary class="section-title">AI 私人教练</summary>
        <div class="text-xs text-muted mt-2">教练会把你的训练档案、身体限制、当天状态和近期真实训练记录发送给 DeepSeek，用于对话、计划和复盘；姓名不会发送。首次使用时会请你确认。</div>
        ${profile.coachDataConsent?'<button class="mini-btn mt-2" onclick="revokeCoachDataConsent()">撤回训练资料发送确认</button>':''}
        <div class="field-group mt-3"><span class="field-label">DeepSeek API Key（保存在此浏览器，所有本地用户共用）</span>
          <div style="display:flex;gap:8px">
            <input class="field-value" id="pf-apiKey" type="password" value="${apiKey}" placeholder="sk-..." style="flex:1;border:none;outline:none;color:var(--text);background:var(--bg);font-size:15px">
            <button onclick="testApiKey()" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;white-space:nowrap;min-height:44px">测试连接</button>
          </div>
        </div>
        <div class="text-xs text-muted mt-2">在 <a href="https://platform.deepseek.com" target="_blank" rel="noopener" style="color:var(--accent)">platform.deepseek.com</a> 获取 Key。测试连接会发送一条简短测试消息；备份不包含 API Key。</div>
        <div id="apiTestMsg" class="text-xs mt-2" role="status"></div><button class="mini-btn mt-2" onclick="saveCoachApiKey()">保存 Key</button><button class="mini-btn mt-2" onclick="navigate('training')">返回训练</button>
      </details>
      <details class="card" id="data-backup" ${dataRecoveryNotice||LS.error?'open':''}><summary class="section-title">本地数据备份</summary>
        <div class="text-muted text-sm" style="line-height:1.6;margin-bottom:14px">训练数据只保存在当前浏览器。建议定期导出；备份不包含 API Key。${profile.lastBackupRequestedAt?`<br>上次发起导出：${escapeHtml(profile.lastBackupRequestedAt.slice(0,10))}（请确认文件已保存）`:'<br>尚未记录导出时间，换设备或清理浏览器前请先备份。'}</div>
        <div style="display:flex;gap:10px">
          <button class="mini-btn" style="flex:1" onclick="exportBackup()">导出备份</button>
          <button class="mini-btn" style="flex:1" onclick="document.getElementById('backupFile').click()">导入恢复</button>
        </div>
        <input id="backupFile" type="file" accept="application/json,.json" style="display:none" onchange="importBackupFile(this.files[0]);this.value=''">
        <div id="backupMsg" class="text-xs text-muted mt-3">${escapeHtml(dataRecoveryNotice || LS.error)}</div>
        ${renderRecoveryOptions()}
      </details>
      <button class="btn btn-accent" onclick="saveProfile()">保存修改</button>
      <div class="text-center text-xs text-muted mt-3" id="saveMsg"></div>`;
}

function revokeCoachDataConsent() {
  const next={...profile,coachDataConsent:false};
  if(!LS.set('profile',next)){alert('暂时无法保存，请重试。');return;}
  profile=next;renderProfileContent();
}

function saveProfile() {
  const requestedDays=Number(document.getElementById('pf-days').value);
  const validDays=Number.isInteger(requestedDays)&&requestedDays>=1&&requestedDays<=7;
  if(profile.onboardingComplete&&!validDays){document.getElementById('saveMsg').textContent='每周训练次数请填写 1 到 7。';return;}
  const days=validDays?requestedDays:(Number(profile.trainingDays)||0);
  const direction=document.getElementById('pf-direction').value.trim(), experience=document.getElementById('pf-experience').value.trim(), limitations=document.getElementById('pf-limitations').value.trim();
  const overrides={...(profile.coachProfileOverrides||{})};
  const changed={goal:direction!==(profile.trainingDirection||profile.goal||''),daysPerWeek:days!==Number(profile.trainingDays),experience:experience!==(profile.experienceSummary||profile.experience||''),limitations:limitations!==(profile.limitations||'')};
  if(changed.goal)overrides.goal=direction;
  if(changed.daysPerWeek)overrides.daysPerWeek=days;
  if(changed.experience)overrides.experience=experience;
  if(changed.limitations)overrides.limitations=limitations;
  const hasChanges=Object.values(changed).some(Boolean);
  const next={...profile,trainingDirection:direction,goal:direction,trainingDays:days,experienceSummary:experience,limitations,coachProfileOverrides:overrides,coachSummaryNeedsUpdate:!!profile.coachSummaryNeedsUpdate||hasChanges,coachPlanReviewId:hasChanges&&todayPlan?todayPlan.id:(profile.coachPlanReviewId||''),onboardingComplete:profile.onboardingComplete,planTemplate:'coach',aiPlanEnabled:true};
  ['height','weight','bodyFat'].forEach(key=>{const input=document.getElementById('pf-'+(key==='bodyFat'?'bodyfat':key));const value=Number(input?.value);if(Number.isFinite(value)&&value>0)next[key]=value;});
  if(['height','weight','bodyFat'].some(key=>next[key]!==profile[key])){next.coachBodyConfirmed=true;next.coachSummaryNeedsUpdate=true;if(todayPlan)next.coachPlanReviewId=todayPlan.id;}
  const changes={profile:next};
  if(next.weight!==profile.weight||next.bodyFat!==profile.bodyFat){
    const nextRecords=cloneData(bodyRecords);
    const measurement={date:getTodayStr(),weight:next.weight,bodyFat:next.bodyFat};
    const todayIndex=nextRecords.findIndex(item=>item.date===measurement.date);
    if(todayIndex>=0)nextRecords[todayIndex]={...nextRecords[todayIndex],...measurement};else nextRecords.push(measurement);
    changes.body_records=nextRecords;
  }
  if(!LS.transaction(changes)){document.getElementById('saveMsg').textContent='暂时无法保存，请导出备份后重试。';return;}
  profile=next;
  if(changes.body_records)bodyRecords=changes.body_records;
  const keySaved=setGlobalApiKey(document.getElementById('pf-apiKey').value.trim());

  var msg = document.getElementById('saveMsg');
  msg.textContent = keySaved?'已保存':'训练档案已保存，但 AI Key 未保存，请检查浏览器存储。';
  setTimeout(function(){ msg.textContent = ''; }, 2000);
  renderUserSection();
  renderHomePage();
}

function addTrainingNote() {
  const input=document.getElementById('pf-note'), value=(input?.value||'').trim();
  if(!value)return;
  const next={...profile,trainingNotes:[...(profile.trainingNotes||[]),value].slice(-30),coachSummaryNeedsUpdate:true,coachPlanReviewId:todayPlan?.id||profile.coachPlanReviewId||''};
  if(!LS.transaction({profile:next})){document.getElementById('saveMsg').textContent='暂时无法保存这条信息。';return;}
  profile=next;renderProfileContent();
  const msg=document.getElementById('saveMsg');if(msg)msg.textContent='已记住这条训练信息。';
}

function saveCoachApiKey() {
  const key=(document.getElementById('pf-apiKey')?.value||'').trim(),msg=document.getElementById('apiTestMsg');
  if(!key){msg.textContent='请输入 API Key。';return;}
  if(!setGlobalApiKey(key)){msg.textContent='Key 未能保存，请检查浏览器存储。';return;}
  msg.textContent='Key 已保存在此浏览器，可测试连接或返回训练。';renderUserSection();
}
async function testApiKey() {
  const field=document.getElementById('pf-apiKey'),key=(field?.value||'').trim(),msg=document.getElementById('apiTestMsg'),identity=requestIdentity();
  if(!key){msg.textContent='请输入 API Key。';return;}
  msg.textContent='正在测试连接…';const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try {
    const res=await fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:'deepseek-chat',messages:[{role:'user',content:'回复"OK"'}],max_tokens:5}),signal:controller.signal});
    if(!requestIdentityMatches(identity))return;
    if(document.getElementById('pf-apiKey')!==field||field.value.trim()!==key){msg.textContent='输入已变化，请重新测试。';return;}
    if(!res.ok){msg.textContent=res.status===401||res.status===403?'连接未通过，请检查 Key 和账号权限。':res.status===429?'请求受限，请稍后重试。':'连接失败，请检查网络和服务状态后重试。';return;}
    if(!setGlobalApiKey(key)){msg.textContent='连接成功，但 Key 未保存，请检查浏览器存储。';return;}
    msg.textContent='连接成功，Key 已保存在此浏览器。';renderUserSection();
  }catch(e){if(requestIdentityMatches(identity)&&document.getElementById('pf-apiKey')===field)msg.textContent='连接失败，请检查网络后重试；已输入的 Key 保留。';}
  finally{clearTimeout(timer);}
}

const RECOVERY_KEYS = ['pre_import_backup','pre_restore_backup','compat_recovery','catalog_compat_recovery_v1','imported_recovery'];

function recoveryBundle() {
  const bundle = {};
  RECOVERY_KEYS.forEach(key => { const value = LS.get(key,null); if(value!=null)bundle[key]=value; });
  if (pendingRecoveryData) bundle.unsaved = pendingRecoveryData;
  if (LS.pending) bundle.interruptedWrite = LS.pending;
  return bundle;
}

function buildBackupPayload(includePending=true) {
  const data = {};
  USER_DATA_KEYS.forEach(key => { data[key] = LS.get(key, null); });
  if (isPlainRecord(data.profile)) { data.profile={...data.profile}; delete data.profile.coachDataConsent; }
  if (includePending) Object.assign(data, normalizeUserData(data).data);
  if (includePending && todayPlan?.status === 'active' && trainState.day) {
    data.today_plan = todayPlan;
    data.active_training = { version:1, planId:todayPlan.id, savedAt:new Date().toISOString(), state:{...trainState,timerInterval:null,restInterval:null} };
  }
  if (includePending && trainState.pendingCompletion && !trainState.saved) Object.assign(data, completionData(trainState.pendingCompletion));
  const payload = { app:'IronTrack', version:BACKUP_VERSION, user:currentUser, exportedAt:new Date().toISOString(), data };
  if (includePending) payload.recovery = recoveryBundle();
  return payload;
}

function downloadData(payload, filename) {
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportBackup() {
  downloadData(buildBackupPayload(), `irontrack-backup-${getTodayStr()}.json`);
  const next={...profile,lastBackupRequestedAt:new Date().toISOString()};
  if(LS.set('profile',next))profile=next;
  const msg = document.getElementById('backupMsg');
  if (msg) msg.textContent = '已生成备份，请确认文件已保存；包含当前训练和归档，API Key 未包含。';
}

function renderRecoveryOptions() {
  const hasRecovery = RECOVERY_KEYS.some(key=>LS.get(key,null)) || pendingRecoveryData || LS.pending;
  return `<div class="mt-3">
    ${LS.blocked ? '<button class="mini-btn" onclick="retryStorageRecovery()">重试本地写入恢复</button>' : ''}
    ${LS.get('pre_import_backup',null) ? '<button class="mini-btn" data-snapshot="pre_import_backup" onclick="restoreRecoverySnapshot(this.dataset.snapshot)">恢复导入前快照</button>' : ''}
    ${LS.get('pre_restore_backup',null) ? '<button class="mini-btn" data-snapshot="pre_restore_backup" onclick="restoreRecoverySnapshot(this.dataset.snapshot)">撤销上次快照恢复</button>' : ''}
    ${LS.get('catalog_compat_recovery_v1',null) ? '<button class="mini-btn" data-snapshot="catalog_compat_recovery_v1" onclick="restoreRecoverySnapshot(this.dataset.snapshot)">恢复动作兼容前快照</button>' : ''}
    ${hasRecovery ? '<button class="mini-btn" onclick="exportRecoveryData()">导出恢复资料</button><div class="reason-note">异常原文单独保留，不参与统计；可导出检查，修正后通过备份导入。恢复完整快照会覆盖当前数据。</div>' : ''}
  </div>`;
}

function exportRecoveryData() {
  downloadData({app:'IronTrackRecovery',version:1,user:currentUser,exportedAt:new Date().toISOString(),recovery:recoveryBundle()}, `irontrack-recovery-${getTodayStr()}.json`);
}

function retryStorageRecovery() {
  if (trainState.pendingCompletion && !trainState.saved) {
    LS.recover();
    finishTraining();
    navigate('training');
    return;
  }
  initUserData();
  renderProfilePage();
}

function checkedBackup(payload) {
  if (!isPlainRecord(payload) || payload.app !== 'IronTrack' || ![1,2,3].includes(Number(payload.version)) || !isPlainRecord(payload.data)) throw new Error('文件格式或版本不支持');
  if (!isPlainRecord(payload.data.profile) || !isPlainRecord(payload.data.plan) || !Array.isArray(payload.data.sessions)) throw new Error('备份缺少个人档案、训练体系或历史记录');
  if(payload.recovery!=null&&!isPlainRecord(payload.recovery))throw new Error('恢复资料格式异常');
  const data=normalizeUserData(payload.data,true).data;
  data.profile.coachDataConsent=false;
  return data;
}

function setBackupMessage(text) {
  const msg = document.getElementById('backupMsg');
  if (msg) msg.textContent = text;
}

function applyBackupPayload(payload, snapshotKey='pre_import_backup') {
  const data = checkedBackup(payload);
  const before = buildBackupPayload(false);
  const beforeMarker = LS.get('catalog_migration_v1','');
  const beforeRecovery = LS.get('imported_recovery',null);
  if (!LS.set(snapshotKey,before)) throw new Error('无法保存操作前快照，未覆盖当前数据');
  const changes = {...data, catalog_migration_v1:''};
  if(payload.recovery && Object.keys(payload.recovery).length) changes.imported_recovery = payload.recovery;
  if (!LS.transaction(changes)) throw new Error(LS.blocked ? '写入失败且回滚未完成，已暂停写入；操作前快照仍保留，请导出恢复资料' : '写入失败，已核验恢复操作前数据');
  // Validation is pure and completes before the first write. Rendering is not part of the commit.
  try { initUserData(); }
  catch(e) {
    const restored = LS.transaction({...before.data, catalog_migration_v1:beforeMarker, imported_recovery:beforeRecovery});
    if (restored) {
      try { initUserData(); } catch(ignore) { /* The original snapshot remains available. */ }
    }
    throw new Error(restored ? '恢复后的初始化失败，已恢复操作前数据' : '恢复后的初始化失败，自动回滚未完成；请导出操作前快照');
  }
  try { renderProfilePage(); }
  catch(e) { console.error('数据已恢复，页面展示失败:',e); navigate('profile'); }
}

async function importBackupFile(file) {
  if (!file) return;
  const owner = currentUser;
  try {
    const payload = JSON.parse(await file.text());
    if(owner!==currentUser)throw new Error('用户已切换，请在当前用户下重新选择文件');
    const data = checkedBackup(payload);
    const total = data.sessions.length+data.sessions_archive.length;
    if (!confirm(`备份时间：${payload.exportedAt||'未知'}\n训练记录（含归档）：${total} 条\n\n确认恢复并覆盖当前本地数据吗？操作前会保存快照。`)) return;
    applyBackupPayload(payload);
    setBackupMessage('恢复成功，已兼容旧版字段；操作前数据可通过下方快照恢复。');
  } catch(e) { setBackupMessage('导入未完成：'+e.message); }
}

function restoreRecoverySnapshot(key) {
  if(!['pre_import_backup','pre_restore_backup','catalog_compat_recovery_v1'].includes(key))return;
  try {
    const snapshot = LS.get(key,null);
    if(!snapshot)throw new Error('快照不存在');
    const payload = snapshot.app === 'IronTrack' ? snapshot : {...buildBackupPayload(false),data:{...buildBackupPayload(false).data,...snapshot.data}};
    checkedBackup(payload);
    if(!confirm('恢复此快照会覆盖当前数据。当前数据也会保存为可撤销快照，是否继续？'))return;
    applyBackupPayload(payload,'pre_restore_backup');
    setBackupMessage('快照已恢复。可通过“撤销上次快照恢复”返回操作前状态。');
  } catch(e) { setBackupMessage('快照未恢复：'+e.message+'；原快照仍可导出检查。'); }
}
