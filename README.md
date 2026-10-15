# IronTrack

IronTrack 是一个手机优先的 AI 私人训练教练。它先通过日常对话了解用户，由教练提出阶段训练路线；每次打开后结合真实训练记录和当天状态安排训练，讲解动作并逐组带练，结束后复盘并调整后续计划。用户可以用自然语言微调。

线上地址：[https://robinlau316.github.io/irontrack/](https://robinlau316.github.io/irontrack/)

## 当前运行入口

- 线上和本地实际入口：`index.html`；样式在 `public/app.css`，脚本在 `public/app/`。
- 教练流程由 `public/app/coach.js` 接管，兼容既有档案、历史和进行中的训练。
- 推送 `main` 后由 `.github/workflows/deploy-pages.yml` 发布到 GitHub Pages。
- `legacy/` 中的 Next.js 原型不参与当前部署。

## 当前功能

- 首次进入时通过对话了解目标、经验、训练条件、身体限制和偏好；用户确认教练理解后，再确认第一阶段训练安排。
- 每次打开后由教练跟进；不发送程序外提醒。
- AI 根据阶段目标、训练档案、近期真实训练和当天状态直接生成完整计划，不使用动作库或固定 PPL 模板。
- 计划用通俗中文解释动作作用，并提供步骤教学；用户可用日常语言微调。
- 确认计划后逐组带练。每组只确认实际重量和次数；训练结束反馈可选。
- 计划值与实际值分开保存，刷新后恢复进行中的训练。
- 教练结合连续的真实训练记录复盘；阶段目标或每周安排明显变化时请用户确认。
- 训练档案、历史和计划保存在当前浏览器；保留旧数据兼容与 V1/V2/V3 备份导入。

使用 AI 前，用户需要配置自己的 DeepSeek API Key，并确认训练档案、身体限制、当天状态和近期真实训练记录会发送给 DeepSeek。姓名不会发送。API Key 不进入普通备份。

## 本地运行与检查

```bash
npm run dev
```

打开 `http://127.0.0.1:4173/`。提交前运行：

```bash
npm run build
git diff --check
```

当前构建检查页面脚本语法、核心教练流程标记、备份兼容和不加载旧动作库。真实 DeepSeek 生成需使用用户自己的 Key 完成实际验收；静态构建不代表真实 AI 或 iPhone 实机验收。手机视口检查见[运行与发布手册](docs/runbook.md)。

## 文档

- [产品需求文档](docs/superpowers/specs/2026-08-28-irontrack-prd.md)
- [系统架构](docs/architecture.md)
- [运行与发布手册](docs/runbook.md)
- `docs/superpowers/reviews/2026-09-02-exercise-catalog-review.md` 是已归档的历史审核记录，不再作为当前训练计划的动作来源。
