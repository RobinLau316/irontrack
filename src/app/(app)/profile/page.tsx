"use client";

import { useEffect, useState } from "react";
import { mockProfile, knowledgeArticles } from "@/lib/data";

export default function ProfilePage() {
  const [profile, setProfile] = useState(() => {
    if (typeof window === "undefined") return mockProfile;
    const saved = window.localStorage.getItem("irontrack-profile");
    return saved ? JSON.parse(saved) : mockProfile;
  });
  const [activeTab, setActiveTab] = useState<"profile" | "knowledge">("profile");

  useEffect(() => {
    window.localStorage.setItem("irontrack-profile", JSON.stringify(profile));
  }, [profile]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">我的</h1>

      {/* Tab 切换 */}
      <div className="flex bg-dark-card rounded-xl p-1 border border-dark-border">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "profile" ? "bg-accent text-white" : "text-text-muted"
          }`}
        >
          个人档案
        </button>
        <button
          onClick={() => setActiveTab("knowledge")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "knowledge" ? "bg-accent text-white" : "text-text-muted"
          }`}
        >
          知识库
        </button>
      </div>

      {activeTab === "profile" ? (
        <ProfileSection profile={profile} setProfile={setProfile} />
      ) : (
        <KnowledgeSection />
      )}
    </div>
  );
}

function ProfileSection({
  profile,
  setProfile,
}: {
  profile: typeof mockProfile;
  setProfile: (p: typeof mockProfile) => void;
}) {
  return (
    <div className="space-y-4">
      {/* 身体数据 */}
      <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border">
          <h3 className="font-bold text-sm">身体数据</h3>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-text-muted text-xs">身高 (cm)</label>
            <div className="mt-1 bg-dark-bg rounded-xl px-3 py-2 text-sm">{profile.height}</div>
          </div>
          <div>
            <label className="text-text-muted text-xs">体重 (kg)</label>
            <div className="mt-1 bg-dark-bg rounded-xl px-3 py-2 text-sm">{profile.weight}</div>
          </div>
          <div>
            <label className="text-text-muted text-xs">体脂率 (%)</label>
            <div className="mt-1 bg-dark-bg rounded-xl px-3 py-2 text-sm">{profile.bodyFat}</div>
          </div>
          <div>
            <label className="text-text-muted text-xs">每周训练</label>
            <div className="mt-1 bg-dark-bg rounded-xl px-3 py-2 text-sm">{profile.trainingDays} 天</div>
          </div>
        </div>
      </div>

      {/* 训练偏好 */}
      <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border">
          <h3 className="font-bold text-sm">训练偏好</h3>
        </div>
          <div className="p-4 space-y-3">
          <div>
            <label className="text-text-muted text-xs">训练目标</label>
            <div className="mt-1 bg-dark-bg rounded-xl px-3 py-2 text-sm">{profile.goal}</div>
          </div>
          <div>
            <label className="text-text-muted text-xs">经验水平</label>
            <div className="mt-1 bg-dark-bg rounded-xl px-3 py-2 text-sm">{profile.experience}</div>
          </div>
        </div>

      {/* 力量基础 */}
      <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border">
          <h3 className="font-bold text-sm">力量基础</h3>
        </div>
        <div className="p-4">
          <label className="text-text-muted text-xs">用于生成每个动作的起始重量</label>
          <select
            value={profile.strengthLevel}
            onChange={(event) => setProfile({ ...profile, strengthLevel: event.target.value as typeof profile.strengthLevel })}
            className="mt-1 w-full bg-dark-bg rounded-xl px-3 py-2 text-sm border border-dark-border text-text"
          >
            <option>新手</option>
            <option>有一定基础</option>
            <option>进阶</option>
          </select>
          <p className="text-text-muted text-xs mt-2">以“有一定基础”的基础重量为参考，新手约 70%，进阶约 115%。</p>
        </div>
      </div>
      </div>

      {/* 可用器械 */}
      <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border">
          <h3 className="font-bold text-sm">可用器械</h3>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {profile.equipment.map((item) => (
            <span
              key={item}
              className="px-3 py-1.5 rounded-full bg-dark-bg border border-dark-border text-xs text-text-muted"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <button className="w-full bg-accent rounded-2xl py-3 text-white font-bold text-sm hover:bg-accent-dark transition-colors">
        保存修改
      </button>
    </div>
  );
}

function KnowledgeSection() {
  return (
    <div className="space-y-3">
      {knowledgeArticles.map((article) => (
        <div
          key={article.slug}
          className="bg-dark-card rounded-2xl p-4 border border-dark-border hover:border-accent/30 transition-colors cursor-pointer"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{article.icon}</span>
            <div>
              <h3 className="font-medium text-sm">{article.title}</h3>
              <p className="text-text-muted text-xs mt-0.5">{article.desc}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
