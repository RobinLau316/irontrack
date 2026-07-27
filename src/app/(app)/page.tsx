"use client";

import Link from "next/link";
import { mockProfile, mockPlan } from "@/lib/data";

export default function HomePage() {
  const today = mockPlan.days[0];
  const weekProgress = "3/4";

  return (
    <div className="space-y-5">
      {/* 顶部问候 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">IronTrack</h1>
          <p className="text-text-muted text-sm mt-0.5">准备开始今天的训练吗？</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
          {mockProfile.weight}kg
        </div>
      </div>

      {/* 今日训练卡片 */}
      <Link href="/training">
        <div className="bg-dark-card rounded-2xl p-5 border border-dark-border hover:border-accent/30 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-accent text-sm font-medium">今日训练</span>
            <span className="text-text-muted text-xs">第 {weekProgress} 天</span>
          </div>
          <h2 className="text-lg font-bold mb-1">{today.dayName}</h2>
          <p className="text-text-muted text-sm mb-4">
            {today.focusArea} · {today.exercises.length} 个动作 · 预计 55 分钟
          </p>
          <div className="flex gap-2 flex-wrap">
            {today.exercises.slice(0, 4).map((ex) => (
              <span
                key={ex.id}
                className="px-2.5 py-1 rounded-full bg-dark-bg text-xs text-text-muted"
              >
                {ex.name}
              </span>
            ))}
            {today.exercises.length > 4 && (
              <span className="px-2.5 py-1 rounded-full bg-dark-bg text-xs text-text-muted">
                +{today.exercises.length - 4}
              </span>
            )}
          </div>
          <div className="mt-4 bg-accent rounded-xl py-3 text-center text-white font-semibold text-sm btn-glow">
            开始训练
          </div>
        </div>
      </Link>

      {/* 状态卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-card rounded-xl p-3 text-center border border-dark-border">
          <div className="text-accent text-xl font-bold num-display">{weekProgress}</div>
          <div className="text-text-muted text-xs mt-1">本周训练</div>
        </div>
        <div className="bg-dark-card rounded-xl p-3 text-center border border-dark-border">
          <div className="text-accent text-xl font-bold num-display">{mockProfile.weight}</div>
          <div className="text-text-muted text-xs mt-1">体重 kg</div>
        </div>
        <div className="bg-dark-card rounded-xl p-3 text-center border border-dark-border">
          <div className="text-accent text-xl font-bold num-display">12</div>
          <div className="text-text-muted text-xs mt-1">连续天数</div>
        </div>
      </div>

      {/* 快速入口 */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/plan"
          className="bg-dark-card rounded-xl p-4 border border-dark-border hover:border-accent/30 transition-colors"
        >
          <div className="text-2xl mb-1">📋</div>
          <div className="font-medium text-sm">训练计划</div>
          <div className="text-text-muted text-xs mt-0.5">推拉腿四分化</div>
        </Link>
        <Link
          href="/data"
          className="bg-dark-card rounded-xl p-4 border border-dark-border hover:border-accent/30 transition-colors"
        >
          <div className="text-2xl mb-1">📊</div>
          <div className="font-medium text-sm">数据追踪</div>
          <div className="text-text-muted text-xs mt-0.5">力量增长趋势</div>
        </Link>
      </div>
    </div>
  );
}