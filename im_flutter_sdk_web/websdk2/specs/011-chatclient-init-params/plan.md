# 实施方案：ChatClient 初始化参数扩展

**Branch**: `011-chatclient-init-params` | **Date**: 2026-01-30 | **Spec**: `specs/011-chatclient-init-params/spec.md`  
**Input**: 规范文档 `/specs/011-chatclient-init-params/spec.md`

## 概述

在 `ChatClient.init` 初始化配置中新增连接与设备相关参数，覆盖 DNS_CONFIG 地址发现、固定服务地址直连、设备标识、内容替换策略、自动登录与版本上报能力，并与旧工程行为保持一致。

## 设计要点

1. **参数命名与类型**
   - 仅暴露新命名（`serviceConfig/useFixedDeviceId/deviceId/...`）。
   - `serviceConfig.dnsConfigUrls` 表示使用指定 DNS_CONFIG 地址发现服务地址。
   - `serviceConfig.serverUrls` 表示固定 REST/WS 服务地址直连。
   - 参数通过 `InitConfig` 与校验器统一管理。

2. **默认值与约束**
   - `serviceConfig` 缺省时默认使用 SDK 内置 DNS_CONFIG 列表。
   - `serviceConfig.dnsConfigUrls` 与 `serviceConfig.serverUrls` 互斥。
   - `useFixedDeviceId` 默认 `true`，`deviceId` 默认 `webim`。
   - `customOsPlatform` 范围限制 1-100，非法值直接抛出校验错误。
   - `autoLogin` 仅在 uni-app 生效，其他环境忽略或记录提示。

3. **地址解析优先级**
   - 未配置 `serviceConfig` 时走内置 DNS_CONFIG。
   - 配置 `serviceConfig.dnsConfigUrls` 时走指定 DNS_CONFIG。
   - 配置 `serviceConfig.serverUrls` 时固定服务地址直连，`restApiUrl/wsUrl` 必填。
   - 同时配置 `serviceConfig.dnsConfigUrls` 与 `serviceConfig.serverUrls` 时直接报错。

4. **设备标识生成**
   - 复用旧工程 `deviceId/isFixedDeviceId/customOsPlatform/customDeviceName` 的生成逻辑。
   - 保持多端登录互踢策略一致。

## 实施步骤

1. 扩展 `InitConfig` 类型与初始化校验规则，新增字段与默认值。
2. 在 `ChatClient.init` 中注入新字段到连接上下文。
3. 更新连接与 msync 模块使用新字段的逻辑。
4. 补充单元测试覆盖默认值与边界条件。
5. 更新文档与示例。

## 测试策略

- **参数校验**：`customOsPlatform` 越界报错、`serviceConfig.serverUrls` 缺少地址报错、DNS_CONFIG 与固定地址混配报错、旧顶层地址字段报错。
- **默认值**：未传参时默认值正确。
- **兼容性**：行为与旧工程一致（设备标识生成、审核替换策略）。

## 风险与权衡

- **风险**：命名迁移可能导致旧用户接入成本。
  - **应对**：明确是否提供兼容旧命名的映射策略（可选）。
