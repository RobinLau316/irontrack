import type { TrainingPlan, UserProfile, BodyRecord, StrengthData, TrainingBlock } from "./types";

export const mockProfile: UserProfile = {
  height: 178,
  weight: 78.5,
  bodyFat: 18,
  trainingDays: 4,
  experience: "有一定基础",
  goal: "增肌塑形",
  equipment: ["杠铃", "哑铃", "卧推架", "深蹲架", "绳索机", "蝴蝶机", "腿举机"],
  strengthLevel: "有一定基础",
};

export const mockPlan: TrainingPlan = {
  id: "plan-1",
  name: "推拉腿四分化",
  cycleType: "4天循环",
  days: [
    {
      id: "day-1",
      dayName: "推胸日",
      focusArea: "胸+三头",
      exercises: [
        { id: "e1", name: "杠铃卧推", targetSets: 5, targetReps: 5, targetWeight: 80, baseWeight: 80, restSeconds: 120, sortOrder: 1, previousWeight: 77.5, previousReps: 5 },
        { id: "e2", name: "上斜哑铃卧推", targetSets: 4, targetReps: 8, targetWeight: 30, baseWeight: 30, restSeconds: 90, sortOrder: 2, previousWeight: 28, previousReps: 8 },
        { id: "e3", name: "绳索飞鸟", targetSets: 4, targetReps: 12, targetWeight: 15, baseWeight: 15, restSeconds: 60, sortOrder: 3, previousWeight: 15, previousReps: 10 },
        { id: "e4", name: "双杠臂屈伸", targetSets: 3, targetReps: 10, targetWeight: 0, baseWeight: 0, restSeconds: 90, sortOrder: 4, previousWeight: 0, previousReps: 8 },
        { id: "e5", name: "绳索下压", targetSets: 4, targetReps: 12, targetWeight: 20, baseWeight: 20, restSeconds: 60, sortOrder: 5, previousWeight: 20, previousReps: 10 },
        { id: "e6", name: "俯身哑铃臂屈伸", targetSets: 3, targetReps: 12, targetWeight: 10, baseWeight: 10, restSeconds: 60, sortOrder: 6, previousWeight: 10, previousReps: 10 },
      ],
    },
    {
      id: "day-2",
      dayName: "拉背日",
      focusArea: "背+二头",
      exercises: [
        { id: "e7", name: "引体向上", targetSets: 4, targetReps: 8, targetWeight: 0, baseWeight: 0, restSeconds: 120, sortOrder: 1 },
        { id: "e8", name: "杠铃划船", targetSets: 4, targetReps: 8, targetWeight: 70, baseWeight: 70, restSeconds: 90, sortOrder: 2 },
        { id: "e9", name: "高位下拉", targetSets: 4, targetReps: 10, targetWeight: 55, baseWeight: 55, restSeconds: 90, sortOrder: 3 },
        { id: "e10", name: "坐姿划船", targetSets: 3, targetReps: 12, targetWeight: 45, baseWeight: 45, restSeconds: 60, sortOrder: 4 },
        { id: "e11", name: "杠铃弯举", targetSets: 4, targetReps: 10, targetWeight: 30, baseWeight: 30, restSeconds: 60, sortOrder: 5 },
        { id: "e12", name: "锤式弯举", targetSets: 3, targetReps: 12, targetWeight: 14, baseWeight: 14, restSeconds: 60, sortOrder: 6 },
      ],
    },
    {
      id: "day-3",
      dayName: "腿部日",
      focusArea: "股四+腘绳+小腿",
      exercises: [
        { id: "e13", name: "杠铃深蹲", targetSets: 5, targetReps: 5, targetWeight: 100, baseWeight: 100, restSeconds: 150, sortOrder: 1 },
        { id: "e14", name: "罗马尼亚硬拉", targetSets: 4, targetReps: 8, targetWeight: 90, baseWeight: 90, restSeconds: 120, sortOrder: 2 },
        { id: "e15", name: "腿举", targetSets: 4, targetReps: 10, targetWeight: 160, baseWeight: 160, restSeconds: 90, sortOrder: 3 },
        { id: "e16", name: "腿弯举", targetSets: 3, targetReps: 12, targetWeight: 40, baseWeight: 40, restSeconds: 60, sortOrder: 4 },
        { id: "e17", name: "站姿提踵", targetSets: 4, targetReps: 15, targetWeight: 80, baseWeight: 80, restSeconds: 60, sortOrder: 5 },
      ],
    },
    {
      id: "day-4",
      dayName: "肩部日",
      focusArea: "肩+腹",
      exercises: [
        { id: "e18", name: "杠铃推举", targetSets: 5, targetReps: 5, targetWeight: 50, baseWeight: 50, restSeconds: 120, sortOrder: 1 },
        { id: "e19", name: "哑铃侧平举", targetSets: 4, targetReps: 12, targetWeight: 12, baseWeight: 12, restSeconds: 60, sortOrder: 2 },
        { id: "e20", name: "俯身飞鸟", targetSets: 4, targetReps: 12, targetWeight: 10, baseWeight: 10, restSeconds: 60, sortOrder: 3 },
        { id: "e21", name: "绳索面拉", targetSets: 3, targetReps: 15, targetWeight: 15, baseWeight: 15, restSeconds: 60, sortOrder: 4 },
        { id: "e22", name: "悬垂举腿", targetSets: 3, targetReps: 15, targetWeight: 0, baseWeight: 0, restSeconds: 60, sortOrder: 5 },
      ],
    },
  ],
};

export const mockBodyRecords: BodyRecord[] = [
  { date: "7/7", weight: 79.2 },
  { date: "7/9", weight: 79.0 },
  { date: "7/11", weight: 78.8 },
  { date: "7/13", weight: 78.6 },
  { date: "7/15", weight: 78.5 },
  { date: "7/17", weight: 78.3 },
  { date: "7/19", weight: 78.5 },
];

export const warmupRoutine: TrainingBlock = {
  name: "专业热身",
  duration: 8,
  description: "提高体温、活动关节，并为第一个复合动作逐步加重。",
  items: ["快走或单车 3 分钟", "肩/髋/踝关节动态活动 2 分钟", "第一个动作空杆 1 组 + 逐级热身 2 组"],
};

export const cooldownRoutine: TrainingBlock = {
  name: "训练后拉伸",
  duration: 6,
  description: "降低训练后的紧张感，保持自然呼吸，不追求疼痛幅度。",
  items: ["胸/背/腿主要肌群静态拉伸各 30 秒", "髋屈肌与肩前侧拉伸各 30 秒", "深呼吸放松 1 分钟"],
};

export const trainingDurations = [30, 45, 60, 75] as const;

export const mockStrengthData: StrengthData[] = [
  { date: "第1周", exercise: "卧推", weight: 70 },
  { date: "第2周", exercise: "卧推", weight: 72.5 },
  { date: "第3周", exercise: "卧推", weight: 75 },
  { date: "第4周", exercise: "卧推", weight: 77.5 },
  { date: "第5周", exercise: "卧推", weight: 78 },
  { date: "第6周", exercise: "卧推", weight: 80 },
  { date: "第1周", exercise: "深蹲", weight: 90 },
  { date: "第2周", exercise: "深蹲", weight: 92.5 },
  { date: "第3周", exercise: "深蹲", weight: 95 },
  { date: "第4周", exercise: "深蹲", weight: 97.5 },
  { date: "第5周", exercise: "深蹲", weight: 98 },
  { date: "第6周", exercise: "深蹲", weight: 100 },
];

export const knowledgeArticles = [
  {
    title: "渐进超负荷原理",
    desc: "增肌的核心原则：逐步增加训练压力",
    icon: "📈",
    slug: "progressive-overload",
  },
  {
    title: "训练容量怎么算",
    desc: "组数×次数×重量，一次看懂你的训练量",
    icon: "🧮",
    slug: "training-volume",
  },
  {
    title: "蛋白摄入指南",
    desc: "每天吃多少蛋白质才够增肌？",
    icon: "🥩",
    slug: "protein-guide",
  },
  {
    title: "组间休息多久",
    desc: "不同目标的最佳休息时间",
    icon: "⏱",
    slug: "rest-periods",
  },
  {
    title: "复合动作 vs 孤立动作",
    desc: "如何平衡训练计划中的动作选择",
    icon: "🏋️",
    slug: "compound-isolation",
  },
  {
    title: "平台期突破策略",
    desc: "当力量不再增长时该怎么办",
    icon: "🔓",
    slug: "plateau-breaking",
  },
];
