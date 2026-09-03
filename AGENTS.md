# IronTrack 项目协作说明

## 当前运行入口

- GitHub Pages 与本地静态运行均使用根目录 `index.html`。
- `src/` 中的 Next.js 文件是早期原型，不参与当前发布。
- 推送 `main` 会触发 `.github/workflows/deploy-pages.yml` 发布。

## 修改边界

- 保留并兼容浏览器 `localStorage` 中的档案、计划、历史和进行中训练。
- API Key只保存在当前浏览器，不写入代码或普通备份。
- 不修改、提交或删除与任务无关的未跟踪文件。
- 正式运行不得请求 GitHub 动作数据，也不得使用上游图片、GIF 或 Gym visual 媒体。

## 动作库状态

- 阶段一已于 2026-09-02 通过用户分类验收，共 207 个精选动作。
- 目录位于 `public/data/exercise-catalog.v1.json`，中文步骤位于 `public/data/exercise-instructions-zh.v1.json`。
- `index.html` 已完成阶段二接入，并于 2026-09-03 发布及完成线上验收。
- 详细规则以 PRD 第 15 章、动作库设计规格和实施计划为准。

## 检查与发布

- 修改后运行 `npm run build` 和 `git diff --check`。
- 涉及页面行为时，按 `docs/runbook.md` 完成手机尺寸和训练闭环测试。
- 只有完成相应验收后才推送发布；静态文件存在不代表功能已经接入。
