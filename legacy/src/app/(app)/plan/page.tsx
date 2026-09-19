"use client";

import { useState } from "react";
import { mockPlan } from "@/lib/data";
import Link from "next/link";

export default function PlanPage() {
  const [selectedDay, setSelectedDay] = useState(mockPlan.days[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">训练计划</h1>
          <p className="text-text-muted text-sm mt-0.5">{mockPlan.name}</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-accent rounded-xl text-white text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-60"
        >
          {isGenerating ? "AI 生成中..." : "AI 调整"}
        </button>
      </div>

      {/* 日选择器 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {mockPlan.days.map((day, i) => (
          <button
            key={day.id}
            onClick={() => setSelectedDay(day)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedDay.id === day.id
                ? "bg-accent text-white"
                : "bg-dark-card text-text-muted border border-dark-border"
            }`}
          >
            第{i + 1}天 · {day.dayName}
          </button>
        ))}
      </div>

      {/* 当天详情 */}
      <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border">
          <h2 className="font-bold">{selectedDay.dayName}</h2>
          <p className="text-text-muted text-sm">{selectedDay.focusArea}</p>
        </div>
        <div className="divide-y divide-dark-border">
          {selectedDay.exercises.map((ex, i) => (
            <div key={ex.id} className="px-4 py-3 flex items-center gap-3">
              <span className="text-accent font-bold text-sm w-5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{ex.name}</div>
                <div className="text-text-muted text-xs">
                  {ex.targetSets}组 × {ex.targetReps}次 · 基础 {ex.baseWeight}kg · 休息{ex.restSeconds}s
                </div>
              </div>
              {ex.previousWeight !== undefined && (
                <div className="text-text-muted text-xs text-right flex-shrink-0">
                  <div>上次</div>
                  <div className="text-accent">{ex.previousWeight}kg × {ex.previousReps}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 开始训练按钮 */}
      <Link
        href="/training"
        className="block bg-accent rounded-2xl py-4 text-center text-white font-bold text-lg hover:bg-accent-dark transition-colors btn-glow"
      >
        开始今日训练
      </Link>
    </div>
  );
}
