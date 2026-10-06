// ============ 首页 ============
function renderHomePage() {
  if (!currentUser) return;
  const weekSessions = getWeekSessions();
  const weekDone = weekSessions.length;
  const streak = getStreak();
  const lastS = getLastSessionSummary();
  const weekTarget = Math.max(1, profile.trainingDays);
  const weekPct = Math.min(100, Math.round(weekDone / weekTarget * 100));
  const suggested = suggestTodayFocus();
  const focusKey = todayPlan?.focusKey || suggested.key;
  const focusCode = {push:'PUSH DAY',pull:'PULL DAY',legs:'LEG DAY'}[focusKey] || 'TRAINING DAY';
  const variant = todayPlan?.variant || cycleVariants[focusKey] || 'A';
  const heroDetail = todayPlan
    ? `${todayPlan.workout.length} 个动作 · ${todayPlan.factors.time} · ${todayPlan.factors.env}`
    : `${suggested.day.name} · ${suggested.day.focus}，根据今天状态生成可执行计划`;
  const heroAction = todayPlan ? (todayPlan.status === 'preview' ? '继续确认计划' : '继续今日训练') : '生成今日计划';
  const container = document.getElementById('homeContent');
  container.innerHTML = `
    ${dataRecoveryNotice || LS.error ? `<div class="danger-note">${escapeHtml(dataRecoveryNotice || LS.error)} <button class="mini-btn" onclick="navigate('profile')">备份与恢复</button></div>` : ''}
    <header class="app-masthead">
      <div><div class="brand-word">IRONTRACK</div><div class="brand-meta">个人训练 · ${escapeHtml(plan.name)}</div></div>
      <div class="user-pill"><span>${escapeHtml(currentUser)}</span><b>${escapeHtml(String(profile.weight))}kg</b></div>
    </header>
    <section class="home-hero" onclick="navigate('training')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate('training')}">
      <div class="hero-kicker">${focusCode} · ${variant} 方案</div>
      <div class="hero-title">今天，<br>继续向上。</div>
      <div class="hero-summary">${escapeHtml(heroDetail)}</div>
      <div class="hero-action"><span>${heroAction}</span><span>→</span></div>
    </section>
    <div class="home-section-label">本周状态</div>
    <div class="home-metrics">
      <div class="home-metric primary" onclick="navigate('data')" style="cursor:pointer"><small>训练进度</small><strong>${weekDone} / ${weekTarget}</strong><div class="home-progress"><i style="width:${weekPct}%"></i></div></div>
      <div class="home-metric"><small>连续训练</small><strong>${streak}<span style="font-size:13px;color:var(--muted);margin-left:4px">天</span></strong></div>
    </div>
    <div class="home-section-label">训练概览</div>
    <div class="home-list">
      ${lastS ? `<div class="home-row" onclick="navigate('data')"><div><div class="home-row-label">上次训练 · ${escapeHtml(lastS.date)}</div><div class="home-row-value">${escapeHtml(lastS.dayName)} · ${lastS.totalSets} 组</div></div><div class="home-row-side">${lastS.totalVol.toLocaleString()}kg<br>${lastS.duration}</div></div>` : `<div class="home-row" onclick="navigate('training')"><div><div class="home-row-label">上次训练</div><div class="home-row-value">完成第一次训练后显示摘要</div></div><span class="home-row-arrow">→</span></div>`}
      <div class="home-row" onclick="navigate('plan')"><div><div class="home-row-label">训练体系</div><div class="home-row-value">${escapeHtml(plan.name)} · 下一项 ${escapeHtml(suggested.day.name)}</div></div><span class="home-row-arrow">→</span></div>
      <div class="home-row" onclick="navigate('data')"><div><div class="home-row-label">数据记录</div><div class="home-row-value">已保存 ${sessions.length} 次训练</div></div><span class="home-row-arrow">→</span></div>
    </div>`;
}

// ============ 训练体系页 ============
function renderPlanPage() {
  if (!currentUser) return;
  try {
    ensureUserDataCompatibility();
    renderPlanPageContent();
  } catch(e) {
    console.error('训练体系加载失败:', e);
    renderPageRecovery('plan');
  }
}

function renderPlanPageContent() {
  const tmpl = PLAN_TEMPLATES[profile.planTemplate] || PLAN_TEMPLATES['ppl'];
  const sugg = suggestTodayFocus();
  const todayDay = plan.days.find(d => d.focus.indexOf(sugg.focus) >= 0) || plan.days[0];
  const todayIdx = plan.days.indexOf(todayDay);

  // 循环进度链：已练=done，今天该练=active
  const cycleHtml = plan.days.map((d, i) => {
    const active = d === todayDay;
    const done = i < todayIdx;
    return `
      <div class="cycle-step ${active?'active':''}${done?' done':''}">
        <div class="cycle-dot"></div>
        <div class="cycle-name">${escapeHtml(d.name)}</div>
        <div class="cycle-focus">${escapeHtml(d.focus)}</div>
      </div>`;
  }).join('');

  // 分化结构
  const structTags = plan.days.map(d =>
    `<span class="tag">${escapeHtml(d.name)} · ${escapeHtml(d.focus)}</span>`
  ).join('');

  // 核心动作与 A/B 轮换状态。
  const libHtml = plan.days.map(d => {
    const key = focusKeyFromText(d.focus||d.name);
    const lib = EXERCISE_LIBRARY[key];
    const variant = cycleVariants[key] || 'A';
    return `<div class="lib-item">
      <div class="row"><div class="font-bold text-sm">${escapeHtml(d.name)} <span class="text-muted" style="font-weight:400">(${escapeHtml(d.focus)})</span></div><span class="plan-source">辅助 ${variant} 方案</span></div>
      <div class="exercise-tags" style="margin-top:8px">
        ${lib.core.map(e=>`<button class="tag" style="border:1px solid ${coreLocks[e.name]===false?'var(--border)':'var(--accent)'};cursor:pointer" onclick="toggleCoreLockFromSystem('${e.name}')">${coreLocks[e.name]===false?'🔓':'🔒'} ${escapeHtml(e.name)}</button>`).join('')}
      </div>
      <div class="text-muted text-xs" style="margin-top:8px">点击核心动作可锁定或解锁；辅助动作每轮在 A/B 间切换。</div>
    </div>`;
  }).join('');

  const phaseDays = Math.max(1, Math.floor((Date.now()-new Date(trainingPhase.startedAt||getTodayStr()).getTime())/86400000)+1);
  const phaseWeek = Math.max(1, Math.ceil(phaseDays/7));

  const container = document.getElementById('systemContent');
  container.innerHTML = `
    <div class="row mb-4">
      <div>
        <h1 class="section-title" style="font-size:24px;margin-bottom:2px">训练体系</h1>
        <p class="text-muted text-sm">${tmpl.name} · ${tmpl.cycle}</p>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="text-accent text-sm font-bold">当前循环进度</span></div>
      <div class="cycle-chain">${cycleHtml}</div>
      <div class="setup-recommend" style="margin-top:14px">💡 ${escapeHtml(sugg.reason)}</div>
      <div class="text-muted text-sm" style="margin-top:10px">今天建议练：<span class="text-accent font-bold">${escapeHtml(todayDay.name)}</span>（${escapeHtml(todayDay.focus)}）</div>
      <button class="btn btn-accent mt-3" onclick="navigate('training')">${todayPlan ? '继续今日训练' : '开始今日训练'}</button>
    </div>

    <div class="card">
      <div class="section-title">分化结构</div>
      <div class="flex-gap">${structTags}</div>
      ${tmpl.desc ? `<div class="text-muted text-sm" style="margin-top:12px">${tmpl.desc}</div>` : ''}
      <div class="text-muted text-xs" style="margin-top:10px">如需切换分化方式，请到「我的」页面设置</div>
    </div>

    <div class="card">
      <div class="section-title">核心动作库</div>
      <div class="text-muted text-sm" style="margin-bottom:12px">当前训练阶段第 ${phaseWeek} 周 · 已完成 ${trainingPhase.completedSessions||0} 次。核心动作默认保持 4～6 周。</div>
      ${libHtml}
      <button class="mini-btn" style="width:100%;margin-top:12px" onclick="startNewTrainingPhase()">开始新的 4～6 周训练阶段</button>
    </div>

    <div class="card">
      <div class="section-title">渐进策略</div>
      <ul class="prog-list">
        <li>每个训练日动作数量 8-15 个，时间紧张时适当减少，时间充足时增多组数。</li>
        <li>重量结合你上次表现、当天身体状态与动作难度综合判断，不强制递增。</li>
        <li>复合动作优先靠前；推/拉日适度补足肩、二头、三头，保证各部位训练量均衡。</li>
        <li>单次训练总时长控制在 60-90 分钟，含热身、正式训练与拉伸放松。</li>
      </ul>
    </div>`;
}

function toggleCoreLockFromSystem(name) {
  coreLocks[name] = coreLocks[name] === false;
  LS.set('core_locks', coreLocks);
  renderPlanPage();
}

function startNewTrainingPhase() {
  if (!confirm('确定开始新的训练阶段吗？历史训练记录会保留。')) return;
  trainingPhase = { startedAt:getTodayStr(), completedSessions:0 };
  LS.set('training_phase', trainingPhase);
  renderPlanPage();
}

// ============ 数据页 ============
function switchDataTab(tab, btn) {
  document.querySelectorAll('#page-data .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDataChart(tab);
}

function renderDataChart(tab) {
  if (!currentUser) return;
  const container = document.getElementById('dataChart');
  renderSessionHistory();
  updateWeekStats();
  if (tab === 'weight') {
    if (bodyRecords.length === 0) {
      container.innerHTML = '<div class="text-center text-muted text-sm" style="padding:40px">暂无体重记录<br>完成训练后自动记录</div>';
      return;
    }
    const max = Math.max(...bodyRecords.map(r=>r.weight));
    const min = Math.min(...bodyRecords.map(r=>r.weight));
    const range = (max - min) || 1;
    const display = bodyRecords.slice(-7);
    container.innerHTML = `
      <div class="row mb-3"><div class="font-bold text-sm">体重变化</div><span class="text-muted text-xs">最近${display.length}次</span></div>
      <div class="bar-chart">
        ${display.map(r => {
          const h = ((r.weight-min)/range)*100+20;
          return `<div class="bar-col"><span class="bar-value">${r.weight}</span><div class="bar" style="height:${h}%"><div class="bar-inner fill"></div></div><span class="bar-label">${escapeHtml(r.date)}</span></div>`;
        }).join('')}
      </div>`;
    if (display.length > 1) {
      const first = display[0].weight;
      const last = display[display.length-1].weight;
      const diff = (last - first).toFixed(1);
      const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
      container.innerHTML += `
      <div class="row mt-3 text-xs text-muted">
        <span>起始 ${first}kg</span>
        <span class="${diff<0?'text-accent':diff>0?'':'text-muted'}" style="color:${diff>0?'#f4a261':'var(--accent)'}">${arrow} ${Math.abs(diff)}kg</span>
        <span>当前 ${last}kg</span>
      </div>`;
    }
  } else if (tab === 'measure') {
    if (!measurements || measurements.length === 0) {
      container.innerHTML = '<div class="text-center text-muted text-sm" style="padding:40px">暂无围度记录<br>在「我的」页面填写围度后自动记录</div>';
      return;
    }
    const fields = [
      { key: 'chest', label: '胸围' },
      { key: 'waist', label: '腰围' },
      { key: 'arm', label: '上臂围' },
      { key: 'thigh', label: '大腿围' }
    ];
    const colors = ['var(--accent)','#f4a261','#2a9d8f','#e76f51'];
    let html = `<div class="row mb-4"><div class="font-bold text-sm">围度变化趋势</div><div class="flex-gap text-xs">${fields.map((f,i)=>`<span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${colors[i]};vertical-align:middle;margin-right:3px"></span>${f.label}</span>`).join('')}</div></div>`;
    fields.forEach((f, i) => {
      const recs = measurements.filter(r => r[f.key] > 0);
      if (recs.length === 0) return;
      const first = recs[0][f.key];
      const last = recs[recs.length-1][f.key];
      const diff = (last - first);
      const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
      html += `<div style="margin-bottom:16px">
        <div class="row text-xs text-muted mb-1"><span>${f.label}</span><span style="color:${colors[i]}">${first} → ${last}cm ${arrow} ${Math.abs(diff).toFixed(1)}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:100%;background:${colors[i]};opacity:.35"></div></div>
        <div class="text-xs text-muted mt-1" style="font-size:12px">最近记录 ${recs[recs.length-1].date}</div>
      </div>`;
    });
    if (html.indexOf('progress-bar') === -1) {
      container.innerHTML = '<div class="text-center text-muted text-sm" style="padding:40px">暂无围度记录<br>在「我的」页面填写围度后自动记录</div>';
      return;
    }
    container.innerHTML = html;
  } else {
    const allEx = {};
    [...sessions].reverse().forEach(s => {
      s.exercises.forEach(ex => {
        if (ex.sets.length > 0) {
          const maxW = Math.max(...ex.sets.map(st => st.w));
          if (!allEx[ex.name]) allEx[ex.name] = [];
          allEx[ex.name].push({ date: s.date, weight: maxW });
        }
      });
    });
    const topEx = Object.entries(allEx)
      .filter(([,v]) => v.length >= 2)
      .slice(0, 4);
    if (topEx.length === 0) {
      container.innerHTML = '<div class="text-center text-muted text-sm" style="padding:40px">完成2次以上训练后<br>可查看力量增长曲线</div>';
      return;
    }
    const colors = ['var(--accent)','#f4a261','#2a9d8f','#e76f51'];
    container.innerHTML = `
      <div class="row mb-4"><div class="font-bold text-sm">力量增长曲线</div><div class="flex-gap text-xs">${topEx.map(([n],i)=>`<span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${colors[i]};vertical-align:middle;margin-right:3px"></span>${escapeHtml(n)}</span>`).join('')}</div></div>
      ${topEx.map(([name, records], i) => {
        const first = records[0].weight;
        const last = records[records.length-1].weight;
        const pct = Math.min(100, Math.max(0, Math.round(((last - first) / Math.max(first, 1)) * 100)));
        return `<div style="margin-bottom:16px"><div class="row text-xs text-muted mb-1"><span>${escapeHtml(name)}</span><span style="color:${colors[i]}">${first} → ${last}kg ${last>=first?'+':''}${(last-first).toFixed(1)}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct>0?30+pct*0.7:10}%;background:${colors[i]}"></div></div></div>`;
      }).join('')}
      <div class="text-center text-xs text-muted mt-4">共 ${sessions.length} 次训练记录</div>`;
  }
  updateWeekStats();
}

function renderSessionHistory() {
  const el = document.getElementById('sessionHistory');
  if (!el) return;
  if (!sessions.length) {
    el.innerHTML = '<div class="text-muted text-sm">完成训练后，这里会显示记录和动作反馈。</div>';
    return;
  }
  el.innerHTML = sessions.slice(0,8).map(session => {
    const exercises = session.exercises || [];
    const feedback = exercises.filter(ex=>ex.feedback).map(ex=>`${escapeHtml(ex.name)}：${escapeHtml(ex.feedback)}${ex.feedbackNote?'（'+escapeHtml(ex.feedbackNote)+'）':''}`).join(' · ');
    const totalSets = exercises.reduce((sum,ex)=>sum+(ex.sets||[]).length,0);
    const totalVol = exercises.reduce((sum,ex)=>sum+(ex.sets||[]).reduce((s,set)=>s+(Number(set.w)||0)*(Number(set.r)||0),0),0);
    return `<div class="history-card">
      <div class="row"><div class="font-bold text-sm">${escapeHtml(session.dayName||session.focusArea||'训练')}</div><span class="text-muted text-xs">${escapeHtml(session.date)}</span></div>
      <div class="reason-note">${totalSets} 组 · ${Math.round(totalVol).toLocaleString()}kg 总容量 · ${formatTime(session.duration||0)}</div>
      ${feedback?`<div class="reason-note">反馈：${feedback}</div>`:'<div class="reason-note">此记录暂无动作反馈</div>'}
    </div>`;
  }).join('');
}

function updateWeekStats() {
  const ws = getWeekSessions();
  const totalSets = ws.reduce((s, sess) => s + sess.exercises.reduce((es, ex) => es + ex.sets.length, 0), 0);
  const totalVol = ws.reduce((s, sess) => s + sess.exercises.reduce((es, ex) => es + ex.sets.reduce((ss, st) => ss + st.w*st.r, 0), 0), 0);
  const totalTime = ws.reduce((s, sess) => s + (sess.duration||0), 0);
  const statsEl = document.getElementById('weekStats');
  if (statsEl) {
    const target = Math.max(1, profile.trainingDays);
    const pct = Math.min(100, Math.round(ws.length / target * 100));
    statsEl.innerHTML = `
      <div class="stat-item-2"><div class="val">${ws.length}</div><div class="lbl">完成训练</div></div>
      <div class="stat-item-2"><div class="val">${totalSets}</div><div class="lbl">总组数</div></div>
      <div class="stat-item-2"><div class="val">${totalVol.toLocaleString()}</div><div class="lbl">总容量 kg</div></div>
      <div class="stat-item-2"><div class="val">${(totalTime/3600).toFixed(1)}h</div><div class="lbl">总时长</div></div>
      <div class="stat-item-2" style="grid-column:1/-1;text-align:left">
        <div class="row mb-1"><span class="lbl" style="font-size:14px">本周完成率</span><span class="font-bold text-accent" style="font-size:18px">${pct}%</span></div>
        <div class="progress-bar" style="height:10px"><div class="progress-fill" style="width:${pct}%;background:var(--accent)"></div></div>
        <div class="lbl" style="font-size:12px;margin-top:4px">目标 ${target} 次/周 · 已完成 ${ws.length} 次</div>
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
      <div class="card"><div class="section-title">身体数据</div>
        <div class="grid-2">
          <div class="field-group"><span class="field-label">身高 (cm)</span><input class="field-value" id="pf-height" type="number" value="${profile.height}" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);font-size:17px"></div>
          <div class="field-group"><span class="field-label">体重 (kg)</span><input class="field-value" id="pf-weight" type="number" step="0.1" value="${profile.weight}" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);font-size:17px"></div>
          <div class="field-group"><span class="field-label">体脂率 (%)</span><input class="field-value" id="pf-bodyfat" type="number" value="${profile.bodyFat}" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);font-size:17px"></div>
          <div class="field-group"><span class="field-label">每周训练天数</span><input class="field-value" id="pf-days" type="number" min="1" max="7" value="${profile.trainingDays}" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);font-size:17px"></div>
        </div>
      </div>
      <div class="card"><div class="section-title">身体围度 (cm)</div>
        <div class="grid-2">
          <div class="field-group"><span class="field-label">胸围</span><input class="field-value" id="pf-chest" type="number" step="0.1" value="${profile.chest||0}" placeholder="0" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);font-size:17px"></div>
          <div class="field-group"><span class="field-label">腰围</span><input class="field-value" id="pf-waist" type="number" step="0.1" value="${profile.waist||0}" placeholder="0" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);font-size:17px"></div>
          <div class="field-group"><span class="field-label">上臂围</span><input class="field-value" id="pf-arm" type="number" step="0.1" value="${profile.arm||0}" placeholder="0" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);font-size:17px"></div>
          <div class="field-group"><span class="field-label">大腿围</span><input class="field-value" id="pf-thigh" type="number" step="0.1" value="${profile.thigh||0}" placeholder="0" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);font-size:17px"></div>
        </div>
        <div class="text-xs text-muted mt-2">保存后可在「数据追踪」查看围度变化趋势</div>
      </div>
      <div class="card"><div class="section-title">训练偏好</div>
        <div class="field-group"><span class="field-label">训练目标</span>
          <select class="field-value" id="pf-goal" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);appearance:none;font-size:17px">
            <option value="增肌塑形" ${profile.goal==='增肌塑形'?'selected':''}>增肌塑形</option>
            <option value="减脂瘦身" ${profile.goal==='减脂瘦身'?'selected':''}>减脂瘦身</option>
            <option value="综合体能" ${profile.goal==='综合体能'?'selected':''}>综合体能</option>
            <option value="力量举" ${profile.goal==='力量举'?'selected':''}>力量举</option>
          </select>
        </div>
        <div class="field-group"><span class="field-label">经验水平</span>
          <select class="field-value" id="pf-exp" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);appearance:none;font-size:17px">
            <option value="新手入门" ${profile.experience==='新手入门'?'selected':''}>新手入门</option>
            <option value="有一定基础" ${profile.experience==='有一定基础'?'selected':''}>有一定基础</option>
            <option value="中级进阶" ${profile.experience==='中级进阶'?'selected':''}>中级进阶</option>
            <option value="高级训练者" ${profile.experience==='高级训练者'?'selected':''}>高级训练者</option>
          </select>
        </div>
      </div>
      <div class="card"><div class="section-title">分化方式</div>
        <div class="field-group"><span class="field-label">训练计划模板</span>
          <select class="field-value" id="pf-plan" onchange="switchPlan(this.value)" style="width:100%;border:none;outline:none;color:var(--text);background:var(--bg);appearance:none;font-size:17px">
            ${Object.entries(PLAN_TEMPLATES).map(([k,v]) => `<option value="${k}" ${profile.planTemplate===k?'selected':''}>${v.name} - ${v.desc}</option>`).join('')}
          </select>
        </div>
        <div class="text-xs text-muted mt-2">切换模板会重置训练计划，但保留历史训练记录</div>
      </div>
      <div class="card"><div class="section-title">可用器械</div>
        <div class="text-xs text-muted mb-3">勾选你健身房可用的器械，AI 生成计划时会参考</div>
        <div class="flex-gap" id="pf-equipment">
          ${EQUIPMENT_OPTIONS.map(opt => `
            <span data-eq="${escapeHtml(opt)}" class="eq-chip ${profile.equipment.includes(opt)?'eq-on':''}" onclick="toggleEquipment(this.dataset.eq, this)">${escapeHtml(opt)}</span>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <input class="field-value" id="pf-eq-new" type="text" placeholder="添加自定义器械" style="flex:1;border:none;outline:none;color:var(--text);background:var(--bg);font-size:16px">
          <button onclick="addEquipment()" style="padding:8px 18px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:15px;cursor:pointer;min-height:44px;white-space:nowrap">添加</button>
        </div>
      </div>
      <div class="card"><div class="section-title">暂停推荐的动作</div>
        <div class="text-xs text-muted mb-3">训练后选择“不适”的动作会暂停出现在新计划中。恢复后才会再次参与推荐。</div>
        ${renderPausedExerciseRows()}
      </div>
      <div class="card"><div class="section-title">AI 设置</div>
        <div class="field-group"><span class="field-label">DeepSeek API Key（所有用户共享）</span>
          <div style="display:flex;gap:8px">
            <input class="field-value" id="pf-apiKey" type="password" value="${apiKey}" placeholder="sk-..." style="flex:1;border:none;outline:none;color:var(--text);background:var(--bg);font-size:15px">
            <button onclick="testApiKey()" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;white-space:nowrap;min-height:44px">测试连接</button>
          </div>
        </div>
        <div class="text-xs text-muted mt-2">在 <a href="https://platform.deepseek.com" target="_blank" style="color:var(--accent)">platform.deepseek.com</a> 获取 Key，设置一次即可，所有用户共用</div>
        <div id="apiTestMsg" class="text-xs mt-2"></div>
      </div>
      <div class="card"><div class="section-title">本地数据备份</div>
        <div class="text-muted text-sm" style="line-height:1.6;margin-bottom:14px">训练数据只保存在当前浏览器。建议定期导出；备份不包含 API Key。</div>
        <div style="display:flex;gap:10px">
          <button class="mini-btn" style="flex:1" onclick="exportBackup()">导出备份</button>
          <button class="mini-btn" style="flex:1" onclick="document.getElementById('backupFile').click()">导入恢复</button>
        </div>
        <input id="backupFile" type="file" accept="application/json,.json" style="display:none" onchange="importBackupFile(this.files[0]);this.value=''">
        <div id="backupMsg" class="text-xs text-muted mt-3">${escapeHtml(dataRecoveryNotice || LS.error)}</div>
        ${renderRecoveryOptions()}
      </div>
      <button class="btn btn-accent" onclick="saveProfile()">保存修改</button>
      <div class="text-center text-xs text-muted mt-3" id="saveMsg"></div>`;
}

function toggleEquipment(name, chip) {
  if (!profile.equipment) profile.equipment = [];
  const idx = profile.equipment.indexOf(name);
  if (idx >= 0) profile.equipment.splice(idx, 1);
  else profile.equipment.push(name);
  // 更新 UI 选中态
  if (!chip) chip = document.querySelector('[data-eq="' + CSS.escape(name) + '"]');
  if (chip) chip.classList.toggle('eq-on');
}

function addEquipment() {
  const input = document.getElementById('pf-eq-new');
  const name = input.value.trim();
  if (!name) return;
  if (!EQUIPMENT_OPTIONS.includes(name)) EQUIPMENT_OPTIONS.push(name);
  if (!profile.equipment) profile.equipment = [];
  if (!profile.equipment.includes(name)) profile.equipment.push(name);
  input.value = '';
  // 重新渲染器械卡片
  const eqEl = document.getElementById('pf-equipment');
  eqEl.innerHTML = EQUIPMENT_OPTIONS.map(opt => `
    <span data-eq="${escapeHtml(opt)}" class="eq-chip ${profile.equipment.includes(opt)?'eq-on':''}" onclick="toggleEquipment(this.dataset.eq, this)">${escapeHtml(opt)}</span>
  `).join('');
}

function saveProfile() {
  profile.height = parseFloat(document.getElementById('pf-height').value) || profile.height;
  profile.weight = parseFloat(document.getElementById('pf-weight').value) || profile.weight;
  profile.bodyFat = parseFloat(document.getElementById('pf-bodyfat').value) || profile.bodyFat;
  profile.trainingDays = parseInt(document.getElementById('pf-days').value) || profile.trainingDays;
  profile.goal = document.getElementById('pf-goal').value;
  profile.experience = document.getElementById('pf-exp').value;

  // 保存围度记录（仅在非空时记录，用于趋势追踪）
  const chest = parseFloat(document.getElementById('pf-chest').value);
  const waist = parseFloat(document.getElementById('pf-waist').value);
  const arm = parseFloat(document.getElementById('pf-arm').value);
  const thigh = parseFloat(document.getElementById('pf-thigh').value);
  if (!isNaN(chest)) profile.chest = chest;
  if (!isNaN(waist)) profile.waist = waist;
  if (!isNaN(arm)) profile.arm = arm;
  if (!isNaN(thigh)) profile.thigh = thigh;
  if (chest > 0 || waist > 0 || arm > 0 || thigh > 0) {
    var now = new Date();
    var rec = { date: now.getFullYear()+'-'+(now.getMonth()+1).toString().padStart(2,'0')+'-'+now.getDate().toString().padStart(2,'0') };
    if (chest > 0) rec.chest = chest;
    if (waist > 0) rec.waist = waist;
    if (arm > 0) rec.arm = arm;
    if (thigh > 0) rec.thigh = thigh;
    var mrecs = LS.get('measurements', []);
    mrecs.push(rec);
    if (LS.set('measurements', mrecs)) measurements = mrecs;
  }

  LS.set('profile', profile);

  // API Key 保存到全局
  const apiKey = document.getElementById('pf-apiKey').value.trim();
  setGlobalApiKey(apiKey);

  var msg = document.getElementById('saveMsg');
  msg.textContent = '已保存';
  setTimeout(function(){ msg.textContent = ''; }, 2000);
  renderUserSection();
  renderHomePage();
}

async function testApiKey() {
  const key = document.getElementById('pf-apiKey').value.trim();
  if (!key) { document.getElementById('apiTestMsg').innerHTML = '<span style="color:#f4a261">请输入 API Key</span>'; return; }
  document.getElementById('apiTestMsg').innerHTML = '<span style="color:var(--muted)">测试中...</span>';
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: '回复"OK"' }], max_tokens: 5 })
    });
    if (res.ok) {
      setGlobalApiKey(key);
      document.getElementById('apiTestMsg').innerHTML = '<span style="color:#2a9d8f">连接成功，已保存</span>';
    } else {
      const err = await res.json().catch(() => ({}));
      document.getElementById('apiTestMsg').innerHTML = '<span style="color:#e76f51">连接失败: ' + (err.error?.message || res.status) + '</span>';
    }
  } catch(e) {
    document.getElementById('apiTestMsg').innerHTML = '<span style="color:#e76f51">网络错误: ' + e.message + '</span>';
  }
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
  if (includePending) Object.assign(data, normalizeUserData(data).data);
  if (includePending && todayPlan?.status === 'active' && trainState.day) {
    data.today_plan = todayPlan;
    data.active_training = { version:1, planId:todayPlan.id, savedAt:new Date().toISOString(), state:{...trainState,timerInterval:null,restInterval:null} };
  }
  if (includePending && trainState.pendingCompletion && !trainState.saved) Object.assign(data, completionData(trainState.pendingCompletion));
  const payload = { app:'IronTrack', version:BACKUP_VERSION, user:currentUser, exportedAt:new Date().toISOString(), whitelistVersion:PPL_WHITELIST_VERSION, data };
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
  if (!isPlainRecord(payload) || payload.app !== 'IronTrack' || ![1,2].includes(Number(payload.version)) || !isPlainRecord(payload.data)) throw new Error('文件格式或版本不支持');
  if (!isPlainRecord(payload.data.profile) || !isPlainRecord(payload.data.plan) || !Array.isArray(payload.data.sessions)) throw new Error('备份缺少个人档案、训练体系或历史记录');
  if(payload.recovery!=null&&!isPlainRecord(payload.recovery))throw new Error('恢复资料格式异常');
  return normalizeUserData(payload.data,true).data;
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
