// ============ 训练页（动态四板块：热身/正式/拉伸/饮食） ============
let trainState = {};

function resetTraining() {
  if (!currentUser) return;
  if (trainState.pendingCompletion && !trainState.saved) { alert('本次训练尚未保存，请先重试保存或导出备份。'); return; }
  if (trainState.timerInterval) clearInterval(trainState.timerInterval);
  if (trainState.restInterval) clearInterval(trainState.restInterval);
  todayPlan = null;
  LS.set('today_plan', null);
  LS.set('active_training', null);
  trainState = {};
}

function updatePreviewField(index,key,value) {
  const ex=todayPlan?.workout?.[index];
  if(!ex||String(value).trim()==='')return;
  const num=Number(value),limits={sets:[1,5],reps:[1,30],weight:[0,1000],rest:[20,300]}[key];
  if(!limits||!Number.isFinite(num)||num<limits[0]||num>limits[1]||(key!=='weight'&&!Number.isInteger(num))){renderPlanPreview();planChangeMessage('数值超出允许范围，请检查。');return;}
  const next=cloneData(todayPlan),changed=next.workout[index];
  changed[key]=key==='weight'?Math.round(num*2)/2:Math.round(num);
  if(key==='weight'){changed.weightConfirmedByUser=true;changed.requireWeightConfirmation=false;}
  changed.reason='用户在计划预览中手动调整';
  if(!LS.set('today_plan',next)){renderPlanPreview();planChangeMessage('修改未保存，原计划已保留，请重试。');return;}
  todayPlan=next;
}

function startConfirmedPlan() {
  const next={...todayPlan,status:'active',startedDate:todayPlan.startedDate||getTodayStr()};
  if(!LS.transaction({today_plan:next,active_training:null})){dataRecoveryNotice='计划尚未保存，未开始训练。请重试或先导出备份。';renderPlanPreview();return;}
  todayPlan=next;LS.set('setup_draft', null);
  initDynamicTraining();
  renderTrainingPage();
  window.scrollTo(0, 0);
}

function discardTodayPlan() {
  todayPlan = null;
  trainState = {};
  LS.set('today_plan', null);
  LS.set('active_training', null);
  renderTrainingSetup();
  window.scrollTo(0, 0);
}

function needsWeightConfirmation(ex) { return !!ex && ['coach-ai','reused-plan'].includes(todayPlan?.source) && (!ex.lastActual || ex.requireWeightConfirmation) && !ex.weightConfirmedByUser && Number(ex.weight)===0; }

function initDynamicTraining() {
  const tp = todayPlan;
  const exercises = tp.workout;
  trainState = {
    day: { name: (tp.focus||'训练')+'训练日', focus: tp.focus||'', exercises: exercises },
    exIdx: 0, set: 1,
    weight: exercises[0] ? exercises[0].weight||0 : 0,
    reps: exercises[0] ? exercises[0].reps||8 : 8,
    weightNeedsConfirmation:needsWeightConfirmation(exercises[0]),weightMode:'',
    records: {}, feedback:{}, skipped:{}, pendingFeedback:null, isResting: false, restTimer: 0, restEndAt:0, sessionTime: 0, complete: false,
    sessionFeedback:'',sessionDiscomfort:'',advancePpl:null,
    section: 'warmup',   // warmup | workout | stretch | nutrition
    warmupDone: [], stretchDone: [],
    timerInterval: null, restInterval: null
  };
  persistTrainingState();
  startSessionTimer();
}

function restoreDynamicTraining(saved = LS.get('active_training', null)) {
  if (!saved || saved.planId !== todayPlan.id || !saved.state) {
    initDynamicTraining();
    return;
  }
  trainState = saved.state;
  trainState.timerInterval = null;
  trainState.restInterval = null;
  trainState.feedback = trainState.feedback || {};
  trainState.skipped = trainState.skipped || {};
  trainState.pendingFeedback = trainState.pendingFeedback || null;
  if (trainState.isResting && trainState.restEndAt) {
    trainState.restTimer = Math.max(0, Math.ceil((trainState.restEndAt-Date.now())/1000));
    if (trainState.restTimer <= 0) trainState.isResting = false;
  }
  startSessionTimer();
  if (trainState.isResting) resumeRestTimer();
}

function persistTrainingState() {
  if (!currentUser || !todayPlan || todayPlan.status !== 'active' || !trainState.day) return;
  const snapshot = Object.assign({}, trainState, { timerInterval:null, restInterval:null });
  const ok = LS.set('active_training', { version:1, planId:todayPlan.id, savedAt:new Date().toISOString(), state:snapshot });
  if (!ok) dataRecoveryNotice = '进行中训练尚未写入本地，请在结束前重试保存或导出备份。';
  return ok;
}

function startSessionTimer() {
  if (trainState.timerInterval) clearInterval(trainState.timerInterval);
  trainState.timerInterval = setInterval(() => {
    if (!trainState.complete) {
      trainState.sessionTime++;
      if (trainState.sessionTime % 5 === 0) persistTrainingState();
    }
  }, 1000);
}

function startRestTimer() {
  const ex = trainState.day.exercises[trainState.exIdx];
  trainState.restTimer = ex.rest || 90;
  trainState.isResting = true;
  trainState.restEndAt = Date.now() + trainState.restTimer * 1000;
  persistTrainingState();
  resumeRestTimer();
}

function resumeRestTimer() {
  if (trainState.restInterval) clearInterval(trainState.restInterval);
  trainState.restInterval = setInterval(() => {
    trainState.restTimer = Math.max(0, Math.ceil((trainState.restEndAt-Date.now())/1000));
    if (trainState.restTimer > 0) {
      if (trainState.restTimer % 5 === 0) persistTrainingState();
    } else {
      clearInterval(trainState.restInterval);
      trainState.isResting = false;
      trainState.restEndAt = 0;
      persistTrainingState();
      renderTrainingPage();
    }
    if (trainState.isResting) renderRestOverlay();
  }, 1000);
  renderRestOverlay();
}

function renderTrainingPage() {
  if (!currentUser) return;
  if (!todayPlan) { renderTrainingSetup(); return; }
  if (todayPlan.status === 'preview') { renderPlanPreview(); return; }
  const s = trainState;
  if (s.complete) { renderComplete(); return; }
  if (s.section === 'finish') { renderFinishPrompt(); return; }
  if (s.isResting) { renderRestOverlay(); return; }
  if (s.pendingFeedback) { renderFeedbackPrompt(); return; }
  renderTrainingUI();
}

function setSection(sec) {
  if (trainState.complete || trainState.isResting) return;
  trainState.section = sec;
  persistTrainingState();
  if(sec==='finish'){renderFinishPrompt();return;}
  renderTrainingUI();
  window.scrollTo(0, 0);
}

function renderSectionTabs() {
  const s = trainState;
  const warmupAll = todayPlan.warmup.length > 0 && s.warmupDone.length === todayPlan.warmup.length;
  const workoutDone = isWorkoutDone();
  const stretchAll = todayPlan.stretch.length > 0 && s.stretchDone.length === todayPlan.stretch.length;
  const tabs = [
    {k:'warmup', label:'热身', done:warmupAll},
    {k:'workout', label:'正式', done:workoutDone},
    {k:'stretch', label:'拉伸', done:stretchAll},
    {k:'finish', label:'结束', done:false}
  ];
  return `<div class="section-tabs">${tabs.map(t =>
    `<div class="section-tab ${s.section===t.k?'active':''}" onclick="setSection('${t.k}')">${t.label}${t.done?'<span class="done-mark">✓</span>':''}</div>`
  ).join('')}</div>`;
}

function isWorkoutDone() {
  return todayPlan.workout.every(ex => (trainState.records[ex.id]||[]).length >= ex.sets || (trainState.skipped||{})[ex.id]);
}

function renderWarmup() {
  const s = trainState;
  const items = todayPlan.warmup;
  if (!items || items.length === 0) {
    return `<div class="card"><div class="text-muted text-sm">这份旧计划尚未包含热身安排，可请教练补充。</div>${missingCoachGuidesAction()}</div>
      <button class="btn btn-accent mt-3" onclick="setSection('workout')">开始正式训练</button>`;
  }
  return `
    <div class="card">
      <div class="section-title">热身（${s.warmupDone.length}/${items.length}）</div>
      <div class="guide-list">
        ${items.map((it,i) => `
          <div>
            <div class="guide-check ${s.warmupDone.includes(i)?'on':''}" onclick="toggleGuide('warmup',${i})">✓</div>
            <div class="guide-info"><div class="guide-name">${escapeHtml(it.name)}</div>${it.note?`<div class="guide-note">${escapeHtml(it.note)}</div>`:''}</div>
          </div>`).join('')}
      </div>
    </div>
    <button class="btn btn-accent mt-3" onclick="setSection('workout')">开始正式训练</button>`;
}

function renderWorkout() {
  const s = trainState;
  const ex = s.day.exercises[s.exIdx];
  s.reps = validReps(s.reps, validReps(ex.reps, 8));
  if (s.reps < 1) { alert('实际次数至少为 1；未完成的训练可以直接结束并记录已完成组。'); return; }
  const recs = s.records[ex.id] || [];
  return `
    <div class="training-container workout-focus">
      <div class="hero-kicker text-center">动作 ${s.exIdx+1} / ${s.day.exercises.length} · ${escapeHtml(ex.role||'辅助')}</div>
      <div class="exercise-name">${escapeHtml(ex.name)}${ex.isNew?'<span class="new-exercise-badge">新动作</span>':''}</div>
      <div class="exercise-target">目标 ${s.weightNeedsConfirmation?'重量待确认':ex.weight+'kg'} · ${ex.sets}组×${ex.reps}次</div>${ex.lastActual?`<div class="reason-note text-center">上次 ${escapeHtml(ex.lastActual.date)}：${ex.lastActual.sets.map(row=>(row.loadType==='bodyweight'?'徒手':escapeHtml(row.w)+'kg')+' × '+escapeHtml(row.r)+'次').join('；')}</div>`:''}
      ${!ex.lastActual && ex.instructions?.[0] && ex.instructions[0].length<=45?`<div class="reason-note text-center">${escapeHtml(ex.instructions[0])}</div>`:''}${exerciseInstructionBlock(ex,`workout-instruction-${s.exIdx}`)}
      <div id="weightConfirmHint" class="reason-note text-center" ${s.weightNeedsConfirmation?'':'hidden'}>请填写实际重量，或 <button class="inline-action" onclick="confirmBodyweight()">确认徒手</button></div>
      <div class="control-label text-center">本组重量</div>
      <div class="num-control">
        <div class="num-btn" onclick="adjustWeight(-2.5)">−</div>
        <div class="num-display"><input class="big reps-input weight-input" type="text" inputmode="decimal" value="${s.weightNeedsConfirmation?'':s.weight}" placeholder="—" aria-label="训练重量" onfocus="focusTrainingInput(this)" onkeydown="handleWeightKey(event,this)" onblur="commitWeightInput(this)"><div class="unit">kg</div></div>
        <div class="num-btn" onclick="adjustWeight(2.5)">+</div>
      </div>
      <div class="control-label text-center">本组次数</div>
      <div class="num-control">
        <div class="num-btn" onclick="adjustReps(-1)">−</div>
        <div class="num-display"><input class="small reps-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${s.reps}" aria-label="训练次数" onfocus="focusTrainingInput(this)" onkeydown="handleRepsKey(event,this)" onblur="commitRepsInput(this)"><div class="unit">次</div></div>
        <div class="num-btn" onclick="adjustReps(1)">+</div>
      </div>
      <div class="set-indicator">第 ${s.set} 组 / 共 ${ex.sets} 组 · 动作 ${s.exIdx+1}/${s.day.exercises.length}</div>

      ${recs.length > 0 ? `<div class="set-history">${recs.map(r=>`<span class="set-dot">组${r.set}:${r.w}×${r.r}</span>`).join('')}</div>` : ''}
    </div>
    <div class="training-actions">
      <div id="workoutMore" class="workout-more">
        ${s.lastConfirmed?'<button class="btn btn-outline" onclick="undoLastSet()">撤销上一组</button>':''}<button class="btn btn-outline" onclick="skipExercise()">跳过当前动作</button>
        <button class="btn btn-outline" onclick="finishTraining()">结束并记录已完成组</button>
      </div>
      <button class="training-more-toggle" onclick="toggleWorkoutActions()">更多操作 · 跳过动作</button>
      <button class="btn btn-accent" onclick="completeSet()">完成第 ${s.set} 组</button>
    </div>`;
}

function toggleWorkoutActions() {
  const panel = document.getElementById('workoutMore');
  if (panel) panel.classList.toggle('open');
}

function renderStretch() {
  const s = trainState;
  const items = todayPlan.stretch;
  if (!items || items.length === 0) {
    return `<div class="card"><div class="text-muted text-sm">这份旧计划尚未包含训练后拉伸安排，可请教练补充。</div>${missingCoachGuidesAction()}</div>
      <button class="btn btn-accent mt-3" onclick="finishTraining()">结束训练</button>${s.lastConfirmed?'<button class="text-action" onclick="undoLastSet()">撤销上一组</button>':''}`;
  }
  return `
    <div class="card">
      <div class="section-title">拉伸放松（${s.stretchDone.length}/${items.length}）</div>
      <div class="guide-list">
        ${items.map((it,i) => `
          <div>
            <div class="guide-check ${s.stretchDone.includes(i)?'on':''}" onclick="toggleGuide('stretch',${i})">✓</div>
            <div class="guide-info"><div class="guide-name">${escapeHtml(it.name)}</div>${it.note?`<div class="guide-note">${escapeHtml(it.note)}</div>`:''}</div>
          </div>`).join('')}
      </div>
    </div>
    <button class="btn btn-accent mt-3" onclick="finishTraining()">结束训练</button>${s.lastConfirmed?'<button class="text-action" onclick="undoLastSet()">撤销上一组</button>':''}`;
}

function renderTrainingUI() {
  const s = trainState;
  setTrainingFixedAction(s.section === 'workout');
  const container = document.getElementById('trainingContent');
  let body = '';
  if (s.section === 'warmup') body = renderWarmup();
  else if (s.section === 'workout') body = renderWorkout();
  else if (s.section === 'stretch') body = renderStretch();
  else body = renderWorkout();
  container.innerHTML = `
    <div class="training-header">
      <span class="text-accent font-bold">${escapeHtml(s.day.name)}</span>
      <span class="text-muted text-sm">⏱ ${formatTime(s.sessionTime)}</span>
    </div>
    ${todayPlan.date !== getTodayStr() ? `<div class="resume-banner">继续 ${escapeHtml(todayPlan.date)} 的未完成训练，已保留原进度。</div>` : ''}
    ${dataRecoveryNotice || LS.error ? `<div class="danger-note">${escapeHtml(dataRecoveryNotice || LS.error)}</div>` : ''}
    ${currentPlanNeedsReview()?'<div class="danger-note">训练档案或阶段安排已更新，请检查本次计划是否仍适合；有不适时先停止相关动作。</div>':''}
    ${renderSectionTabs()}
    <button class="mini-btn mb-3" onclick="requestFocusChange()">保存进度并更改训练日</button>
    ${body}`;
}

function requestFocusChange() {
  if(trainState.saved||trainState.pendingCompletion){renderComplete();return;}
  trainState.changeFocusAfterSaving=true;
  finishTraining();
}

function toggleGuide(which, idx) {
  const list = which === 'warmup' ? trainState.warmupDone : trainState.stretchDone;
  const pos = list.indexOf(idx);
  if (pos >= 0) list.splice(pos, 1);
  else list.push(idx);
  persistTrainingState();
  renderTrainingUI();
}

function renderFeedbackPrompt() {
  setTrainingFixedAction(false);
  const s = trainState;
  const ex = s.day.exercises.find(item=>item.id===s.pendingFeedback);
  if (!ex) { s.pendingFeedback = null; renderTrainingPage(); return; }
  document.getElementById('trainingContent').innerHTML = `
    <div class="min-h-feedback" style="min-height:70vh;display:flex;flex-direction:column;justify-content:center">
      <div class="text-center mb-4"><div class="text-accent text-sm font-bold">动作完成</div><div class="exercise-name" style="margin-top:8px">${escapeHtml(ex.name)}</div><div class="text-muted text-sm">这次动作整体感觉如何？</div></div>
      <div class="feedback-grid">
        <button class="feedback-btn" onclick="submitExerciseFeedback('轻松')">🙂 轻松</button>
        <button class="feedback-btn" onclick="submitExerciseFeedback('合适')">👍 合适</button>
        <button class="feedback-btn" onclick="submitExerciseFeedback('吃力')">😮‍💨 吃力</button>
        <button class="feedback-btn" onclick="submitExerciseFeedback('不适')">⚠️ 不适</button>
      </div>
      <input id="feedbackNote" class="setup-input mt-3" placeholder="如有不适，可补充具体部位（选填）">
    </div>`;
}

function submitExerciseFeedback(value) {
  const s = trainState;
  const exId = s.pendingFeedback;
  const exercise = s.day.exercises.find(item => item.id === exId);
  const note = (document.getElementById('feedbackNote')?.value || '').trim();
  s.feedback[exId] = { value, note, at:new Date().toISOString() };
  if (value === '不适' && exercise?.exerciseId) {
    exercisePreferences.paused[exercise.exerciseId] = {
      name:exercise.name,
      note:note || '训练反馈为“不适”',
      pausedAt:new Date().toISOString()
    };
    delete exercisePreferences.lightChoices[exercise.exerciseId];
    LS.set('exercise_preferences', exercisePreferences);
  }
  s.pendingFeedback = null;
  advanceAfterExercise();
}

function advanceAfterExercise() {
  const s = trainState;
  let nextIdx = s.exIdx + 1;
  while (nextIdx < s.day.exercises.length) {
    const candidate = s.day.exercises[nextIdx];
    if ((s.records[candidate.id]||[]).length < candidate.sets && !(s.skipped||{})[candidate.id]) break;
    nextIdx++;
  }
  if (nextIdx < s.day.exercises.length) {
    s.exIdx = nextIdx;
    const next = s.day.exercises[s.exIdx];
    const completed = (s.records[next.id]||[]).length;
    s.set = Math.min(next.sets, completed + 1);
    s.weight = next.weight;s.weightMode='';
    s.weightNeedsConfirmation=needsWeightConfirmation(next) && !completed;
    s.reps = next.reps;
    persistTrainingState();
    startRestTimer();
  } else {
    s.section = 'stretch';
    persistTrainingState();
    renderTrainingPage();
  }
}

function skipExercise() {
  const s = trainState;
  const ex = s.day.exercises[s.exIdx];
  if (!confirm(`确定跳过“${ex.name}”吗？`)) return;
  s.lastConfirmed=null;
  s.skipped = s.skipped || {};
  s.skipped[ex.id] = true;
  s.feedback[ex.id] = { value:'跳过', note:'用户主动跳过', at:new Date().toISOString() };
  advanceAfterExercise();
}

function renderRestOverlay() {
  setTrainingFixedAction(false);
  const s = trainState;
  const ex = s.day.exercises[s.exIdx];
  const container = document.getElementById('trainingContent');
  container.innerHTML = `
    <div class="rest-overlay">
      ${currentPlanNeedsReview()?'<div class="danger-note">训练档案或阶段安排已更新，请检查本次计划是否仍适合。</div>':''}<div class="rest-label">组间休息</div>
      <div class="rest-circle"><div class="rest-time">${s.restTimer}</div></div>
      <div class="rest-next">下一组：第 ${s.set} 组 · ${escapeHtml(ex.name)}</div>
      <div class="reason-note">${escapeHtml(s.weight)} kg × ${escapeHtml(s.reps)} 次</div><button class="skip-btn" onclick="skipRest()">跳过休息</button>${s.lastConfirmed?'<button class="text-action" onclick="undoLastSet()">撤销上一组</button>':''}
    </div>
  `;
}

function retryFinishSave() {
  const changeFocusAfterSaving=!!trainState.changeFocusAfterSaving;
  const saved=saveSession();
  if(saved&&changeFocusAfterSaving){if(trainState.timerInterval)clearInterval(trainState.timerInterval);if(trainState.restInterval)clearInterval(trainState.restInterval);trainState={};renderTrainingSetup('上一节训练的已确认组已保存；请选今天要练的训练日。');window.scrollTo(0,0);return;}
  renderComplete();
}

function returnToWorkout() { trainState.changeFocusAfterSaving=false;trainState.section='workout';persistTrainingState();renderTrainingPage(); }
function adjustWeight(delta) {
  trainState.weight = Math.max(0, validWeight(trainState.weight, 0) + delta);
  if(trainState.weight>0){trainState.weightNeedsConfirmation=false;trainState.weightMode='';}
  persistTrainingState();
  renderWorkoutOnly();
}

function renderWorkoutOnly() {
  const s = trainState;
  const ex = s.day.exercises[s.exIdx];
  s.reps = validReps(s.reps, validReps(ex.reps, 8));
  const recs = s.records[ex.id] || [];
  const ui = document.getElementById('trainingContent');
  ui.querySelector('.exercise-target').textContent = `目标 ${s.weightNeedsConfirmation?'重量待确认':ex.weight+'kg'} · ${ex.sets}组×${ex.reps}次`;
  ui.querySelector('.num-control .big').value = s.weight;
  const weightHint=document.getElementById('weightConfirmHint');if(weightHint)weightHint.hidden=!s.weightNeedsConfirmation;
  const small = ui.querySelector('.num-control .small');
  if (small) small.value = s.reps;
  ui.querySelector('.set-indicator').textContent = `第 ${s.set} 组 / 共 ${ex.sets} 组 · 动作 ${s.exIdx+1}/${s.day.exercises.length}`;
  const sh = ui.querySelector('.set-history');
  if (sh) sh.innerHTML = recs.length > 0 ? recs.map(r=>`<span class="set-dot">组${r.set}:${r.w}×${r.r}</span>`).join('') : '';
}

// 切换动作（左右滑动）
function switchExercise(dir) {
  const s = trainState;
  if (s.complete || s.isResting || s.section !== 'workout') return;
  const total = s.day.exercises.length;
  let idx = s.exIdx + dir;
  if (idx < 0 || idx >= total) return;
  s.exIdx = idx;
  const next = s.day.exercises[idx];
  s.set = Math.min(next.sets, (s.records[next.id]||[]).length + 1);
  s.weight = next.weight;s.weightMode='';
  s.weightNeedsConfirmation=needsWeightConfirmation(next) && !(s.records[next.id]||[]).length;
  s.reps = next.reps;
  persistTrainingState();
  renderTrainingUI();
}

function adjustReps(delta) {
  const ex = trainState.day.exercises[trainState.exIdx];
  trainState.reps = Math.max(0, validReps(trainState.reps, validReps(ex.reps, 8)) + delta);
  persistTrainingState();
  renderWorkoutOnly();
}

function validReps(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '') return fallback;
  const parsed = typeof normalized === 'number' ? normalized : Number(normalized);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function validWeight(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '') return fallback;
  const parsed = typeof normalized === 'number' ? normalized : Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed*2)/2 : fallback;
}

function focusTrainingInput(input) {
  document.body.classList.add('keyboard-active');
  input.select();
  setTimeout(() => input.scrollIntoView({ block:'center', behavior:'smooth' }), 120);
}

function commitWeightInput(input) {
  const previous = validWeight(trainState.weight, 0);
  if(input.value.trim()!=='' && Number.isFinite(Number(input.value)) && Number(input.value)>=0){trainState.weightNeedsConfirmation=false;if(Number(input.value)!==previous)trainState.weightMode='';}
  trainState.weight = validWeight(input.value, previous);
  input.value = trainState.weightNeedsConfirmation?'':trainState.weight;
  document.body.classList.remove('keyboard-active');
  persistTrainingState();
}

function handleWeightKey(event, input) {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitWeightInput(input);
    input.blur();
  } else if (event.key === 'Escape') {
    input.value = validWeight(trainState.weight, 0);
    input.blur();
  }
}

function commitRepsInput(input) {
  const ex = trainState.day.exercises[trainState.exIdx];
  const previous = validReps(trainState.reps, validReps(ex.reps, 8));
  trainState.reps = validReps(input.value, previous);
  input.value = trainState.reps;
  document.body.classList.remove('keyboard-active');
  persistTrainingState();
}

function handleRepsKey(event, input) {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitRepsInput(input);
    input.blur();
  } else if (event.key === 'Escape') {
    input.value = validReps(trainState.reps, 8);
    input.blur();
  }
}

function finishTraining() {
  if(trainState.saved||trainState.pendingCompletion){renderComplete();return;}
  if(trainState.timerInterval)clearInterval(trainState.timerInterval);if(trainState.restInterval)clearInterval(trainState.restInterval);
  trainState.section='finish';persistTrainingState();renderFinishPrompt();
}

function completionData(pending) {
  const history = LS.get('sessions', sessions);
  const latest = Array.isArray(history) ? history : sessions;
  const result = {
    sessions:[pending.session, ...latest.filter(item=>item.id !== pending.session.id)],
    today_index:pending.nextIndex,
    cycle_variants:pending.variants,
    training_phase:pending.phase,
    today_plan:null,
    active_training:null
  };
  if (pending.plan) { result.plan=pending.plan; result.profile=pending.profile; }
  else if(pending.reuseProfile)result.profile=pending.reuseProfile;
  return result;
}

function saveSession() {
  const s = trainState;
  if (s.saved) return true;
  if (!s.pendingCompletion) {
    const session = {
      id:'session-'+todayPlan.id,
      date: getTodayStr(),
      startedDate:todayPlan.startedDate||todayPlan.date||getTodayStr(),
      completedAt:new Date().toISOString(),
      dayName: s.day.name,
      focusArea: todayPlan.focus,
      factors: todayPlan.factors,
      source: todayPlan.source,
      variant: todayPlan.variant,
      catalogVersion:todayPlan.catalogVersion || '',
      duration: s.sessionTime,
      sessionFeedback:s.sessionFeedback||'',
      sessionDiscomfort:s.sessionDiscomfort||'',
      progressionAdvanced:!!s.advancePpl,
      exercises: s.day.exercises.map(ex => {
        const recs = s.records[ex.id] || [];
        const feedback = s.feedback[ex.id] || {};
        const skipped=!!(s.skipped||{})[ex.id],completed=recs.length>=ex.sets&&!skipped;
        return { exerciseId:ex.exerciseId||'',name:ex.name,nameSnapshot:ex.nameSnapshot||ex.name,catalogVersion:ex.catalogVersion||todayPlan.catalogVersion||'',replacementMuscle:ex.replacementMuscle||'',variantGroup:ex.variantGroup||'',role:ex.role,pattern:ex.pattern,targetSets:ex.sets,targetReps:ex.reps,targetWeight:ex.weight,completed,skipped,status:completed?'completed':(skipped?(recs.length?'partial':'skipped'):(recs.length?'partial':'not_started')),feedback:feedback.value||'',feedbackNote:feedback.note||'',sets:recs.map(r=>({w:r.w,r:r.r,...(r.loadType?{loadType:r.loadType}:{}),confirmedAt:r.confirmedAt||''}))};
      })
    };
    const key = todayPlan.focusKey || focusKeyFromText(todayPlan.focus);
    const actualIdx = plan.days.findIndex(day => focusKeyFromText(day.focus||day.name) === key);
    s.pendingCompletion = {
      session,
      nextIndex:actualIdx >= 0 ? ((actualIdx+(s.advancePpl===false?0:1))%plan.days.length) : (todayIndex+1)%plan.days.length,
      variants:{...cycleVariants},
      phase:{ ...trainingPhase, completedSessions:(trainingPhase.completedSessions||0)+(sessionIsComplete(session)?1:0) }
    };
    const reusable=reusableSnapshotFor(todayPlan,session);
    if(reusable)s.pendingCompletion.reuseProfile={...profile,reusablePlan:reusable};

  }
  if (LS.blocked) { LS.recover(); ensureUserDataCompatibility(); }
  // Keep a retryable checkpoint before committing history and cycle together.
  persistTrainingState();
  let changes = completionData(s.pendingCompletion);
  let saved=LS.transaction(changes);
  // 保存复用计划属于可选增强；空间不足时先尝试保住本次实际训练。
  if(!saved && !LS.blocked && s.pendingCompletion.reuseProfile && !s.pendingCompletion.plan){delete s.pendingCompletion.reuseProfile;changes=completionData(s.pendingCompletion);saved=LS.transaction(changes);}
  if (!saved) {
    s.saveError = '尚未保存成功，训练和周期进度已保留。请重试保存，或导出含本次训练的备份；不要清除浏览器数据。';
    persistTrainingState();
    return false;
  }
  sessions=changes.sessions; todayIndex=changes.today_index; cycleVariants=changes.cycle_variants;
  trainingPhase=changes.training_phase;
  if(changes.plan)plan=changes.plan;
  if(changes.profile)profile=changes.profile;
  s.saved = true;
  s.saveError = '';
  s.pendingCompletion = null;
  dataRecoveryNotice = '';
  todayPlan = null;
  applyPrevRecords();
  return true;
}

function skipRest() {
  if (trainState.restInterval) clearInterval(trainState.restInterval);
  trainState.isResting = false;
  trainState.restTimer = 0;
  trainState.restEndAt = 0;
  persistTrainingState();
  renderTrainingPage();
}

function formatTime(s) {
  return Math.floor(s/60)+':'+(s%60).toString().padStart(2,'0');
}

// ============ AI 调用 ============
async function aiCall(prompt, silent=false) {
  const key = getGlobalApiKey();
  if (!key) { if (!silent) alert('请先在「我的」页面设置 DeepSeek API Key'); return null; }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),25000);
    let res;
    try {
      res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 4000 }), signal:controller.signal
      });
    } finally { clearTimeout(timeout); }
    if (!res.ok) { const err = await res.json().catch(() => ({})); if (!silent) alert('AI 调用失败: ' + (err.error?.message || res.status)); return null; }
    const data = await res.json();
    return data.choices[0].message.content;
  } catch(e) { if (!silent) alert('网络错误: ' + e.message); return null; }
}
