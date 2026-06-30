# 自有上传图片 URL 语义收敛计划

日期：2026-04-21

## 背景

图片消息当前默认会基于 `originalImageUrl` 自动派生 `largeImageUrl` 和 `thumbnailUrl`，接收侧也会按 `?size=large` / `?size=small` 规则补齐三条远端 URL。该行为不适用于业务侧自有上传场景。

## 目标

新增 SDK 初始化参数 `useCustomAttachmentUpload?: boolean`，用于切换图片 URL 语义：

- `false` 或未传：保持当前默认行为
- `true`：
  - 创建图片消息时不自动派生 `largeImageUrl` / `thumbnailUrl`
  - 接收图片消息时不自动派生 `largeImageUrl` / `thumbnailUrl`
  - 接收图片消息时不拼接 `size` 参数
  - `thumbnailUrl` 允许业务显式透传
  - 业务传远端 `originalImageUrl` 且不带 `data` 时，SDK 不上传、不预检

## 实施项

1. 初始化配置
   - 在 `InitConfig`、校验器、`NormalizedInitConfig`、核心链路配置里新增 `useCustomAttachmentUpload`
2. 创建侧
   - 在 `createImageMessage` 增加派生开关
   - `useCustomAttachmentUpload=true` 时仅保留 `originalImageUrl`，透传显式 `thumbnailUrl`
3. 上传与回写
   - 在上传结果组装中增加派生开关
   - 自有上传模式下不自动回填 `largeImageUrl` / 派生缩略图
4. 接收侧
   - 在 `MsyncCodec` 与 `ProtobufDecoder` 中按开关决定是否派生
5. 测试与文档
   - 新增/更新单测与集成测试
   - 同步 029 契约与规格文档
6. 收尾
   - 执行 `type-check`、`lint`、定向测试
   - 更新版本号、`CHANGELOG.md`
   - 提交本地 commit
