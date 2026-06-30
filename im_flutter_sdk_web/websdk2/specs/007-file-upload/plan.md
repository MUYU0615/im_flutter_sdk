# 实施方案：附件上传与消息发送

**Branch**: `007-file-upload` | **Date**: 2026-01-23 | **Spec**: `specs/007-file-upload/spec.md`  
**Input**: 规范文档 `/specs/007-file-upload/spec.md`

## 概述

为附件类消息增加上传流程，按照文件大小选择简单上传或分片上传，上传成功后补齐消息体再发送。保持与原工程上传行为一致，错误处理接入 005 规范。

## 技术背景

- **上传入口参考**: `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/mSync.ts`（upLoadFile）
- **策略选择参考**: `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/utils/index.ts`（uploadFile）
- **分片上传参考**: `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/uploadFile/index.ts`

## 设计要点

1. **上传策略选择**
   - 文件大小 > 5MB：分片上传。
   - 文件大小 ≤ 5MB：简单上传。
   - 分片 init 失败自动降级为简单上传。

2. **上传模块拆分**
   - 新增 `src/upload/` 目录，拆分为 `simple-upload` 与 `multipart-upload`。
   - 暴露统一的 `uploadAttachment` API，用于消息发送前预处理。

3. **消息发送集成**
   - 在发送前判断消息类型是否为附件类型（image/video/voice/file）。
   - 若 `message.body.url` 为远程 URL 且 `data` 不存在，直接发送。
   - 若 `data` 存在或 `url` 为本地地址（blob:/data:/file:/wxfile:），仍需上传。
   - 上传成功后补齐 `url/secret/fileLength/filetype/size` 再发送。

4. **错误处理与回调**
   - 上传失败返回 SDKError（7000 段）。
   - 上传回调通过 `sendMessage(message, options)` 传入（不使用 EventHub）。

5. **与现有结构对齐**
   - 复用 `RestClient` 与 `UPLOAD_TIMEOUT` 配置。
   - 上传结果字段同步到 MessageBody 类型与校验规则。

## 实施说明

- **上传入口**：由 `MessageSender` 或新的 `AttachmentPreprocessor` 统一处理。
- **简单上传**：单次 REST 上传，返回 `url/secret`。
- **分片上传**：`init -> upload parts -> complete`。
- **回退策略**：分片 init 失败 -> 简单上传。
- **消息体补齐**：image/video 附加 thumbnail/size 字段（如返回信息存在）。

## 测试策略

- **策略选择**：5MB 阈值前后选择正确策略。
- **跳过上传**：已有 url 时直接发送。
- **分片流程**：init 失败回退、parts 失败异常。
- **消息体补齐**：url/secret/fileLength/filetype 被正确写入。

## 风险与权衡

- **风险**: 上传结果字段与现有消息类型对齐不足。
  - **应对**: 对照原工程 upLoadFile 返回结构进行字段映射。
- **风险**: 分片失败导致上传耗时长。
  - **应对**: 保持回退机制，并保证错误及时返回。
