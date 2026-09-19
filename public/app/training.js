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

function renderLightChoice(exercise, index) {
  if (exercise.role === '核心' || exercise.previous?.feedback !== '轻松') return '';
  const choice = exercisePreferences?.lightChoices?.[exercise.exerciseId] || exercise.lightChoice || 'progress';
  return `<div class="light-choice">
    <div class="light-choice-label">上次感觉轻松，这次怎么安排？</div>
    <div class="segment-control">
      <button class="${choice==='progress'?'active':''}" onclick="setLightExerciseChoice(${index},'progress')">继续进阶</button>
      <button class="${choice==='variant'?'active':''}" onclick="setLightExerciseChoice(${index},'variant')">换个变式</button>
    </div>
  </div>`;
}

function setLightExerciseChoice(index, choice) {
  const exercise = todayPlan?.workout?.[index];
  if (!exercise?.exerciseId) return;
  exercisePreferences.lightChoices[exercise.exerciseId] = choice === 'variant' ? 'variant' : 'progress';
  LS.set('exercise_preferences', exercisePreferences);
  if (choice === 'variant') swapPlanExercise(index, true);
  else renderPlanPreview();
}

function resetTraining() {
  if (!currentUser) return;
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
        <span class="preview-role ${ex.role==='核心'?'':'aux'}">${ex.role||'辅助'}</span>
        <div style="flex:1"><div class="font-bold">${index+1}. ${escapeHtml(ex.name)}${ex.isNew?'<span class="new-exercise-badge">新动作</span>':''}</div><div class="reason-note">${escapeHtml(ex.replacementMuscle||'综合')} · ${escapeHtml(ex.pattern||'综合')} · ${escapeHtml(ex.reason||'按训练规则选择')}</div>${ex.previous?`<div class="reason-note">上次：${ex.previous.weight}kg × ${ex.previous.reps}${ex.previous.feedback?' · '+escapeHtml(ex.previous.feedback):''}</div>`:''}${exerciseInstructionBlock(ex,`preview-instruction-${index}`)}${renderLightChoice(ex,index)}</div>
      </div>
      <div class="edit-grid">
        <div class="edit-field"><label>组数</label><input type="number" min="1" max="8" value="${ex.sets}" oninput="updatePreviewField(${index},'sets',this.value)"></div>
        <div class="edit-field"><label>次数</label><input type="number" min="1" max="100" value="${ex.reps}" oninput="updatePreviewField(${index},'reps',this.value)"></div>
        <div class="edit-field"><label>重量kg</label><input type="number" min="0" step="2.5" value="${ex.weight}" oninput="updatePreviewField(${index},'weight',this.value)"></div>
        <div class="edit-field"><label>休息秒</label><input type="number" min="30" max="300" step="15" value="${ex.rest}" oninput="updatePreviewField(${index},'rest',this.value)"></div>
      </div>
      <div class="preview-actions">
        <button class="mini-btn ${ex.locked?'on':''}" onclick="togglePlanLock(${index})">${ex.locked?'🔒 已锁定':'🔓 锁定'}</button>
        <button class="mini-btn" onclick="swapPlanExercise(${index})" ${ex.locked?'disabled style="opacity:.45"':''}>换一个同类动作</button>
      </div>
    </div>`).join('');
  document.getElementById('trainingContent').innerHTML = `
    <div class="training-header"><span class="text-accent font-bold">计划预览</span><span class="plan-source local">本地规则</span></div>
    ${todayPlan.notice?`<div class="resume-banner">${escapeHtml(todayPlan.notice)}</div>`:''}
    <div style="margin-bottom:14px"><button class="btn btn-outline" onclick="aiExplainPlan()">AI 解释本计划</button><div id="aiExplain" class="text-sm text-muted text-center" style="margin:8px 0"></div></div>
    <div class="card">
      <div class="row mb-3"><div><div class="section-title" style="margin-bottom:2px">${escapeHtml(todayPlan.focus)} · ${todayPlan.variant} 方案</div><div class="text-muted text-sm">${todayPlan.workout.length} 个动作 · ${escapeHtml(todayPlan.factors.time)} · ${escapeHtml(todayPlan.factors.env)}</div></div></div>
      ${items}
    </div>
    <button class="btn btn-accent" onclick="startConfirmedPlan()">确认计划并开始</button>
    <button class="btn btn-outline mt-3" onclick="discardTodayPlan()">返回重新生成</button>`;
}

function aiExplainPlan() {
  const el = document.getElementById('aiExplain');
  if (!el) return;
  if (!getGlobalApiKey()) { el.textContent = '暂未设置 API Key，无法生成本计划解释。'; return; }
  el.textContent = '正在生成解释...';
  const summary = todayPlan.workout.map((ex,i) => `${i+1}. ${ex.name}（${ex.role||'辅助'}，${ex.replacementMuscle||ex.pattern||'综合'}）：${ex.sets}组×${ex.reps}次 ${ex.weight}kg`).join('\n');
  const prompt = `你是力量训练教练。请用中文简短解释这份 PPL 训练计划的安排逻辑，帮助用户理解为什么这样练。当前是【${todayPlan.focus}】${todayPlan.variant}方案。计划：\n${summary}\n要求：3-5 句，说明今天练什么、动作结构和训练量为何这样安排，不诊断伤病。`;
  aiCall(prompt, true).then(res => {
    if (res) el.textContent = res.trim(); else el.textContent = 'AI 暂时无响应，请稍后重试。';
  }).catch(() => { el.textContent = 'AI 暂时不可用，请稍后重试。'; });
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

function togglePlanLock(index) {
  const ex = todayPlan.workout[index];
  if (!ex) return;
  ex.locked = !ex.locked;
  if (ex.role === '核心') {
    coreLocks[ex.name] = ex.locked;
    LS.set('core_locks', coreLocks);
  }
  LS.set('today_plan', todayPlan);
  renderPlanPreview();
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
      ex.replacementMuscle === current.replacementMuscle && !usedIds.has(ex.exerciseId)
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
    for (const candidate of ordered) {
      const proposed = todayPlan.workout.slice();
      proposed[index] = candidate.exercise;
      if (engine.validatePlanBalance(proposed, todayPlan.focusKey).valid) { choice = candidate.exercise; break; }
    }
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
  todayPlan.status = 'active';
  LS.set('today_plan', todayPlan);
  LS.set('setup_draft', null);
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
    section: 'warmup',   // warmup | workout | stretch | nutrition
    warmupDone: [], stretchDone: [],
    timerInterval: null, restInterval: null
  };
  persistTrainingState();
  startSessionTimer();
}

function restoreDynamicTraining() {
  const saved = LS.get('active_training', null);
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
  LS.set('active_training', { version:1, planId:todayPlan.id, savedAt:new Date().toISOString(), state:snapshot });
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
  if (s.isResting) { renderRestOverlay(); return; }
  if (s.pendingFeedback) { renderFeedbackPrompt(); return; }
  renderTrainingUI();
}

function setSection(sec) {
  if (trainState.complete || trainState.isResting) return;
  trainState.section = sec;
  persistTrainingState();
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
    {k:'nutrition', label:'饮食', done:false}
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
      <div class="reason-note text-center">${escapeHtml(ex.reason||'按今日计划执行')}</div>
      ${recs.length > 0 ? `<div class="set-history">${recs.map(r=>`<span class="set-dot">组${r.set}:${r.w}×${r.r}</span>`).join('')}</div>` : ''}
    </div>
    <div class="training-actions">
      <div id="workoutMore" class="workout-more">
        <button class="btn btn-outline" onclick="skipExercise()">跳过当前动作</button>
        <button class="btn btn-outline" onclick="setSection('stretch')">跳过剩余训练</button>
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
      <button class="btn btn-accent mt-3" onclick="finishTraining()">完成训练</button>`;
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
    <button class="btn btn-accent mt-3" onclick="finishTraining()">完成训练</button>`;
}

function renderNutrition() {
  const n = todayPlan.nutrition;
  return `
    <div class="card">
      <div class="section-title">今日饮食建议</div>
      <div class="nutrition-card">${escapeHtml(n || 'AI 生成后在此显示今日饮食建议。')}</div>
    </div>
    ${isWorkoutDone() ? `<button class="btn btn-accent mt-3" onclick="finishTraining()">完成训练</button>` : ''}`;
}

function renderTrainingUI() {
  const s = trainState;
  setTrainingFixedAction(s.section === 'workout');
  const container = document.getElementById('trainingContent');
  let body = '';
  if (s.section === 'warmup') body = renderWarmup();
  else if (s.section === 'workout') body = renderWorkout();
  else if (s.section === 'stretch') body = renderStretch();
  else body = renderNutrition();
  container.innerHTML = `
    <div class="training-header">
      <span class="text-accent font-bold">${escapeHtml(s.day.name)}</span>
      <span class="text-muted text-sm">⏱ ${formatTime(s.sessionTime)}</span>
    </div>
    ${renderSectionTabs()}
    ${body}`;
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
  let summary = s.day.exercises.map(ex => {
    const recs = s.records[ex.id] || [];
    const vol = recs.reduce((sum,r) => sum + r.w*r.r, 0);
    return vol > 0 ? `<div class="row text-sm"><span>${escapeHtml(ex.name)}</span><span class="text-accent">${vol}kg 总容量</span></div>` : '';
  }).filter(Boolean).join('');
  if (!summary) summary = '<div class="text-muted text-sm text-center">无记录</div>';
  container.innerHTML = `
    <div class="complete-container">
      <div class="complete-icon">🏆</div>
      <div class="complete-title">${escapeHtml(s.day.name)} 完成！</div>
      <div class="complete-time">总用时 ${formatTime(s.sessionTime)}</div>
      <div class="card summary-card">${summary}</div>
      ${s.saveError ? `<div class="danger-note" style="margin-bottom:14px">${escapeHtml(s.saveError)}</div>` : ''}
      ${s.archiveNote ? `<div class="reason-note" style="margin-bottom:14px">${escapeHtml(s.archiveNote)}</div>` : ''}
      <button class="btn btn-outline mt-3" onclick="aiReviewCurrentTraining()">AI 训练评价 / 后续建议</button>
      <div id="aiReview" class="text-sm text-muted text-center" style="margin:10px 0"></div>
      <button class="btn btn-accent" onclick="resetTraining();renderTrainingPage()">再练一次</button>
      <button class="btn btn-outline mt-3" onclick="navigate('home')">返回首页</button>
    </div>
  `;
}

function adjustWeight(delta) {
  trainState.weight = Math.max(0, validWeight(trainState.weight, 0) + delta);
  persistTrainingState();
  renderWorkoutOnly();
}

function aiReviewCurrentTraining() {
  const s = trainState;
  const el = document.getElementById('aiReview');
  if (!el) return;
  if (!getGlobalApiKey()) { el.textContent = '暂未设置 API Key，无法生成评价。'; return; }
  el.textContent = '正在生成评价...';
  const summary = s.day.exercises.map(ex => {
    const recs = s.records[ex.id] || [];
    return `${ex.name}:${recs.map(r=>`${r.w}kg×${r.r}`).join('、')||'未完成'}`;
  }).join('\n');
  const prompt = `你是经验丰富的力量训练教练。请基于本次训练记录做简短评价并给出后续训练建议。用户采用 PPL 分化，本次是【${s.day.name}】，用时 ${formatTime(s.sessionTime)}。训练记录：\n${summary}\n要求：用 3-5 句中文，最多分2点建议，不诊断伤病，不承诺效果。`;
  aiCall(prompt, true).then(res => {
    if (res) el.textContent = res.trim(); else el.textContent = 'AI 暂时无响应，请稍后重试。';
  }).catch(() => { el.textContent = 'AI 暂时不可用，请稍后重试。'; });
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
  if (!s.records[ex.id]) s.records[ex.id] = [];
  s.records[ex.id].push({set:s.set, w:s.weight, r:s.reps});
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
  const s = trainState;
  s.complete = true;
  if (s.timerInterval) clearInterval(s.timerInterval);
  saveSession();
  const todayDate = formatDate(new Date());
  if (!bodyRecords.find(r => r.date === todayDate)) {
    bodyRecords.push({ date: todayDate, weight: profile.weight, bodyFat: profile.bodyFat });
    if (bodyRecords.length > 30) bodyRecords.shift();
    LS.set('body_records', bodyRecords);
  }
  renderComplete();
}

function saveSession() {
  const s = trainState;
  const session = {
    id:'session-'+Date.now(),
    date: getTodayStr(),
    dayName: s.day.name,
    focusArea: todayPlan.focus,
    factors: todayPlan.factors,
    source: todayPlan.source,
    variant: todayPlan.variant,
    catalogVersion:todayPlan.catalogVersion || '',
    duration: s.sessionTime,
    exercises: s.day.exercises.map(ex => {
      const recs = s.records[ex.id] || [];
      const feedback = s.feedback[ex.id] || {};
      return { exerciseId:ex.exerciseId||'', name:ex.name, nameSnapshot:ex.nameSnapshot||ex.name, catalogVersion:ex.catalogVersion||todayPlan.catalogVersion||'', replacementMuscle:ex.replacementMuscle||'', variantGroup:ex.variantGroup||'', role:ex.role, pattern:ex.pattern, targetSets:ex.sets, targetReps:ex.reps, completed:recs.length>=ex.sets, skipped:!!(s.skipped||{})[ex.id], feedback:feedback.value||'', feedbackNote:feedback.note||'', sets: recs.map(r => ({ w: r.w, r: r.r })) };
    }).filter(e => e.sets.length > 0 || e.skipped)
  };
  sessions.unshift(session);
  if (sessions.length > 200) {
    // 超出上限的旧记录转入归档键，导出备份时一并包含，不再直接丢弃。
    const overflow = sessions.splice(200);
    const existingArchive = LS.get('sessions_archive', []);
    const archive = Array.isArray(existingArchive) ? existingArchive : [];
    if (LS.set('sessions_archive', archive.concat(overflow).slice(-400))) {
      s.archiveNote = `历史记录超过 200 条，最早的 ${overflow.length} 次训练已自动转入归档，导出备份时会一并包含。`;
    } else {
      s.saveError = '历史记录归档失败，请及时到「我的」页面导出备份，避免旧记录丢失。';
    }
  }
  if (!LS.set('sessions', sessions)) {
    s.saveError = '训练记录未能写入本地存储（空间可能已满），请立即到「我的」页面导出备份，避免本次记录丢失。';
  }
  const key = todayPlan.focusKey || focusKeyFromText(todayPlan.focus);
  const actualIdx = plan.days.findIndex(day => focusKeyFromText(day.focus||day.name) === key);
  todayIndex = actualIdx >= 0 ? (actualIdx + 1) % plan.days.length : (todayIndex + 1) % plan.days.length;
  LS.set('today_index', todayIndex);
  cycleVariants[key] = cycleVariants[key] === 'B' ? 'A' : 'B';
  LS.set('cycle_variants', cycleVariants);
  trainingPhase.completedSessions = (trainingPhase.completedSessions||0) + 1;
  LS.set('training_phase', trainingPhase);
  applyPrevRecords();
  // 今日计划已完成，清空以便明天重新生成
  LS.set('today_plan', null);
  LS.set('active_training', null);
  todayPlan = null;
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
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 4000 }), signal:controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) { const err = await res.json().catch(() => ({})); if (!silent) alert('AI 调用失败: ' + (err.error?.message || res.status)); return null; }
    const data = await res.json();
    return data.choices[0].message.content;
  } catch(e) { if (!silent) alert('网络错误: ' + e.message); return null; }
}
