# 实施方案：附件消息 data 内部缓存化

**Branch**: `008-attachment-data-cache` | **Date**: 2026-01-27 | **Spec**: `specs/008-attachment-data-cache/spec.md`  
**Input**: 规范文档 `/specs/008-attachment-data-cache/spec.md`

## 概述

将附件消息的 `data` 字段从对外 MessageBody 中移除，改为发送阶段的内部缓存。创建消息时把文件对象写入缓存并生成本地 URL；发送时从缓存读取文件进行上传，并在发送成功/失败后清理缓存。

## 设计要点

1. **统一缓存模块**
   - 新增 `AttachmentFileStore` 单例模块（建议放在 `src/upload/`），提供 `set/get/consume/clear`。
   - `set` 覆盖旧值（同一 msgLocalId 以最新文件为准）。

2. **消息创建阶段**
   - CreateMessage 入参继续允许 `data`。
   - 创建消息时把 `data` 写入缓存，并在返回的 MessageBody 中移除 `data` 字段。
   - 仍生成 `url`（`blob:` 或小程序 path）用于 UI 预览。

3. **发送阶段**
   - `AttachmentUploader` 从缓存获取文件（优先 `get`，发送结束后统一清理）。
   - 若 `url` 为本地地址且缓存缺失，抛出 `UPLOAD_REQUIRED_FIELD_MISSING`。
   - 若 `url` 为远程地址且缓存缺失，直接发送。

4. **清理策略**
   - 上传成功后清理缓存；上传失败保留缓存用于重试。
   - `ChatClient.logout`/`CoreSDK.destroy` 时清理所有缓存，避免泄漏。
   - 重复 `msgLocalId` 写入时覆盖旧缓存（以最新选择为准）。

## 实施步骤

1. 新增 `AttachmentFileStore` 模块与基础单测。
2. 调整 MessageBody 类型定义（移除 data），保留 CreateMessageParams 中的 data。
3. 在 `create-message` 阶段写入缓存、移除 body.data。
4. 在 `AttachmentUploader` 阶段读取缓存文件并上传；发送完成后释放缓存。
5. 更新相关单元/集成测试与 demo（仅行为，不修改文档）。

## 测试策略

- 创建附件消息后 body 不含 data。
- 附件上传能从缓存拿到文件并成功发送。
- 本地 url 缓存缺失时明确失败。
- 发送成功后缓存释放，失败后可重试。
- 登出/销毁时清理缓存。

## 风险与权衡

- **风险**：失败重试导致缓存长期驻留。
  - **应对**：明确失败保留用于重试，登出/销毁时清理；必要时可加入 TTL（非本阶段）。
- **风险**：全局单例缓存引发跨实例影响。
  - **应对**：在 ChatClient/Core 销毁时清理缓存。
