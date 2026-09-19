# IronTrack（fitness-tool）代码百科 Code Wiki

> 面向开发者维护本仓库的参考文档，覆盖整体架构、模块职责、关键类/函数、依赖关系与运行方式。
> 更新时间：2026-09-08 ｜ 对应版本：V1.2（规则主导训练计划，提交 `f0731ab` 起）

---

## 1. 项目概览

IronTrack 是一款**手机优先的个人 AI 训练助手**，按 **PPL（推 Pull / 拉 Push / 腿 Legs）三分化周期**推荐当天训练。核心能力是：本地规则引擎先生成训练骨架，可选地让 DeepSeek 在本地边界内做同肌群变式与数值适配；AI 不可用时会话**自动降级为本地备用计划**，保证离线可用。

- 线上地址：https://robinlau316.github.io/irontrack/
- 运行形态：**单页静态应用（SPA）**，无自有后端
- 数据存储：`localStorage`（按用户名命名空间）
- AI：浏览器直连 DeepSeek API（`https://api.deepseek.com/v1/chat/completions`）

### 1.1 当前运行入口（重要）

| 入口 | 说明 |
|---|---|
| `index.html`（根目录，约 179KB / 3306 行） | **唯一实际运行入口**，完整应用（UI + 逻辑） |
| `src/`、Next.js、Tailwind 等 | 早期原型，**不参与当前发布与构建** |
| `public/exercise-engine.js` | 独立前端规则引擎，被 `index.html` 引用 |

### 1.2 发布状态

- 阶段一：207 个精选动作库分类验收通过（2026-09-02）
- 阶段二：动作库 + 引擎接入上线并验收（2026-09-03）
- V1.2：规则主导计划重构（推拉腿结构槽位 `PPL_SLOTS` + 白名单版本），计划生成不再依赖 AI

---

## 2. 整体架构

```
┌──────────────────────────────────────────────┐
│              index.html (SPA)                 │
│                                              │
│  ┌─────────── UI / 视图层 ─────────────┐      │
│  │ 登录/首页/训练设置/计划预览/训练页/   │      │
│  │ 数据页/我的(档案/备份/设置)          │      │
│  └─────────────────────────────────────┘      │
│                                              │
│  ┌────── 训练状态机 ──────────┐              │
│  │ 热身→正式→反馈→拉伸→完成     │◄─ 刷新恢复    │
│  └─────────────────────────────┘              │
│                                              │
│  ┌────── 计划生成层 ───────────┐              │
│  │ 本地规则骨架 → (可选)AI 适配  │              │
│  └─────────────────────────────┘              │
│  ┌────── 数据层 ──────────────┐               │
│  │ LS(localStorage)│迁移/兼容│备份│            │
│  └─────────────────────────────┘              │
└──────────────────────────────────────────────┘
        │ <script src="./public/exercise-engine.js">
        ▼
┌───────────────────────────────────────────────┐
│  public/exercise-engine.js                    │
│  UMD 纯函数引擎（候选过滤/评分/轮换/校验/备用计划）│
└───────────────────────────────────────────────┘
        │ 按需 fetch
        ▼
┌───────────────────────────────────────────────┐
│  public/data/exercise-catalog.v1.json  (207动作)│
│  public/data/exercise-instructions-zh.v1.json │
└───────────────────────────────────────────────┘
        │ fetch (可选，浏览器直连)
        ▼
┌───────────────────────────────────────────────┐
│  DeepSeek API（AI 解释/评测，非计划生成前提）    │
└───────────────────────────────────────────────┘
```

### 2.1 分层职责

| 层 | 位置 | 职责 |
|---|---|---|
| 视图层 | `index.html` 各 `render*()` | 登录、首页、设置、预览、训练、数据、个人页的 DOM 渲染 |
| 状态机层 | `index.html` | 训练全流程状态推进、计时器、断点持久化与恢复 |
| 计划生成层 | `index.html` | 由本地规则/精选目录生成骨架，可选调用 AI 做适配 |
| 规则引擎层 | `public/exercise-engine.js` | 纯函数候选过滤、评分、轮换槽位、结构校验、备用计划 |
| 数据层 | `index.html` `LS`/迁移 | localStorage 读写、旧数据兼容迁移、备份导入导出 |
| 数据文件 | `public/data/*.json` | 精选动作库与中文步骤（静态发布） |

---

## 3. 项目目录结构

```
fitness-tool/
├── index.html                  # ★ 应用唯一入口（SPA，含全部 UI 与逻辑）
├── package.json                # npm scripts：dev/start/build/check
├── README.md / AGENTS.md       # 协作说明与项目概述
├── .github/workflows/
│   └── deploy-pages.yml        # push main → GitHub Pages 部署
├── docs/
│   ├── architecture.md         # 系统架构说明
│   ├── runbook.md              # 运行与发布手册
│   └── superpowers/            # 规格/计划/评审（PRD、设计规格等）
├── public/                     # 静态资源（随 index.html 一起发布）
│   ├── exercise-engine.js      # ★ 规则引擎（UMD）
│   ├── data/
│   │   ├── exercise-catalog.v1.json      # 207 精选动作
│   │   └── exercise-instructions-zh.v1.json # 中文步骤
│   ├── manifest.json           # PWA manifest
│   └── icon-*.png / irontrack-hero.* etc.
├── scripts/                    # 检查与构建脚本（node）
│   ├── check-static.mjs        # 检查 index.html 脚本语法与功能标记
│   ├── check-exercise-catalog.mjs # 动作库/中文步骤/体积校验
│   ├── check-exercise-engine.mjs  # 引擎接口与 fixture 校验
│   ├── smoke-v12.mjs           # V1.2 规则/轮换/迁移冒烟测试
│   ├── build-exercise-catalog.mjs   # 由 curation 生成 catalog
│   ├── import-exercise-source.mjs   # 导入并校验源数据
│   └── fixtures/exercise-engine-scenarios.json
├── tools/exercise-catalog/     # 动作库策展源数据（overrides/maps/lock）
└── src/                        # ⚠ 早期 Next.js 原型，不参与发布
```

---

## 4. 核心模块与关键函数

### 4.1 数据与存储层（`index.html`）

**`LS` 对象（第 563 行起）** — localStorage 命名空间封装。
键格式：`irontrack_{currentUser}_{key}`；`get(key, fallback)` / `set(key, val)`，带 JSON 序列化与异常兜底。

**用户与密钥**
- `getGlobalApiKey()` / `setGlobalApiKey(key)` — 存于全局键 `irontrack_global_apikey`，**不进入普通备份**。
- `getAllUsers()` / `saveAllUsers(users)` / `addUser(name)` — 本机多用户列表。

**存储键清单（按用户命名空间）**

| 键 | 用途 |
|---|---|
| `profile` | 个人档案与器械 |
| `plan` | 当前训练模板（PPL 模板等） |
| `sessions` | 已完成训练历史（上限 200 条） |
| `body_records` / `measurements` | 体重/体脂、围度记录 |
| `today_index` | 下一训练日索引 |
| `today_plan` | 今日动态计划（含 preview/active 状态） |
| `active_training` | 进行中训练快照（断点恢复） |
| `cycle_variants` | 推/拉/腿的 A/B 轮换态 |
| `core_locks` | 核心动作锁定 |
| `training_phase` | 4~6 周阶段起点与完成次数 |
| `setup_draft` | 生成前设置草稿 |
| `exercise_preferences` | 暂停推荐动作、轻松“继续/换变式”偏好 |
| `exercise_catalog_version` | 已完成兼容处理的动作库版本 |

**数据兼容/迁移（重点）**
- `ensureUserDataCompatibility()` — 登录后补齐新字段默认值，非空但结构无效的数据先保存恢复快照再修复。
- `migrateExerciseReferences()` / `import` 引擎的 `migrateLegacyData()` — 旧动作名/编号映射到新 `exerciseId`。
- `ensureExerciseCatalog()` / `ensureExerciseInstructions()` — 按需加载动作库（进入训练设置时）与中文步骤（首次展开时）。

### 4.2 计划生成层（`index.html`）

**选择流**
1. `enterTraining()` / `renderTrainingSetup()` — 设置身体状态、时间、环境、不适部位、避开动作。
2. `suggestTodayFocus()` — 基于 PPL 周期与最近训练推荐当日部位。
3. `confirmSetup()` → `generateTodayPlan()`：
   - **V1.2 关键**：`generateTodayPlan()` 直接调用 `createLocalPlan()`，**计划生成不再依赖 AI/网络**；失败时先 `ensureUserDataCompatibility()` 再重试。
   - `createLocalPlan()` — 按是否有动作库分派到 `createCatalogPlan()` 或 `createLegacyLocalPlan()`。

**候选与骨架**
- `targetExerciseCount(time)` — 30/45/60/90 分钟对应 8/9/12/15 个动作。
- `getCatalogCandidates(key)` — 从 `exercise-engine` 的 `filterCandidates` 过滤得到合格候选。
- `EXERCISE_LIBRARY` / `BODYWEIGHT_LIBRARY` — 未接入精选目录时的**遗留兜底动作库**（`X()` 构造器）。
- `PPL_SLOTS` — V1.2 结构槽位：推(4) / 拉(5) / 腿(6) 个结构分组，每组带动作模式与数量（`机动` 槽位弹性填充）。
- `createCatalogPlan()` — 核心动作从 `lib.core` 锁定；辅助动作交给引擎 `buildFallbackPlan()` 生成约 35% 轮换；平衡校验失败时全量重建。

**AI 调用（V1.2 起仅用于解释与评价，不参与计划生成）**
- `aiCall(prompt, silent)` — DeepSeek 请求封装（25s 超时、AbortController、错误兜底）。
- `aiExplainPlan()` / `aiReviewCurrentTraining()` — 按需调用 AI 解释计划/评审当前训练。
- 2026-09-18 起 `buildTodayPrompt()` / `normalizeAIPlan()` / `normalizeCatalogAIPlan()` 已随 V1.2 纯本地化移除。

### 4.3 计划预览（`index.html`）
- `renderPlanPreview()` / `togglePlanLock(index)` — 锁定动作（核心动作同步写 `core_locks`）。
- `swapPlanExercise(index, preferNew)` — 同肌群替换，替换后需通过结构平衡校验。
- `updatePreviewField(index, key, value)` — 手动改组数/次数/重量/休息，带范围校验。
- `startConfirmedPlan()` — `today_plan.status = 'active'`，进入训练状态机，此后不再调 AI。

### 4.4 训练状态机（`index.html`）

```
生成前设置 → 计划预览 → 热身 → 正式训练 → 动作反馈 → 拉伸 → 完成
                          ↕
                       休息计时（startRestTimer / resumeRestTimer / skipRest）
```

- `initDynamicTraining()` / `restoreDynamicTraining()` — 初始化 / 通过计划 ID 断点恢复。
- `persistTrainingState()` — 每次组完成、换动作、切板块、提交反馈后持久化；`beforeunload` 时自动保存。
- `renderWarmup()` / `renderWorkout()` / `renderStretch()` / `renderNutrition()` — 四大板块渲染（记忆约束要求的四段结构）。
- `completeSet()` — 记录本组 `{w, r}`；未到目标组数进休息，完成则进入动作反馈。
- `submitExerciseFeedback(value)` / `advanceAfterExercise()` — 反馈（轻松/合适/吃力/不适），决定下一动作或换变式。
- `saveSession()` — 生成 session 写入历史，推进 `today_index`、切换 A/B、累计阶段次数，并清空当日计划。
- 滑动切换：`touchstart`/`touchend` 横向滑动切换上一/下一动作。

### 4.5 数据页 / 个人页（`index.html`）
- `renderDataChart(tab)` — 体重 / 围度柱状图。
- `renderSessionHistory()` / `updateWeekStats()` — 历史与周统计。
- `renderProfilePage()` + `toggleEquipment` / `saveProfile` / `testApiKey` — 档案、器械、Key 测试。

### 4.6 备份（`index.html`）
- `buildBackupPayload()` — 快照（应用标识、格式版本 v2、用户、导出时间、用户数据），**排除 API Key**。
- `exportBackup()` / `importBackupFile(file)` — 导出下载 / 导入校验，导入前保存快照。

---

## 5. 规则引擎 `public/exercise-engine.js`

**形态**：UMD 纯函数模块，无外部依赖；挂载为 `window.IronTrackExerciseEngine`，命令行/Node 下经 `module.exports` 导出。

**暴露的 API**

| 函数 | 职责 |
|---|---|
| `BALANCE_RULES` | 推/拉/腿的**结构平衡规则**（水平推、肩部刺激、肘伸；水平拉/垂直拉/肘屈后束；膝/髋主导、单腿、提踵、核心等） |
| `normalizeExercise(value)` | 将目录/遗留动作统一为运行时标准结构 |
| `resolveLegacyExercise(ref, catalog)` | 按编号或 `legacyNameMap` 把旧动作解析到新动作 |
| `migrateLegacyData(data, catalog)` | 非破坏式迁移 `plan/sessions/active_training` 中的旧引用，返回改动计数 |
| `filterCandidates(catalog, context)` | 按质量(A)、暂停、避开词、不适部位、环境器械过滤候选 |
| `selectRotationSlots(count, seed)` | 用 `stableHash` 稳定挑选约 **35%** 的轮换槽位 |
| `scoreCandidates(candidates, context)` | 评分排序：避免最近用过的、优先替换肌群一致、避免重复、稳定哈希去随机 |
| `validatePlanBalance(workout, focusKey)` | 对整套计划跑 `BALANCE_RULES` 平衡校验 |
| `validateCandidateSequence(items, skeleton, allowed, focusKey)` | 校验 AI 输出：数量一致、编号唯一、锁定不动、同肌群替换、结构平衡 |
| `buildFallbackPlan(options)` | 核心动作 + 辅助动作按平衡规则补齐；有上次记录时延续 60~70% 连续性并做 35% 轮换 |

> `index.html` 通过 `getExerciseEngine()` 获取该引擎；仅当 `exerciseCatalog` 就绪时才使用引擎路径，否则走 `EXERCISE_LIBRARY` 遗留逻辑。

---

## 6. 数据文件与关键常量

### 6.1 `public/data/exercise-catalog.v1.json`
- `version`: `irontrack-exercises-v1`
- `exercises`: **207** 个精选动作，字段：`exerciseId`、`nameZh/nameEn/aliasesZh`、`pplTags`、`primaryMuscles`、`replacementMuscle`、`movementPatterns`、`equipment`、`loadRegions`、`variantGroup`、`substitutionGroup`、`balanceTags`、`recommendationStatus`、`qualityTier`、`trainingDefaults`、`catalogVersion`。
- `legacyNameMap`: **91** 条旧动作名映射。

### 6.2 `public/data/exercise-instructions-zh.v1.json`
- 结构：`{ version, instructions[] }`，对应 207 份中文步骤，仅首次展开时加载。

### 6.3 关键常量（`index.html` 顶部）
| 常量 | 值/说明 |
|---|---|
| `PLAN_TEMPLATES` | PPL 三分化 / PPL 肩四分化 / 上下肢分化 三套模板 |
| `PPL_SLOTS` | 推(4)/拉(5)/腿(6) 结构槽位（V1.2） |
| `PPL_WHITELIST_VERSION` | `v1.2-whitelist-1`（白名单版本标记） |
| `BACKUP_VERSION` | `2` |
| `EXERCISE_CATALOG_URL` / `EXERCISE_INSTRUCTIONS_URL` | 动作库/中文步骤相对路径 |
| `EQUIPMENT_OPTIONS` / `FOCUS_OPTIONS` / `STATE_OPTIONS` / `TIME_OPTIONS` / `ENV_OPTIONS` / `DISCOMFORT_OPTIONS` | UI 选项常量 |

---

## 7. 依赖关系

### 7.1 运行时依赖
- **零第三方前端运行时库**——应用本体为原生 JS。
- 依赖浏览器能力：`localStorage`、`fetch`、`AbortController`、`EventSource`（未用）等。
- 外部服务：**DeepSeek API**（可选，仅用于 AI 解释/评测）。

### 7.2 文件间依赖
- `index.html` ←（`<script src>`）→ `public/exercise-engine.js`
- `index.html` ←（按需 fetch）→ `public/data/exercise-catalog.v1.json`、`exercise-instructions-zh.v1.json`
- `index.html` → `manifest.json`、各类 icon、hero 图片
- `exercise-engine.js`：**无依赖**（纯函数 UMD）
- `scripts/*.mjs` → 校验 `index.html`、`public/`、`tools/exercise-catalog/*`（含 `source-lock.json` 的 SHA256 校验）

### 7.3 构建/工具链（`package.json`）
| 依赖 | 作用 | 发布相关 |
|---|---|---|
| `next` / `react` / `react-dom` | 早期原型 | **否**（原型保留） |
| `typescript` / `tailwindcss` / `postcss` / `eslint` 等 | 原型配套 | **否** |
| `node`（内置 `node:fs`）+ `python3` | 检查脚本 / 静态服务 | 是 |

### 7.4 npm scripts
```bash
npm run dev   # python3 -m http.server 4173   本地静态运行
npm run start # 同上
npm run check # node check-static → check-exercise-catalog → check-exercise-engine → smoke-v12
npm run build # 等价于 npm run check（不构建 Next 原型）
```

---

## 8. 运行方式

### 8.1 本地运行
```bash
npm install          # 首次（主要为脚本依赖）
npm run dev          # 启动静态服务
# 打开 http://127.0.0.1:4173/
```
> 单页应用无构建步骤，改 `index.html` 刷新即生效。

### 8.2 静态检查
```bash
npm run build        # = npm run check（脚本语法、动作库、引擎、冒烟）
git diff --check     # 空白错误检查
```

### 8.3 发布部署
```bash
git push origin main
```
`.github/workflows/deploy-pages.yml` 会把 `index.html` + `public/` 写入 `out/` 并发布到 GitHub Pages。部署后验证：
```bash
curl -fsSL https://robinlau316.github.io/irontrack/ | grep -q "EXERCISE_LIBRARY"
```

### 8.4 发布前人工冒烟要点
按 `docs/runbook.md` 覆盖：新建用户生成计划、不设 Key 出本地备用计划、30min/90min 动作数(8/15)、计划锁定替换改数、刷新恢复训练、反馈四态、PPL 推进与 A/B 切换、备份导出不含 Key、旧版备份(含 v1)导入兼容。

---

## 9. 设计边界与约定（维护须知）

- **单机、单用户**为主，无云同步、无自有数据库、无服务端密钥保护。
- 浏览器直连 AI，密钥仅本机保存，**不视为服务端安全存储**。
- AI 生成失败必须自动回退本地计划；正式运行**不得请求 GitHub 动作数据**。
- 精选动作库可本地发布，但**不得复制或运行时加载上游图片/GIF/Gym visual 媒体**。
- 动作库升级必须遵守：固定版本 → 人工复核 → 兼容快照 → 线上验收。
- 修改前保留并兼容既有 `localStorage` 档案/计划/历史/进行中训练；升级数据结构前先导出备份。
- 推送 `main` 即自动发布，发布前必须完成对应验收。

---

## 10. 补充文档索引
- [系统架构](architecture.md)
- [运行与发布手册](runbook.md)
- [产品需求文档](superpowers/specs/2026-08-28-irontrack-prd.md)
- [动作库设计规格](superpowers/specs/2026-09-02-irontrack-exercise-catalog-variation-design.md)
- [动作库分类审核报告](superpowers/reviews/2026-09-02-exercise-catalog-review.md)