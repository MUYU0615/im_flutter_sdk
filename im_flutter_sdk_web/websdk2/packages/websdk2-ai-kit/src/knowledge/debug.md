---
id: debug
name: websdk2-debug
title: websdk2 Debug Guide
description: Use when diagnosing im-sdk-web credential, E2E, CI, or routing failures.
cursorGlobs: **/*.{ts,tsx,js,jsx,env,yml,yaml}
referenceIds:
  - generated/integration-index
  - generated/api-reference-index
  - error-catalog
  - real-env-credentials
---
# websdk2 Debug Guide

Use when diagnosing `im-sdk-web` credential, E2E, CI, or routing failures.

## 常见错误码速查

| 错误码 | 含义 | 排查方向 |
|--------|------|----------|
| 1 | Provision rejected（token/password 不匹配） | 检查 token 是否过期、userId 是否对应 |
| 2 | 已在其他设备登录 | 多端互踢，检查是否有其他客户端在线 |
| 8 | AppKey 无效或未注册 | 确认 appKey 格式和控制台配置 |
| 16 | 用户已被封禁 | 联系管理员解封 |
| 17 | 用户不存在 | 确认 userId 是否已注册 |
| 202 | Provision rejected（SDK 内部码） | 同错误码 1，token 与登录信息不匹配 |
| 206 | 服务端超时 | 网络问题或服务端负载，可重试 |

## EASEMOB_USE_FIXED_URLS 说明

SDK demo 和 E2E 测试默认使用固定服务地址（`a1-hsb.easemob.com`），这是华为云专属集群。

如果你的 token 是从公有云（`a1.easemob.com`）获取的，必须设置：

```bash
# .env 或 CI secrets
EASEMOB_USE_FIXED_URLS=false
```

或在代码中：

```typescript
ChatClient.init({
  appKey: 'your-org#your-app',
  useHttpDns: true, // 使用 DNS 自动解析，连接公有云
});
```

**关键规则**：token 必须和服务地址来自同一环境。公有云 token 不能用于 hsb 集群，反之亦然。

## 排查优先级

### 第一步：确认凭证来源一致

- appKey、userId、token 是否来自同一环境（公有云 vs 专属集群）
- token 是否过期（环信 token 有有效期）
- userId 是否区分大小写正确

### 第二步：确认变量注入

- `.env` 文件位置是否正确（项目根目录 vs demo/ 目录）
- CI secrets 是否已配置且非空
- Vite 项目需要 `VITE_` 前缀或配置 `envPrefix`

### 第三步：区分失败阶段

| 阶段 | 表现 | 排查 |
|------|------|------|
| 初始化 | `initialized: false` | appKey 格式错误 |
| DNS 解析 | 卡在 connecting | useHttpDns 配置、网络限制 |
| Provision | `Provision rejected` | token 不匹配、过期、环境不一致 |
| 连接后 | 业务 API 报错 | 权限、参数、服务端状态 |

### 第四步：检查网络路由

- 是否有代理/VPN 拦截 WebSocket
- DNS 是否能解析 `*.easemob.com`
- 防火墙是否放行 443/WebSocket

## .env 配置参考

```bash
# 项目根目录 .env（E2E 测试读取）
EASEMOB_APPKEY="your-org#your-app"
EASEMOB_USERID="your-user"
EASEMOB_TOKEN="your-token"
EASEMOB_TARGET_ID="target-user"
EASEMOB_USE_FIXED_URLS=false

# demo/.env（Vite dev server 读取）
VITE_EASEMOB_APPKEY="your-org#your-app"
VITE_EASEMOB_USERID="your-user"
VITE_EASEMOB_TOKEN="your-token"
EASEMOB_USE_FIXED_URLS=false
```

## 测试命令速查

| 场景 | 命令 |
|------|------|
| 单元测试 | `npm run test:run` |
| PR 门禁 | `npm run test:gate:pr` |
| 全量门禁（含 E2E） | `npm run test:gate:nightly` |
| 发布前门禁 | `npm run test:gate:release` |
| 仅 E2E | `npm run test:e2e` |
| 真实环境 smoke | `npm run test:smoke:real-env` |

## 重要规则

- 不打印明文 token / password
- 对 "Provision rejected" 优先判断 token 不匹配或环境不一致
- 对 "connecting 重试" 优先判断 DNS/网络/useHttpDns 配置
- 需要测试命令时，优先使用仓库已有脚本（见上表）
- 需要用户补现场时，优先收集 `connectionState`、`currentUserId`、最近日志与变量存在性
- API 错误码、参数与返回值以 `websdk2 API Reference Index` 对应分段为准
