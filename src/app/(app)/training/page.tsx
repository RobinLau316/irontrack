"use client";

import { useState, useEffect, useCallback } from "react";
import { cooldownRoutine, mockPlan, mockProfile, trainingDurations, warmupRoutine } from "@/lib/data";
import type { SetRecord } from "@/lib/types";

export default function TrainingPage() {
  const today = mockPlan.days[0];
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [strengthLevel, setStrengthLevel] = useState(mockProfile.strengthLevel);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [weight, setWeight] = useState(today.exercises[0].baseWeight);
  const [reps, setReps] = useState(today.exercises[0].targetReps);
  const [records, setRecords] = useState<Record<string, SetRecord[]>>({});
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);

  const exerciseCount = selectedDuration <= 30 ? 3 : selectedDuration <= 45 ? 4 : selectedDuration <= 60 ? 5 : 6;
  const activeExercises = today.exercises.slice(0, exerciseCount);
  const currentEx = activeExercises[currentExIndex];
  const weightMultiplier = strengthLevel === "新手" ? 0.7 : strengthLevel === "进阶" ? 1.15 : 1;

  useEffect(() => {
    const saved = window.localStorage.getItem("irontrack-profile");
    if (saved) {
      const profile = JSON.parse(saved) as typeof mockProfile;
      setStrengthLevel(profile.strengthLevel);
    }
  }, []);

  const startingWeight = (exercise: typeof today.exercises[number]) => {
    if (exercise.baseWeight === 0) return 0;
    return Math.round((exercise.baseWeight * weightMultiplier) / 2.5) * 2.5;
  };

  useEffect(() => {
    if (!hasStarted || isComplete) return;
    const timer = setInterval(() => setSessionTime((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [hasStarted, isComplete]);

  useEffect(() => {
    if (!isResting) return;
    if (restTimer <= 0) {
      setIsResting(false);
      return;
    }
    const timer = setInterval(() => setRestTimer((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [isResting, restTimer]);

  const handleCompleteSet = useCallback(() => {
    const key = currentEx.id;
    const newRecords = { ...records };
    if (!newRecords[key]) newRecords[key] = [];
    newRecords[key].push({ setNumber: currentSet, actualWeight: weight, actualReps: reps, completed: true });
    setRecords(newRecords);

    if (currentSet < currentEx.targetSets) {
      setCurrentSet(currentSet + 1);
      setRestTimer(currentEx.restSeconds);
      setIsResting(true);
    } else if (currentExIndex < activeExercises.length - 1) {
      const next = activeExercises[currentExIndex + 1];
      setCurrentExIndex(currentExIndex + 1);
      setCurrentSet(1);
      setWeight(startingWeight(next));
      setReps(next.targetReps);
      setRestTimer(90);
      setIsResting(true);
    } else {
      setIsCooldown(true);
    }
  }, [currentSet, currentEx, currentExIndex, weight, reps, records, activeExercises]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const resetWorkout = () => {
    setIsComplete(false);
    setIsCooldown(false);
    setHasStarted(false);
    setCurrentExIndex(0);
    setCurrentSet(1);
    setWeight(startingWeight(today.exercises[0]));
    setReps(today.exercises[0].targetReps);
    setRecords({});
    setSessionTime(0);
  };

  if (!hasStarted) {
    return (
      <div className="space-y-5 pb-4">
        <div>
          <div className="text-accent text-sm font-medium">{today.dayName}</div>
          <h1 className="text-2xl font-bold mt-1">开始今日训练</h1>
          <p className="text-text-muted text-sm mt-1">先选择目标时长，系统会自动保留最重要的训练动作。</p>
        </div>

        <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
          <h2 className="font-bold text-sm mb-3">目标训练时长</h2>
          <div className="grid grid-cols-4 gap-2">
            {trainingDurations.map((duration) => (
              <button key={duration} onClick={() => setSelectedDuration(duration)} className={`rounded-xl py-3 text-sm font-bold border transition-colors ${selectedDuration === duration ? "bg-accent text-white border-accent" : "bg-dark-bg text-text-muted border-dark-border"}`}>
                {duration}分
              </button>
            ))}
          </div>
          <p className="text-text-muted text-xs mt-3">将完成热身 {warmupRoutine.duration} 分钟 + {activeExercises.length} 个主训练动作 + 拉伸 {cooldownRoutine.duration} 分钟</p>
        </div>

        <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border"><h2 className="font-bold text-sm">本次训练安排</h2></div>
          <div className="px-4 py-3 border-b border-dark-border">
            <div className="flex justify-between"><span className="font-medium text-sm">{warmupRoutine.name}</span><span className="text-accent text-xs">{warmupRoutine.duration} 分钟</span></div>
            <p className="text-text-muted text-xs mt-1">{warmupRoutine.description}</p>
          </div>
          {activeExercises.map((exercise, index) => (
            <div key={exercise.id} className="px-4 py-3 flex items-center gap-3 border-b border-dark-border">
              <span className="text-accent font-bold text-sm w-5">{index + 1}</span>
              <div className="flex-1 min-w-0"><div className="font-medium text-sm">{exercise.name}</div><div className="text-text-muted text-xs">{exercise.targetSets} 组 × {exercise.targetReps} 次</div></div>
              <span className="text-text-muted text-xs">基础 {startingWeight(exercise)}kg</span>
            </div>
          ))}
          <div className="px-4 py-3">
            <div className="flex justify-between"><span className="font-medium text-sm">{cooldownRoutine.name}</span><span className="text-accent text-xs">{cooldownRoutine.duration} 分钟</span></div>
            <p className="text-text-muted text-xs mt-1">{cooldownRoutine.description}</p>
          </div>
        </div>

        <button onClick={() => { setHasStarted(true); setWeight(startingWeight(activeExercises[0])); }} className="w-full bg-accent rounded-2xl py-4 text-white font-bold text-lg btn-glow">开始训练</button>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center"><span className="text-4xl">🏆</span></div>
        <div><h1 className="text-2xl font-bold">训练完成！</h1><p className="text-text-muted mt-2">总用时 {formatTime(sessionTime)}</p></div>
        <div className="bg-dark-card rounded-2xl p-4 w-full border border-dark-border space-y-2">
          {activeExercises.map((ex) => {
            const totalVolume = (records[ex.id] || []).reduce((sum, r) => sum + r.actualWeight * r.actualReps, 0);
            return <div key={ex.id} className="flex justify-between text-sm"><span>{ex.name}</span><span className="text-accent">{totalVolume}kg 总容量</span></div>;
          })}
        </div>
        <button onClick={resetWorkout} className="px-8 py-3 bg-accent rounded-2xl text-white font-bold">再来一次</button>
      </div>
    );
  }

  if (isCooldown) {
    return (
      <div className="min-h-[70vh] flex flex-col justify-center space-y-6">
        <div className="text-center"><div className="text-accent text-sm font-medium">主训练完成</div><h1 className="text-2xl font-bold mt-2">训练后拉伸</h1><p className="text-text-muted text-sm mt-2">{cooldownRoutine.description}</p></div>
        <div className="bg-dark-card rounded-2xl p-4 border border-dark-border space-y-3">{cooldownRoutine.items.map((item) => <div key={item} className="flex gap-3 text-sm"><span className="text-accent">✓</span><span>{item}</span></div>)}</div>
        <button onClick={() => { setIsCooldown(false); setIsComplete(true); }} className="w-full bg-accent rounded-2xl py-4 text-white font-bold text-lg btn-glow">完成拉伸并结束</button>
      </div>
    );
  }

  if (isResting) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8">
        <div className="text-text-muted text-sm">组间休息</div><div className="w-32 h-32 rounded-full border-4 border-accent flex items-center justify-center"><span className="text-4xl font-bold num-display text-accent">{restTimer}</span></div>
        <div className="text-text-muted text-sm">下一组：第 {currentSet} 组 · {currentEx.name}</div>
        <button onClick={() => { setIsResting(false); setRestTimer(0); }} className="px-6 py-2 border border-dark-border rounded-xl text-text-muted text-sm">跳过休息</button>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col pb-4">
      <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-2"><span className="text-accent font-bold">{today.dayName}</span><span className="text-text-muted text-sm">⏱ {formatTime(sessionTime)}</span></div><span className="text-text-muted text-sm">{currentExIndex + 1}/{activeExercises.length}</span></div>
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <div className="text-center"><h2 className="text-2xl font-bold">{currentEx.name}</h2><p className="text-text-muted text-sm mt-1">目标 {startingWeight(currentEx)}kg · {currentEx.targetSets}组 × {currentEx.targetReps}次</p></div>
        <div className="flex items-center gap-6"><button onClick={() => setWeight(Math.max(0, weight - 2.5))} className="w-12 h-12 rounded-full bg-dark-card border border-dark-border flex items-center justify-center text-2xl">−</button><div className="text-center"><div className="text-5xl font-bold num-display text-accent">{weight}</div><div className="text-text-muted text-sm mt-1">kg</div></div><button onClick={() => setWeight(weight + 2.5)} className="w-12 h-12 rounded-full bg-dark-card border border-dark-border flex items-center justify-center text-2xl">+</button></div>
        <div className="flex items-center gap-6"><button onClick={() => setReps(Math.max(0, reps - 1))} className="w-12 h-12 rounded-full bg-dark-card border border-dark-border flex items-center justify-center text-2xl">−</button><div className="text-center"><div className="text-4xl font-bold num-display">{reps}</div><div className="text-text-muted text-sm mt-1">次</div></div><button onClick={() => setReps(reps + 1)} className="w-12 h-12 rounded-full bg-dark-card border border-dark-border flex items-center justify-center text-2xl">+</button></div>
        <div className="text-text-muted text-sm">第 {currentSet} 组 / 共 {currentEx.targetSets} 组</div>
        {records[currentEx.id]?.length > 0 && <div className="flex gap-2 flex-wrap justify-center">{records[currentEx.id].map((r) => <span key={r.setNumber} className="px-3 py-1 rounded-full bg-dark-card border border-dark-border text-xs text-text-muted">组{r.setNumber}: {r.actualWeight}×{r.actualReps}</span>)}</div>}
      </div>
      <button onClick={handleCompleteSet} className="w-full bg-accent rounded-2xl py-4 text-white font-bold text-lg btn-glow">完成本组</button>
    </div>
  );
}
