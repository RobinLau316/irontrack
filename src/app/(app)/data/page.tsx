"use client";

import { useState } from "react";
import { mockBodyRecords, mockStrengthData } from "@/lib/data";

export default function DataPage() {
  const [tab, setTab] = useState<"weight" | "strength">("weight");

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">数据追踪</h1>

      {/* Tab 切换 */}
      <div className="flex bg-dark-card rounded-xl p-1 border border-dark-border">
        <button
          onClick={() => setTab("weight")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "weight" ? "bg-accent text-white" : "text-text-muted"
          }`}
        >
          体重趋势
        </button>
        <button
          onClick={() => setTab("strength")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "strength" ? "bg-accent text-white" : "text-text-muted"
          }`}
        >
          力量增长
        </button>
      </div>

      {tab === "weight" ? <WeightChart /> : <StrengthChart />}

      {/* 训练统计 */}
      <div className="bg-dark-card rounded-2xl p-4 border border-dark-border space-y-3">
        <h3 className="font-bold text-sm">本周训练统计</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-dark-bg rounded-xl p-3">
            <div className="text-accent text-lg font-bold">3</div>
            <div className="text-text-muted text-xs">完成训练</div>
          </div>
          <div className="bg-dark-bg rounded-xl p-3">
            <div className="text-accent text-lg font-bold">18</div>
            <div className="text-text-muted text-xs">总组数</div>
          </div>
          <div className="bg-dark-bg rounded-xl p-3">
            <div className="text-accent text-lg font-bold">12,450</div>
            <div className="text-text-muted text-xs">总容量 kg</div>
          </div>
          <div className="bg-dark-bg rounded-xl p-3">
            <div className="text-accent text-lg font-bold">4.2h</div>
            <div className="text-text-muted text-xs">总时长</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeightChart() {
  const maxWeight = Math.max(...mockBodyRecords.map((r) => r.weight));
  const minWeight = Math.min(...mockBodyRecords.map((r) => r.weight));
  const range = maxWeight - minWeight || 1;

  return (
    <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm">体重变化</h3>
        <span className="text-text-muted text-xs">近两周</span>
      </div>
      <div className="h-40 flex items-end gap-2">
        {mockBodyRecords.map((record) => {
          const height = ((record.weight - minWeight) / range) * 100 + 20;
          return (
            <div key={record.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-text-muted">{record.weight}</span>
              <div
                className="w-full bg-accent/30 rounded-t relative overflow-hidden"
                style={{ height: `${height}%` }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 bg-accent rounded-t"
                  style={{ height: "70%" }}
                />
              </div>
              <span className="text-xs text-text-muted">{record.date}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-xs text-text-muted">
        <span>起始 {mockBodyRecords[0].weight}kg</span>
        <span className="text-accent">
          ↓ {(mockBodyRecords[0].weight - mockBodyRecords[mockBodyRecords.length - 1].weight).toFixed(1)}kg
        </span>
        <span>当前 {mockBodyRecords[mockBodyRecords.length - 1].weight}kg</span>
      </div>
    </div>
  );
}

function StrengthChart() {
  const benchData = mockStrengthData.filter((d) => d.exercise === "卧推");
  const squatData = mockStrengthData.filter((d) => d.exercise === "深蹲");

  return (
    <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm">力量增长曲线</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" /> 卧推
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f4a261]" /> 深蹲
          </span>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>卧推</span>
            <span className="text-accent">
              {benchData[0].weight} → {benchData[benchData.length - 1].weight}kg
            </span>
          </div>
          <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: "75%" }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>深蹲</span>
            <span className="text-[#f4a261]">
              {squatData[0].weight} → {squatData[squatData.length - 1].weight}kg
            </span>
          </div>
          <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-[#f4a261] rounded-full transition-all"
              style={{ width: "60%" }}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 text-center text-xs text-text-muted">
        ↑ 卧推 +10kg · 深蹲 +10kg（6周）
      </div>
    </div>
  );
}