# IronTrack 运行与发布手册

更新日期：2026-08-28

## 1. 本地运行

```bash
npm run dev
```

打开 `http://127.0.0.1:4173/`。修改 `index.html` 后刷新浏览器即可看到变化。

## 2. 静态检查

```bash
npm run build
git diff --check
```

`npm run build` 当前执行静态入口检查，不调用早期 Next.js 原型。

## 3. 浏览器冒烟测试

发布前至少验证：

1. 新建本地用户并进入训练页。
2. 选择身体状态、时间、环境、不适部位和避开动作。
3. 不设置 API Key 时可以生成本地备用计划。
4. 30 分钟生成 8 个动作，90 分钟生成 15 个动作。
5. 被避开的动作不会出现；不适部位对应动作模式会被过滤。
6. 计划预览可以锁定、替换和修改数字。
7. 正式训练中的重量和次数可以直接输入，左右按钮每次调整 1，输入为空时不会出现 `NaN`。
8. 完成一组后进入休息；刷新并重新选择用户后可以恢复，包括刚输入的重量和次数。
9. 完成动作后可以提交“轻松/合适/吃力/不适”反馈。
10. 完成训练后 PPL 推荐推进，已完成训练日的 A/B 方案切换。
11. 数据页出现训练历史和周统计。
12. “我的”页面可以导出备份，文件不包含 API Key。
13. 390px 宽度下页面没有横向溢出。

## 4. 发布

提交并推送 `main`：

```bash
git push origin main
```

GitHub Actions 会将 `index.html` 和 `public/` 发布到 GitHub Pages。部署完成后检查：

```bash
curl -fsSL https://robinlau316.github.io/irontrack/ | grep -q "EXERCISE_LIBRARY"
```

线上地址：[https://robinlau316.github.io/irontrack/](https://robinlau316.github.io/irontrack/)

## 5. 常见问题

### AI 生成失败

系统应自动显示本地备用计划。若没有，检查浏览器控制台和 `createLocalPlan()`。

### 刷新后训练没有恢复

确认使用的是同一个本地用户名，并检查 `today_plan` 与 `active_training` 的计划 ID 是否一致。

### 数据丢失

数据默认只在当前浏览器。优先使用最近导出的备份恢复；API Key需要单独重新填写。

### 页面发布后仍是旧版

先确认 GitHub Pages 工作流成功，再强制刷新浏览器缓存。
