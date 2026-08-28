# IronTrack

IronTrack 是一个手机优先的个人 AI 训练助手。它按 PPL 周期推荐当天训练，在本地规则限定下使用 DeepSeek 做状态适配；AI 不可用时仍可生成备用计划。

线上地址：[https://robinlau316.github.io/irontrack/](https://robinlau316.github.io/irontrack/)

## 当前运行入口

- 线上和本地实际入口：`index.html`
- 部署：推送 `main` 后由 `.github/workflows/deploy-pages.yml` 发布到 GitHub Pages
- `src/`、Next.js 和 Tailwind 相关文件是早期原型，当前不参与线上构建

## 已实现能力

- 按实际完成记录推进 PPL 周期
- 8～15 个动作的本地规则计划
- 核心动作锁定、4～6 周训练阶段和辅助动作 A/B 轮换
- 身体状态、时间、环境、不适部位和避开动作适配
- 规则骨架 + AI 适配；AI 失败自动使用本地计划
- 计划预览、单动作替换和组数/次数/重量/休息编辑
- 逐组训练、休息计时、动作反馈和训练总结
- 刷新后恢复进行中训练
- 历史、核心动作趋势、周统计和反馈复盘
- 本地数据导出与导入；备份不包含 API Key

## 本地运行

```bash
npm run dev
```

打开 `http://127.0.0.1:4173/`。

## 检查

```bash
npm run build
```

当前静态检查会验证 `index.html` 中的脚本语法和关键能力标记。完整交互仍需按 [运行与发布手册](docs/runbook.md) 做浏览器冒烟测试。

## 数据与密钥

- 训练数据按本地用户名保存在浏览器 `localStorage`。
- DeepSeek API Key 单独保存在当前浏览器，不写入代码和普通备份。
- 清除浏览器数据会丢失本地记录，建议定期在“我的 → 本地数据备份”导出。

## 文档

- [产品需求文档](docs/superpowers/specs/2026-08-28-irontrack-prd.md)
- [系统架构](docs/architecture.md)
- [运行与发布手册](docs/runbook.md)

