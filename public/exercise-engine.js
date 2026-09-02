(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IronTrackExerciseEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BALANCE_RULES = {
    push: [
      { key:'水平推', patterns:['水平推'] },
      { key:'肩部刺激', patterns:['垂直推','肩外展','肩屈','肩后束'] },
      { key:'肘伸', patterns:['肘伸'] }
    ],
    pull: [
      { key:'水平拉', patterns:['水平拉'] },
      { key:'垂直拉', patterns:['垂直拉'] },
      { key:'肘屈或后束', patterns:['肘屈','肩后束'] }
    ],
    legs: [
      { key:'膝主导', patterns:['膝主导','单腿膝主导','膝伸'] },
      { key:'髋主导', patterns:['髋主导'] },
      { key:'屈膝或单腿', patterns:['屈膝','单腿膝主导'] },
      { key:'小腿', patterns:['提踵'] },
      { key:'核心', patterns:['核心'] }
    ]
  };

  function list(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function stableHash(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function normalizeExercise(value) {
    if (!value || typeof value !== 'object') return null;
    const exerciseId = String(value.exerciseId || value.id || '').trim();
    const nameZh = String(value.nameZh || value.name || '').trim();
    const patterns = list(value.movementPatterns || (value.pattern ? [value.pattern] : []));
    const equipment = list(value.equipment);
    const primaryMuscles = list(value.primaryMuscles || (value.replacementMuscle ? [value.replacementMuscle] : []));
    if (!exerciseId || !nameZh || !patterns.length || !equipment.length || !primaryMuscles.length) return null;
    const defaults = value.trainingDefaults || {};
    return {
      exerciseId,
      sourceId:value.sourceId || null,
      name:nameZh,
      nameZh,
      nameEn:String(value.nameEn || ''),
      aliasesZh:list(value.aliasesZh),
      pplTags:list(value.pplTags),
      primaryMuscles,
      replacementMuscle:String(value.replacementMuscle || primaryMuscles[0]),
      secondaryMuscles:list(value.secondaryMuscles),
      pattern:patterns[0],
      movementPatterns:patterns,
      equipment,
      loadRegions:list(value.loadRegions),
      roleEligibility:list(value.roleEligibility),
      variantGroup:String(value.variantGroup || patterns[0]),
      substitutionGroup:String(value.substitutionGroup || ''),
      balanceTags:list(value.balanceTags || patterns),
      recommendationStatus:String(value.recommendationStatus || '自动推荐'),
      qualityTier:String(value.qualityTier || 'A'),
      sets:Number(defaults.sets) || Number(value.sets) || 3,
      reps:Number(defaults.reps) || Number(value.reps) || 10,
      weight:Number(value.weight) || 0,
      rest:Number(defaults.rest) || Number(value.rest) || 60,
      catalogVersion:String(value.catalogVersion || '')
    };
  }

  function resolveLegacyExercise(reference, catalog) {
    const ref = typeof reference === 'string' ? { name:reference } : (reference || {});
    const exercises = list(catalog && catalog.exercises);
    const directId = String(ref.exerciseId || '').trim();
    if (directId) {
      const direct = exercises.find(item => item.exerciseId === directId);
      if (direct) return direct;
      if (/^irontrack:legacy-/.test(directId)) return { exerciseId:directId, nameZh:String(ref.name || ref.nameZh || '') };
    }
    const name = String(ref.name || ref.nameZh || '').trim();
    if (!name) return null;
    const mappedId = catalog && catalog.legacyNameMap ? catalog.legacyNameMap[name] : null;
    if (mappedId) {
      return exercises.find(item => item.exerciseId === mappedId) || { exerciseId:mappedId, nameZh:name };
    }
    const matches = exercises.filter(item => item.nameZh === name || list(item.aliasesZh).includes(name));
    return matches.length === 1 ? matches[0] : null;
  }

  function migrateLegacyData(value, catalog) {
    const data = value == null ? value : JSON.parse(JSON.stringify(value));
    let changes = 0;
    const migrateExercise = exercise => {
      if (!exercise || typeof exercise !== 'object') return;
      const resolved = resolveLegacyExercise(exercise, catalog);
      const exerciseId = resolved && resolved.exerciseId;
      if (!exerciseId) return;
      if (!exercise.exerciseId) { exercise.exerciseId = exerciseId; changes++; }
      if (!exercise.nameSnapshot && exercise.name) { exercise.nameSnapshot = exercise.name; changes++; }
      if (exerciseId.startsWith('exds:') && !exercise.catalogVersion) { exercise.catalogVersion = String(catalog?.version || ''); changes++; }
    };
    const migrateList = list => Array.isArray(list) && list.forEach(migrateExercise);
    (data?.plan?.days || []).forEach(day => migrateList(day?.exercises));
    (data?.sessions || []).forEach(session => migrateList(session?.exercises));
    migrateList(data?.today_plan?.workout);
    migrateList(data?.active_training?.state?.day?.exercises);
    return { data, changes };
  }

  function filterCandidates(catalogOrExercises, context) {
    const source = Array.isArray(catalogOrExercises) ? catalogOrExercises : list(catalogOrExercises && catalogOrExercises.exercises);
    const ctx = context || {};
    const paused = new Set(list(ctx.pausedIds));
    const discomfort = new Set(list(ctx.discomfort).filter(item => item !== '无'));
    const avoidTerms = list(ctx.avoidTerms).map(item => String(item).trim()).filter(Boolean);
    const available = new Set(list(ctx.availableEquipment));
    const env = ctx.environment || '';
    return source.map(normalizeExercise).filter(Boolean).filter(exercise => {
      if (exercise.recommendationStatus !== '自动推荐' || exercise.qualityTier !== 'A') return false;
      if (ctx.focusKey && !exercise.pplTags.includes(ctx.focusKey)) return false;
      if (paused.has(exercise.exerciseId)) return false;
      if (avoidTerms.some(term => exercise.name.includes(term) || term.includes(exercise.name))) return false;
      if (exercise.loadRegions.some(region => discomfort.has(region))) return false;
      if (env === '家用徒手' && !exercise.equipment.includes('徒手')) return false;
      if (env === '家用哑铃' && !exercise.equipment.some(item => item === '徒手' || item === '哑铃')) return false;
      if (env === '健身房' && available.size && !exercise.equipment.some(item => available.has(item) || item === '徒手')) return false;
      return true;
    });
  }

  function selectRotationSlots(auxiliaryCount, seed) {
    const count = Math.max(0, Math.floor(Number(auxiliaryCount) || 0));
    if (count <= 1) return [];
    const replacementCount = Math.max(1, Math.min(count - 1, Math.round(count * 0.35)));
    return Array.from({ length:count }, (_, index) => index)
      .sort((a, b) => stableHash(`${seed || ''}:${a}`) - stableHash(`${seed || ''}:${b}`) || a - b)
      .slice(0, replacementCount)
      .sort((a, b) => a - b);
  }

  function scoreCandidates(candidates, context) {
    const ctx = context || {};
    const recentIds = new Set(list(ctx.recentExerciseIds));
    const usedIds = new Set(list(ctx.usedIds));
    const lastUsed = ctx.lastUsed || {};
    return list(candidates).map(normalizeExercise).filter(Boolean).map(exercise => {
      let score = 0;
      if (!recentIds.has(exercise.exerciseId)) score += 1000;
      else score -= 1000;
      if (!Object.prototype.hasOwnProperty.call(lastUsed, exercise.exerciseId)) score += 300;
      else score += Math.min(250, Math.max(0, Number(lastUsed[exercise.exerciseId]) || 0));
      if (ctx.replacementMuscle && exercise.replacementMuscle === ctx.replacementMuscle) score += 200;
      if (ctx.currentVariantGroup && exercise.variantGroup === ctx.currentVariantGroup) score -= 80;
      if (usedIds.has(exercise.exerciseId)) score -= 5000;
      score += (stableHash(`${ctx.seed || ''}:${exercise.exerciseId}`) % 1000) / 1000;
      return { exercise, score };
    }).sort((a, b) => b.score - a.score || a.exercise.exerciseId.localeCompare(b.exercise.exerciseId));
  }

  function validatePlanBalance(workout, focusKey) {
    const patterns = new Set(list(workout).flatMap(item => list(item.movementPatterns || (item.pattern ? [item.pattern] : []))));
    const rules = BALANCE_RULES[focusKey] || [];
    const missing = rules.filter(rule => !rule.patterns.some(pattern => patterns.has(pattern))).map(rule => rule.key);
    return { valid:missing.length === 0, missing };
  }

  function validateCandidateSequence(items, skeleton, allowed, focusKey) {
    const requested = list(items);
    const slots = list(skeleton);
    if (requested.length !== slots.length) return { valid:false, error:'动作数量与本地骨架不一致' };
    const allowedMap = new Map(list(allowed).map(normalizeExercise).filter(Boolean).map(item => [item.exerciseId,item]));
    const ids = requested.map(item => String(item?.exerciseId || ''));
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) return { valid:false, error:'动作编号缺失或重复' };
    const workout = [];
    for (let index = 0; index < slots.length; index++) {
      const slot = slots[index] || {};
      const selected = allowedMap.get(ids[index]);
      if (!selected) return { valid:false, error:'出现范围外动作' };
      if (slot.locked && selected.exerciseId !== slot.exerciseId) return { valid:false, error:'锁定动作被改变' };
      if (selected.exerciseId !== slot.exerciseId && selected.replacementMuscle !== slot.replacementMuscle) {
        return { valid:false, error:'替代动作目标肌群不一致' };
      }
      workout.push(selected);
    }
    const balance = validatePlanBalance(workout, focusKey);
    if (!balance.valid) return { valid:false, error:`训练结构缺少：${balance.missing.join('、')}` };
    return { valid:true, workout };
  }

  function pickForRule(candidates, rule, context) {
    const matches = candidates.filter(item => rule.patterns.some(pattern => item.movementPatterns.includes(pattern)));
    return scoreCandidates(matches, context)[0]?.exercise || null;
  }

  function buildFallbackPlan(options) {
    const opts = options || {};
    const core = list(opts.core).map(normalizeExercise).filter(Boolean);
    const candidates = list(opts.candidates).map(normalizeExercise).filter(Boolean);
    const totalCount = Math.max(core.length, Math.floor(Number(opts.count) || 0));
    const auxiliaryCount = Math.max(0, totalCount - core.length);
    const recentExerciseIds = list(opts.recentExerciseIds);
    const previous = list(opts.previous).map(normalizeExercise).filter(Boolean);
    const byId = new Map(candidates.map(item => [item.exerciseId, item]));
    const byName = new Map(candidates.map(item => [item.name, item]));
    const previousCandidates = previous.map(item => byId.get(item.exerciseId) || byName.get(item.name)).filter(Boolean);
    const chosen = [];
    const usedIds = new Set(core.map(item => item.exerciseId));
    const seed = String(opts.seed || 'irontrack');
    const rotatedSlots = [];
    const pushChosen = item => { if (item && !usedIds.has(item.exerciseId) && chosen.length < auxiliaryCount) { chosen.push(item); usedIds.add(item.exerciseId); return true; } return false; };

    if (!previousCandidates.length) {
      const current = core.slice();
      for (const rule of BALANCE_RULES[opts.focusKey] || []) {
        if (rule.patterns.some(pattern => current.concat(chosen).some(item => item.movementPatterns.includes(pattern)))) continue;
        pushChosen(pickForRule(candidates, rule, { seed, recentExerciseIds, usedIds:[...usedIds] }));
      }
      const ranked = scoreCandidates(candidates, { seed, recentExerciseIds, usedIds:[...usedIds], lastUsed:opts.lastUsed });
      for (const item of ranked) pushChosen(item.exercise);
    } else {
      for (const item of previousCandidates.slice(0, auxiliaryCount)) pushChosen(item);
      const rankedFill = scoreCandidates(candidates, { seed:`${seed}:fill`, recentExerciseIds, usedIds:[...usedIds], lastUsed:opts.lastUsed });
      for (const item of rankedFill) pushChosen(item.exercise);
      const replaceSlots = selectRotationSlots(chosen.length, seed);
      for (const index of replaceSlots) {
        const current = chosen[index];
        usedIds.delete(current.exerciseId);
        const pool = candidates.filter(item => item.replacementMuscle === current.replacementMuscle && item.exerciseId !== current.exerciseId);
        const replacement = scoreCandidates(pool, {
          seed:`${seed}:replace:${index}`,
          recentExerciseIds,
          usedIds:[...usedIds],
          lastUsed:opts.lastUsed,
          replacementMuscle:current.replacementMuscle,
          currentVariantGroup:current.variantGroup
        })[0]?.exercise;
        if (replacement) {
          chosen[index] = replacement;
          rotatedSlots.push(index);
        }
        usedIds.add(chosen[index].exerciseId);
      }
    }

    return {
      workout:core.concat(chosen.slice(0, auxiliaryCount)),
      rotatedSlots,
      balance:validatePlanBalance(core.concat(chosen), opts.focusKey)
    };
  }

  return {
    BALANCE_RULES,
    normalizeExercise,
    resolveLegacyExercise,
    migrateLegacyData,
    filterCandidates,
    selectRotationSlots,
    scoreCandidates,
    validatePlanBalance,
    validateCandidateSequence,
    buildFallbackPlan
  };
});
