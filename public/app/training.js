// ============ 训练页（动态四板块：热身/正式/拉伸/饮食） ============
let trainState = {};

function exerciseInstructionBlock(exercise, targetId) {
  if (!exercise?.exerciseId?.startsWith('exds:')) return '';
  const opened = openInstructionIds.has(exercise.exerciseId);
  const steps = exerciseInstructions?.[exercise.exerciseId];
  if (exerciseInstructions && (!Array.isArray(steps) || !steps.length)) return '';
  const content = Array.isArray(steps) && steps.length
    ? `<ol>${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
    : '<div class="text-muted">正在加载动作说明…</div>';
  return `<button id="${escapeHtml(targetId)}-button" class="instruction-toggle" data-exid="${escapeHtml(exercise.exerciseId)}" data-target="${escapeHtml(targetId)}" onclick="toggleExerciseInstructions(this.dataset.exid, this.dataset.target)">${opened?'收起动作说明':'查看动作说明'}</button>
    <div id="${escapeHtml(targetId)}" class="instruction-panel ${opened?'open':''}">${content}</div>`;
}

async function toggleExerciseInstructions(exerciseId, targetId) {
  const panel = document.getElementById(targetId);
  const button = document.getElementById(targetId + '-button');
  if (!panel || !button) return;
  if (openInstructionIds.has(exerciseId)) {
    openInstructionIds.delete(exerciseId);
    panel.classList.remove('open');
    button.textContent = '查看动作说明';
    return;
  }
  openInstructionIds.add(exerciseId);
  panel.classList.add('open');
  button.textContent = '收起动作说明';
  const bundle = await ensureExerciseInstructions();
  const steps = bundle?.[exerciseId];
  if (!Array.isArray(steps) || !steps.length) {
    openInstructionIds.delete(exerciseId);
    button.hidden = true;
    panel.classList.remove('open');
    panel.hidden = true;
    return;
  }
  panel.innerHTML = `<ol>${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`;
}

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

function renderPlanPreview() {
  setTrainingFixedAction(false);
  const items = todayPlan.workout.map((ex,index) => `
    <div class="preview-item">
      <div class="preview-head">
        <span class="preview-role ${ex.role==='核心'?'':'aux'}">${ex.role==='核心'?'主要动作':'辅助动作'}</span>
        <div style="flex:1"><div class="font-bold">${index+1}. ${escapeHtml(ex.name)}${ex.isNew?'<span class="new-exercise-badge">新动作</span>':''}</div><div class="reason-note">${escapeHtml(ex.purpose||ex.reason||(ex.role==='核心'?'承担当日重点训练':'辅助整体训练安排'))}</div>${ex.previous?`<div class="reason-note">上次实际：${ex.previous.weight}kg × ${ex.previous.reps}${ex.previous.feedback?' · '+escapeHtml(ex.previous.feedback):''}</div>`:''}${exerciseInstructionBlock(ex,`preview-instruction-${index}`)}</div>
      </div>
      <div class="edit-grid">
        <div class="edit-field"><label>组数</label><input type="number" min="1" max="5" value="${ex.sets}" oninput="updatePreviewField(${index},'sets',this.value)"></div>
        <div class="edit-field"><label>次数</label><input type="number" min="1" max="100" value="${ex.reps}" oninput="updatePreviewField(${index},'reps',this.value)"></div>
        <div class="edit-field"><label>重量kg</label><input type="number" min="0" step="2.5" value="${ex.weight}" oninput="updatePreviewField(${index},'weight',this.value)"></div>
        <div class="edit-field"><label>休息秒</label><input type="number" min="30" max="300" step="15" value="${ex.rest}" oninput="updatePreviewField(${index},'rest',this.value)"></div>
      </div>
      <div class="preview-actions"><button class="mini-btn" onclick="swapPlanExercise(${index})">换一个动作</button></div>
    </div>`).join('');
  document.getElementById('trainingContent').innerHTML = `
    <div class="training-header"><span class="text-accent font-bold">计划预览</span><span class="plan-source ${todayPlan.aiUsed?'':'local'}">${todayPlan.aiUsed?'AI 适配':'本地计划'}</span></div>
    ${todayPlan.notice?`<div class="resume-banner">${escapeHtml(todayPlan.notice)}</div>`:''}
    ${todayPlan.aiFailure?'<button class="mini-btn mt-2" onclick="retryAIPlan()">重试 AI 生成</button>':''}
    <div class="plan-request card"><label class="setup-label" for="planRequest">想改哪里？用平常的话告诉我</label><textarea id="planRequest" class="setup-input" rows="2" maxlength="400" placeholder="例如：这个动作我不会；今天轻松一点">${escapeHtml(todayPlan.userRequest||'')}</textarea><button class="mini-btn mt-3" onclick="applyPlanRequest()">按这句话调整</button><div id="planRequestMsg" class="text-sm text-muted mt-2">${todayPlan.aiUsed?'已用 AI 结合训练记录动态安排':(profile.aiPlanEnabled?'AI 未生成个性化计划，可重试或使用本地备用计划':'当前为本地规则备用计划；可在“我的”开启可选 AI')}</div></div>
    <div class="card">
      <div class="row mb-3"><div><div class="section-title" style="margin-bottom:2px">${escapeHtml(todayPlan.focus)} · PPL 循环</div><div class="text-muted text-sm">${todayPlan.workout.length} 个动作 · ${escapeHtml(todayPlan.factors.time)}</div></div></div>
      ${items}
    </div>
    <button class="btn btn-accent" onclick="startConfirmedPlan()">确认计划并开始</button>
    <button class="btn btn-outline mt-3" onclick="discardTodayPlan()">重新选择训练日</button>`;
}

async function retryAIPlan() {
  if(!profile.aiPlanEnabled||!getGlobalApiKey()){alert('请先在“我的”开启计划 AI 并设置 API Key。');return;}
  const btn=document.querySelector('#trainingContent button[onclick="retryAIPlan()"]');if(btn)btn.disabled=true;
  const original=cloneData(todayPlan),result=await adaptPlanWithAI(original,original.userRequest||'');
  if(result.usedAI){const next={...result.plan,aiUsed:true,aiFailure:'',userRequest:original.userRequest||''};if(LS.transaction({today_plan:next})){todayPlan=next;renderPlanPreview();}else{todayPlan=original;renderPlanPreview();alert('AI 计划生成成功，但保存失败；原计划和记录仍保留。');}}
  else {todayPlan={...original,...result.plan,aiUsed:false,aiFailure:result.error||'AI 暂不可用'};LS.set('today_plan',todayPlan);renderPlanPreview();}
}

async function applyPlanRequest() {
  const request=(document.getElementById('planRequest')?.value||'').trim();
  const msg=document.getElementById('planRequestMsg');
  if(!request){if(msg)msg.textContent='先写一句你希望调整的地方。';return;}
  if(!profile.aiPlanEnabled||!getGlobalApiKey()){if(msg)msg.textContent='要理解自然语言并调整计划，请在“我的”开启可选 AI；当前计划和输入会保留。';return;}
  const btn=document.querySelector('.plan-request button');if(btn)btn.disabled=true;
  if(msg)msg.textContent='正在理解你的意思…';
  const original=cloneData(todayPlan), result=await adaptPlanWithAI(original,request);
  if(btn)btn.disabled=false;
  if(result.usedAI){const next={...result.plan,userRequest:request,aiUsed:true,aiFailure:''};if(LS.transaction({today_plan:next})){todayPlan=next;renderPlanPreview();}else if(msg)msg.textContent='调整结果暂时保存失败；原计划仍保留，请重试。';}
  else if(msg)msg.textContent=`${result.error||'暂时无法调整'}；原计划仍保留，你可以改写这句话或手动换一个同类动作。`;
}

function updatePreviewField(index,key,value) {
  const ex = todayPlan.workout[index];
  if (!ex) return;
  if (String(value).trim() === '') return;
  const num = Number(value);
  const limits = { sets:[1,8], reps:[1,100], weight:[0,1000], rest:[30,300] }[key];
  if (!Number.isFinite(num) || num < limits[0] || num > limits[1]) { renderPlanPreview(); return; }
  ex[key] = key === 'weight' ? Math.round(num*2)/2 : Math.round(num);
  ex.reason = '用户在计划预览中手动调整';
  LS.set('today_plan', todayPlan);
}

function swapPlanExercise(index, preferNew=false) {
  const current = todayPlan.workout[index];
  if (!current || current.locked) return;
  let choice = null;
  if (todayPlan.catalogVersion && exerciseCatalog && getExerciseEngine()) {
    const engine = getExerciseEngine();
    const usedIds = new Set(todayPlan.workout.map(ex => ex.exerciseId));
    const context = catalogHistoryContext(todayPlan.focusKey);
    const pool = getCatalogCandidates(todayPlan.focusKey).filter(ex =>
      ex.replacementMuscle === current.replacementMuscle &&
      (!ex.roleEligibility?.length || ex.roleEligibility.includes(current.role)) &&
      !usedIds.has(ex.exerciseId)
    );
    const ranked = engine.scoreCandidates(pool, {
      seed:`${todayPlan.id}:manual:${index}:${preferNew?'new':'any'}`,
      recentExerciseIds:context.recentExerciseIds,
      usedIds:[...usedIds],
      lastUsed:context.lastUsed,
      replacementMuscle:current.replacementMuscle,
      currentVariantGroup:current.variantGroup
    });
    const ordered = preferNew
      ? ranked.sort((a,b) => Number(isNewCatalogExercise(b.exercise)) - Number(isNewCatalogExercise(a.exercise)) || b.score-a.score)
      : ranked;
    // 同肌群、同动作目的的候选已经由安全候选池约束；不再用旧模板的固定平衡槽限制 AI 动态计划。
    choice=ordered[0]?.exercise||null;
  } else {
    const used = new Set(todayPlan.workout.map(ex=>ex.name));
    choice = allLibraryExercises(todayPlan.focusKey).find(ex=>ex.pattern===current.pattern&&!used.has(ex.name)&&!isExerciseBlocked(ex)&&matchesEnvironment(ex));
  }
  if (!choice) {
    if (current.exerciseId) {
      exercisePreferences.lightChoices[current.exerciseId] = 'progress';
      LS.set('exercise_preferences', exercisePreferences);
    }
    alert('当前条件下没有既安全又保持训练结构的同类替代动作');
    renderPlanPreview();
    return;
  }
  const replacement = adaptExercise(choice, `替代“${current.name}”，保持${current.replacementMuscle||current.pattern}训练目的`);
  replacement.role = current.role;
  replacement.locked = false;
  todayPlan.workout[index] = replacement;
  LS.set('today_plan', todayPlan);
  renderPlanPreview();
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

function initDynamicTraining() {
  const tp = todayPlan;
  const exercises = tp.workout;
  trainState = {
    day: { name: (tp.focus||'训练')+'训练日', focus: tp.focus||'', exercises: exercises },
    exIdx: 0, set: 1,
    weight: exercises[0] ? exercises[0].weight||0 : 0,
    reps: exercises[0] ? exercises[0].reps||8 : 8,
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
    return `<div class="card"><div class="text-muted text-sm">今日无需专门热身，直接开始正式训练即可。</div></div>
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
      <div class="exercise-target">目标 ${ex.weight}kg · ${ex.sets}组×${ex.reps}次</div>
      ${exerciseInstructionBlock(ex,`workout-instruction-${s.exIdx}`)}
      <div class="control-label text-center">本组重量</div>
      <div class="num-control">
        <div class="num-btn" onclick="adjustWeight(-2.5)">−</div>
        <div class="num-display"><input class="big reps-input weight-input" type="text" inputmode="decimal" value="${s.weight}" aria-label="训练重量" onfocus="focusTrainingInput(this)" onkeydown="handleWeightKey(event,this)" onblur="commitWeightInput(this)"><div class="unit">kg</div></div>
        <div class="num-btn" onclick="adjustWeight(2.5)">+</div>
      </div>
      <div class="control-label text-center">本组次数</div>
      <div class="num-control">
        <div class="num-btn" onclick="adjustReps(-1)">−</div>
        <div class="num-display"><input class="small reps-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${s.reps}" aria-label="训练次数" onfocus="focusTrainingInput(this)" onkeydown="handleRepsKey(event,this)" onblur="commitRepsInput(this)"><div class="unit">次</div></div>
        <div class="num-btn" onclick="adjustReps(1)">+</div>
      </div>
      <div class="set-indicator">第 ${s.set} 组 / 共 ${ex.sets} 组 · 动作 ${s.exIdx+1}/${s.day.exercises.length}</div>
      <div class="reason-note text-center">${ex.role==='核心'?'保持主动作连续，方便比较实际表现':'按今天训练方向安排'}</div>
      ${recs.length > 0 ? `<div class="set-history">${recs.map(r=>`<span class="set-dot">组${r.set}:${r.w}×${r.r}</span>`).join('')}</div>` : ''}
    </div>
    <div class="training-actions">
      <div id="workoutMore" class="workout-more">
        <button class="btn btn-outline" onclick="skipExercise()">跳过当前动作</button>
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
    return `<div class="card"><div class="text-muted text-sm">今日无专项拉伸，可自行放松。</div></div>
      <button class="btn btn-accent mt-3" onclick="finishTraining()">结束训练</button>`;
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
    <button class="btn btn-accent mt-3" onclick="finishTraining()">结束训练</button>`;
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
    s.weight = next.weight;
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
      <div class="rest-label">组间休息</div>
      <div class="rest-circle"><div class="rest-time">${s.restTimer}</div></div>
      <div class="rest-next">下一组：第 ${s.set} 组 · ${escapeHtml(ex.name)}</div>
      <button class="skip-btn" onclick="skipRest()">跳过休息</button>
    </div>
  `;
}

function renderComplete() {
  setTrainingFixedAction(false);
  const s = trainState;
  const container = document.getElementById('trainingContent');
  const actualSets=Object.values(s.records||{}).reduce((n,rows)=>n+rows.length,0);
  container.innerHTML = `
    <div class="complete-container">
      <div class="complete-icon">✓</div>
      <div class="complete-title">${s.saved ? '训练记录已保存' : '训练结束，等待保存'}</div>
      <div class="complete-time">${escapeHtml(s.day.name)} · ${actualSets} 组实际记录 · ${formatTime(s.sessionTime)}${s.sessionFeedback?' · '+escapeHtml(s.sessionFeedback):''}</div>
      ${s.saveError ? `<div class="danger-note" style="margin-bottom:14px">${escapeHtml(s.saveError)}</div>` : ''}
      ${s.archiveNote ? `<div class="reason-note" style="margin-bottom:14px">${escapeHtml(s.archiveNote)}</div>` : ''}
      ${s.saved ? '<button class="btn btn-accent" onclick="resetTraining();renderTrainingPage()">再练一次</button>' : '<button class="btn btn-accent" onclick="retryFinishSave()">重试保存</button><button class="btn btn-outline mt-3" onclick="exportBackup()">导出含本次训练的备份</button>'}
      <button class="btn btn-outline mt-3" onclick="navigate('home')">返回首页</button>
    </div>
  `;
}

function renderFinishPrompt() {
  setTrainingFixedAction(false);
  const s=trainState, planned=todayPlan.workout.reduce((n,ex)=>n+ex.sets,0);
  const actual=Object.values(s.records||{}).reduce((n,rows)=>n+rows.length,0);
  const partial=!todayPlan.workout.every(ex=>(s.records[ex.id]||[]).length>=ex.sets);
  document.getElementById('trainingContent').innerHTML=`
    <div class="training-header"><span class="text-accent font-bold">结束训练</span><span class="text-muted text-sm">${actual}/${planned} 组</span></div>
    <div class="card">${s.changeFocusAfterSaving?'<div class="resume-banner">先保存本次已确认的实际训练组，再选择新的训练日。未完成内容不会记为已完成。</div>':''}<div class="setup-title">这次感觉怎么样？</div>
      <div class="opt-grid finish-feeling">${[['轻松','🙂'],['刚刚好','👍'],['偏吃力','😮‍💨']].map(([v,e])=>`<button class="opt-chip ${s.sessionFeedback===v?'sel':''}" onclick="setSessionFeeling('${v}')">${e} ${v}</button>`).join('')}</div>
      <label class="setup-label mt-3" for="sessionDiscomfort">如果有不适，可以补充一句</label><input id="sessionDiscomfort" class="setup-input" maxlength="240" value="${escapeHtml(s.sessionDiscomfort||'')}" placeholder="选填" oninput="trainState.sessionDiscomfort=this.value;persistTrainingState()">
      ${partial?`<div class="setup-group"><span class="setup-label">下次怎么接着练？</span><div class="opt-grid finish-progress"><button class="opt-chip ${s.advancePpl===false?'sel':''}" onclick="choosePplAdvance(false)">继续这一天</button><button class="opt-chip ${s.advancePpl===true?'sel':''}" onclick="choosePplAdvance(true)">推进到下一天</button></div></div>`:''}
      <div id="finishMsg" class="text-center text-muted text-sm"></div><button class="btn btn-accent mt-3" onclick="confirmFinishTraining()">${s.changeFocusAfterSaving?'保存记录并选择训练日':'保存训练记录'}</button><button class="btn btn-outline mt-3" onclick="returnToWorkout()">返回训练</button>
    </div>`;
}

function retryFinishSave() {
  const changeFocusAfterSaving=!!trainState.changeFocusAfterSaving;
  const saved=saveSession();
  if(saved&&changeFocusAfterSaving){if(trainState.timerInterval)clearInterval(trainState.timerInterval);if(trainState.restInterval)clearInterval(trainState.restInterval);trainState={};renderTrainingSetup('上一节训练的已确认组已保存；请选今天要练的训练日。');window.scrollTo(0,0);return;}
  renderComplete();
}

function setSessionFeeling(value) { trainState.sessionFeedback=value;persistTrainingState();renderFinishPrompt(); }
function choosePplAdvance(value) { trainState.advancePpl=!!value;persistTrainingState();renderFinishPrompt(); }
function returnToWorkout() { trainState.changeFocusAfterSaving=false;trainState.section='workout';persistTrainingState();renderTrainingPage(); }
function confirmFinishTraining() {
  const s=trainState;
  if(s.saved||!todayPlan){if(s.pendingCompletion)saveSession();renderComplete();return;}
  if(!s.sessionFeedback){document.getElementById('finishMsg').textContent='选一个最接近的感受就好。';return;}
  const fullyDone=todayPlan.workout.every(ex=>(s.records[ex.id]||[]).length>=ex.sets);
  if(!fullyDone&&typeof s.advancePpl!=='boolean'){document.getElementById('finishMsg').textContent='选一下下次继续这一天，还是推进到下一天。';return;}
  s.sessionDiscomfort=(document.getElementById('sessionDiscomfort')?.value||'').trim();
  s.advancePpl=fullyDone?true:s.advancePpl;s.complete=true;
  if(s.timerInterval)clearInterval(s.timerInterval);if(s.restInterval)clearInterval(s.restInterval);
  persistTrainingState();const changeFocusAfterSaving=!!s.changeFocusAfterSaving;
  const saved=saveSession();
  if(!saved){renderComplete();return;}
  if(changeFocusAfterSaving){if(s.timerInterval)clearInterval(s.timerInterval);if(s.restInterval)clearInterval(s.restInterval);trainState={};renderTrainingSetup('上一节训练的已确认组已保存；请选今天要练的训练日。');window.scrollTo(0,0);return;}
  renderComplete();
}

function adjustWeight(delta) {
  trainState.weight = Math.max(0, validWeight(trainState.weight, 0) + delta);
  persistTrainingState();
  renderWorkoutOnly();
}

function renderWorkoutOnly() {
  const s = trainState;
  const ex = s.day.exercises[s.exIdx];
  s.reps = validReps(s.reps, validReps(ex.reps, 8));
  const recs = s.records[ex.id] || [];
  const ui = document.getElementById('trainingContent');
  ui.querySelector('.exercise-target').textContent = `目标 ${ex.weight}kg · ${ex.sets}组×${ex.reps}次`;
  ui.querySelector('.num-control .big').value = s.weight;
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
  s.weight = next.weight;
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
  trainState.weight = validWeight(input.value, previous);
  input.value = trainState.weight;
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

function completeSet() {
  const s = trainState;
  const ex = s.day.exercises[s.exIdx];
  s.reps = validReps(s.reps, validReps(ex.reps, 8));
  if (s.reps < 1) { alert('实际次数至少为 1；未完成的训练可以直接结束并记录已完成组。'); return; }
  if (!s.records[ex.id]) s.records[ex.id] = [];
  s.records[ex.id].push({set:s.set, w:s.weight, r:s.reps, confirmedAt:new Date().toISOString()});
  persistTrainingState();
  if (s.set < ex.sets) {
    s.set++;
    startRestTimer();
  } else {
    s.pendingFeedback = ex.id;
    persistTrainingState();
    renderTrainingPage();
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
        return { exerciseId:ex.exerciseId||'',name:ex.name,nameSnapshot:ex.nameSnapshot||ex.name,catalogVersion:ex.catalogVersion||todayPlan.catalogVersion||'',replacementMuscle:ex.replacementMuscle||'',variantGroup:ex.variantGroup||'',role:ex.role,pattern:ex.pattern,targetSets:ex.sets,targetReps:ex.reps,targetWeight:ex.weight,completed,skipped,status:completed?'completed':(skipped?(recs.length?'partial':'skipped'):(recs.length?'partial':'not_started')),feedback:feedback.value||'',feedbackNote:feedback.note||'',sets:recs.map(r=>({w:r.w,r:r.r,confirmedAt:r.confirmedAt||''}))};
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
    if(!isPplPlan()) {
      const pplDays=cloneData(DEFAULT_PLAN.days),pplIdx=pplDays.findIndex(day=>focusKeyFromText(day.focus||day.name)===key);
      s.pendingCompletion.plan={name:PLAN_TEMPLATES.ppl.name,cycle:PLAN_TEMPLATES.ppl.cycle,days:pplDays};
      s.pendingCompletion.profile={...profile,planTemplate:'ppl'};
      s.pendingCompletion.nextIndex=((pplIdx<0?0:pplIdx)+(s.advancePpl===false?0:1))%pplDays.length;
    }
  }
  if (LS.blocked) { LS.recover(); ensureUserDataCompatibility(); }
  // Keep a retryable checkpoint before committing history and cycle together.
  persistTrainingState();
  const changes = completionData(s.pendingCompletion);
  if (!LS.transaction(changes)) {
    s.saveError = '尚未保存成功，训练和周期进度已保留。请重试保存，或导出含本次训练的备份；不要清除浏览器数据。';
    persistTrainingState();
    return false;
  }
  sessions=changes.sessions; todayIndex=changes.today_index; cycleVariants=changes.cycle_variants;
  trainingPhase=changes.training_phase;
  if(changes.plan){plan=changes.plan;profile=changes.profile;}
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
