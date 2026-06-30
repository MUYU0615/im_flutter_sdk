---
id: platform-differences
name: websdk2-platform-differences
title: websdk2 Platform Differences
description: Use when comparing websdk2 behavior across browser web, Vite demo, CI, and miniapp environments.
cursorGlobs: **/*.{ts,tsx,js,jsx,env,yml,yaml}
referenceIds:
  - generated/integration-index
  - real-env-credentials
  - upgrade-and-compatibility
---
# websdk2 Platform Differences

Use when comparing `websdk2` behavior across browser web, Vite demo, CI, and miniapp environments.

## 平台差异总览

| 环境 | 关注点 | 常见问题 |
|------|--------|----------|
| 浏览器 Web | localStorage、WebSocket、上传文件对象 | 事件清理遗漏、连接状态判断错误 |
| Vite demo | `VITE_*` 变量注入、dev server | `.env` 变量前缀不对、服务地址混用 |
| CI / Node 测试 | secrets、依赖安装、无真实浏览器交互 | demo 依赖未装、凭证未注入 |
| 小程序 | 临时文件路径、图片压缩、平台适配器 | http tmp 路径、文件信息能力缺失 |

## 环境变量规则

- 根目录 `.env` 多用于测试脚本、E2E、Node 侧执行
- `demo/.env` 多用于 Vite demo 页面
- Vite 读取前端变量时通常需要 `VITE_` 前缀
- CI 应优先用 repository secrets / environment secrets，而不是提交 `.env`

## 文件与附件差异

- Web 侧通常直接拿 `File` / `Blob`
- 小程序侧要关注临时文件路径、图片信息 API、压缩能力是否可用
- Node 测试环境通常不提供完整浏览器文件能力，需要 mock 或平台适配器

## 连接与地址差异

- 固定地址与 `useHttpDns` 解析结果必须和 token 所属环境匹配
- demo 与 E2E 经常因为默认服务地址不同而出现“本地能跑、CI 失败”
- 平台差异问题先判断“能力缺失”还是“参数错误”

## 回答要求

- 明确说出用户当前是在 Web、demo、CI 还是小程序
- 区分“代码回归”和“平台能力差异”
- 涉及环境变量时同时说明读取位置
