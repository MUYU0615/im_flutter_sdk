# 024 快速验证指南（Phase 1）

## 目标

验证联系人自动同步满足以下核心约束：

- 初始化参数可控制是否自动同步，默认关闭
- 登录后先查 metadata version，再决定跳过/增量/全量同步
- 本地缓存不完整时，即使 metadata 判定无需同步，也必须强制全量同步
- 联系人同步走独立 protobuf websocket，支持分页 cursor 与全量/增量结果
- 同步完成后关闭联系人专用链路
- `nickname/avatarUrl` 不双存，本地联系人完整性由 `cacheIntegrity` 控制

## 前置准备

1. 安装依赖：

```bash
npm install
```

2. 准备可用登录态（`appKey`、`userId`、`token`、`restBaseUrl`、联系人同步 websocket 地址）。

3. 准备两类测试账号：

- 账号 A：存在联系人、且服务端可返回多页联系人结果
- 账号 B：联系人为空

4. 准备可控测试数据：

- 联系人新增/删除
- 联系人 remark/sign 变化
- 用户资料缓存被清理或缺失

## 验证步骤

### 步骤 1：基础静态检查

```bash
npm run lint
npm run type-check
```

期望：024 相关文件通过静态检查。

### 步骤 2：静态 protobuf 产物

```bash
npm run proto:gen
npm run proto:check
```

期望：`msync` 与新增的 roster 协议静态产物均已生成且校验通过。

### 步骤 3：默认关闭场景

- 使用默认配置初始化 `ChatClient`
- 执行登录

期望：

- 不发起 metadata version 查询
- 不建立联系人同步 websocket
- 不派发 `onContactSyncStart/onContactSyncFinish`

### 步骤 4：缓存完整且无需同步

- 预置完整联系人关系缓存 + 用户资料缓存
- 预置 `cacheIntegrity = complete`
- metadata version 返回 `requiresSync = false`

期望：

- 登录后可先得到本地联系人结果
- 跳过 websocket 同步链路
- 不产生重复联系人结果更新

### 步骤 5：缓存不完整且 metadata 判定无需同步

- 预置联系人关系缓存
- 清除关联 `userInfo` 中的部分 `nickname/avatarUrl`
- 标记或计算出 `cacheIntegrity = incomplete`
- metadata version 返回 `requiresSync = false`

期望：

- SDK 不直接使用不完整本地联系人结果作为完整展示结果
- 仍执行一次完整联系人同步
- 同步完成后 `cacheIntegrity` 更新为 `complete`

### 步骤 6：增量同步路径

- 预置有效版本号
- metadata version 返回 `requiresSync = true`
- websocket 返回 `responseType = incremental`

期望：

- SDK 使用本地基线发起增量同步
- 仅更新变化联系人
- 同步结束后保存新的 `version` 与 `lastSyncTs`

### 步骤 7：分页全量同步路径

- 令 websocket 依次返回多页 `responseType = full`
- 每页都带有后续 `cursor`

期望：

- SDK 按 cursor 连续拉取所有页面
- 最终联系人结果完整且无重复、无遗漏
- 同步结束后关闭联系人专用链路

### 步骤 8：失败与取消

- 模拟 metadata 查询失败
- 模拟 protobuf 解码失败
- 模拟 cursor 异常
- 模拟同步中登出/切换用户

期望：

- 失败场景派发带 `error` 的 `onContactSyncFinish`
- 可区分“仍可使用旧结果”与“当前没有可用结果”
- 用户切换后旧同步链路被取消且不再输出结果

## 验收清单（对应 spec）

- 初始化开关行为正确：通过率 100%
- metadata version 判定路径正确：通过率 100%
- 缓存不完整时强制全量：通过率 100%
- 多页全量/增量合并：正确率 100%
- 无变更时不重复通知：命中率 100%
- 同步结束关闭链路：残留率 0

## 待记录实测

- `npm run test:run -- tests/unit/contact-sync tests/integration/contact-sync`
- `npm run test:gate:pr`
- 如接入 demo，再记录 `npm run test:e2e` 的联系人主链路验证结果
