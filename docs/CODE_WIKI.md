# IronTrack Code Wiki

更新日期：2026-10-15

## 产品运行模型

IronTrack 是部署在 GitHub Pages 的静态单页 AI 私人训练教练。训练档案、阶段安排、实际历史和进行中训练保存在浏览器 `localStorage`。用户配置本机 DeepSeek API Key 后，应用直连 DeepSeek；发送训练资料前明确提示并取得本地确认。

运行入口是根目录 `index.html`，页面脚本按顺序加载：

```text
core.js → data.js → helpers.js → plan.js → pages.js → training.js → coach.js → boot.js
```

`coach.js` 在现有存储和训练状态机之上接管当前产品流程。`legacy/` 不参与发布。

## 当前流程

1. `renderOnboarding()` 展示自由对话。`sendCoachIntake()` 汇总用户回答、确认档案和真实训练记录，逐步补问并形成可确认摘要。
2. `confirmCoachUnderstanding()` 在用户确认理解后生成阶段安排。`acceptCoachPhase()` 接受用户的小幅修改并保存 `profile.coachSummary`、`coachIntakeFacts`、`coachPhase`。
3. `renderTrainingSetup()` 采集当天自由描述与器械。`generateTodayPlan()` 请求 DeepSeek 直接生成动作和教学，不读取本地动作库。
4. `validateDynamicAIPlan()` 检查动作数、名称重复、动作步骤、数值、历史重量和时间总量；通过后用户预览并确认。
5. 逐组训练使用旧状态机保留的实际组确认、休息计时和刷新恢复。新训练每个动作结束后不强制评分。
6. 训练保存成功后 `requestCoachReview()` 根据历史和本次记录生成复盘。显著阶段调整保存在 `coachPendingPhase`，由用户在路线页确认。

主要页面入口：今天、路线、我的进展。个人页负责档案、DeepSeek Key、本地备份与恢复。

## 数据与兼容

关键本地数据键：

| 键 | 用途 |
|---|---|
| `profile` | 旧训练档案，以及教练摘要、确认事实、阶段安排、数据使用确认、最近复盘和待确认阶段修改 |
| `onboarding_draft` | 首次对话、理解摘要和阶段计划草稿 |
| `setup_draft` | 当天情况和可用器械草稿 |
| `today_plan` | 计划预览或进行中计划 |
| `active_training` | 当前动作、组次、真实组记录和休息状态 |
| `sessions` / `sessions_archive` | 完整及部分训练、已保存归档 |
| `training_phase` | 阶段开始时间和完整训练次数 |

保留用户旧的 `plan`、周期字段、动作偏好和版本字段以兼容现有数据及 V1/V2/V3 备份；它们不会决定新计划候选。旧计划历史继续保存在设备上；升级前已开始的训练先允许完成，未开始的旧预览清理。

API Key 使用独立全局键 `irontrack_global_apikey`，不进入普通备份。新请求在获得用户数据使用确认后可发送个人训练信息、身体限制、当天情况和近期真实训练；姓名不发送。

## 动作资料状态

旧动作目录、中文步骤 JSON、动作引擎和固定模板不再由 `index.html` 加载，也不在 Service Worker 预缓存清单中。文件仍在仓库留档，但不能作为新计划来源。旧记录中的动作编号仅为历史字段。AI 生成的通俗动作名称和步骤须通过程序结构检查；文字教学不代表现场动作观察，应用不诊断伤病。

## 构建和发布

```bash
npm run build
git diff --check
```

`npm run build` 检查当前 HTML/JS 语法、教练流程能力标记、备份兼容，以及旧动作文件没有接入运行时清单。它不代表真实 DeepSeek 计划质量、完整训练闭环或 iPhone 验收通过。

推送 `main` 会触发 `.github/workflows/deploy-pages.yml`。每次发布必须递增 `sw.js` 的 `CACHE_VERSION`，再核对 Pages 工作流和线上资源。真实 AI、失败恢复、旧进行中训练和 320/375/390 像素手机视口需按 `docs/runbook.md` 分别验收。
