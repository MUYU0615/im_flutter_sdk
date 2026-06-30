---
description: 'Protobuf 私有协议与 WebSocket 收发'
---

# 任务清单：Protobuf 私有协议与 WebSocket 收发

**Input**: `/specs/006-protobuf-ws/`  
**Prerequisites**: plan.md、spec.md  
**Tests**: 必须包含单元/集成测试  
**Organization**: 任务按用户故事分组

## 格式: `[ID] [P?] [Story] 描述`

---

## 阶段 1：基础协议与配置

- [x] T001 定义并落地超时配置文件（MESSAGE/REQUEST/UPLOAD/CONNECT/PROVISION）
- [x] T002 [P] 定义 provision/编解码/ACK 相关错误码占位（遵循 005 码段）
- [x] T003 [P] 复用 proto.ts，建立 protobuf 编码/解码基础模块
- [x] T004 [P] 替换现有 JSON 占位实现为 protobuf 二进制实现
- [x] T005 [P] 建立统一错误码映射（连接/发送/解码）并接入 005 错误规范

---

## 阶段 2：用户故事 1 - provision 登录握手

- [x] T006 [US1] WebSocket onopen 生成并发送 provision 消息
- [x] T007 [US1] provision 超时与失败处理（连接回落 + 错误码）
- [x] T008 [P] provision 流程单测/集成测试

---

## 阶段 3：用户故事 2 - 发送消息（protobuf 编码）

- [x] T009 [US2] mSync send 流程落地（文本/命令/自定义消息）
- [x] T010 [US2] ACK 回包解析与 Promise resolve
- [x] T011 [US2] 发送失败/超时路径与错误码
- [x] T012 [P] 发送流程单元测试

---

## 阶段 4：用户故事 3 - 接收消息（protobuf 解码）

- [x] T013 [US3] onmessage 走 decodeMSync -> distributeMSync
- [x] T014 [US3] 聊天消息解析对齐 handleChatMsg 行为
- [x] T015 [P] 接收流程单元测试
- [x] T015-1 [P] NOTICE/UNREAD 队列拉取与 nextKey/isLast 续拉

---

## 阶段 5：重构与注释要求

- [x] T016 [P] 拆分 mSync 编解码模块，职责清晰可测试
- [x] T017 [P] 为接收解析流程添加关键注释（每个方法 + 核心分支）
- [x] T017-1 [P] 启用 LZ4 压缩协商与解压/压缩
- [x] T017-2 [P] protobuf uint64 使用 Long 解析避免精度丢失

---

## 阶段 6：文档与验收

- [x] T018 [P] 更新文档/README 中关于 protobuf 与收发流程的描述
- [x] T019 [P] 补充验收说明（支持的消息类型与未实现范围）

---

## 阶段 7：正式环境联调测试

- [x] T020 [P] 增加真实环境联调测试用例（通过 .env 提供账号）
- [x] T021 [P] 文档说明 .env 配置方式与 token 获取命令（含可选 curl）
- [x] T022 [P] 更新 .gitignore 忽略 .env，并提供 .env.example 模板

---

## 阶段 8：消息扩展字段协议同步（关联 017）

- [ ] T023 [US5] 发送编码支持 `receiverList/deliverOnlineOnly/priority` 协议映射
- [ ] T024 [US5] 接收解码支持 `direct/isBroadcast/isContentReplaced` 字段映射
- [ ] T025 [P] [US5] 增加 ACK 不触发 `onMessage` 与扩展字段映射的回归测试
- [x] T026 [P] 补充 protobuf 编解码单元测试（encoder/decode fallback/channel 推断）`tests/unit/protocol/protobuf-encoder.test.ts`、`tests/unit/protocol/protobuf-decoder.test.ts`
