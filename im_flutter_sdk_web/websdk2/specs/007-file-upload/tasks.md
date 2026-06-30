---
description: '附件上传与消息发送'
---

# 任务清单：附件上传与消息发送

**Input**: `/specs/007-file-upload/`  
**Prerequisites**: plan.md、spec.md  
**Tests**: 必须包含单元/集成测试  
**Organization**: 任务按用户故事分组

## 格式: `[ID] [P?] [Story] 描述`

---

## 阶段 1：基础配置与类型

- [ ] T001 定义上传阈值常量（5MB）与上传配置
- [ ] T002 [P] 定义上传结果与错误码结构（7000 段）
- [ ] T003 [P] 增加附件上传相关类型（UploadRequest/UploadResult/UploadCallbacks）
- [ ] T004 [P] 更新 MessageBody 类型与校验规则，补齐 secret/fileLength/size/thumbnailUrl 等字段

---

## 阶段 2：简单上传

- [ ] T005 [US1] 实现简单上传 REST 方法（单次上传）
- [ ] T006 [US1] 上传成功后补齐消息体字段
- [ ] T007 [P] 简单上传单元测试

---

## 阶段 3：分片上传

- [ ] T008 [US2] 实现分片上传 init/upload/complete
- [ ] T009 [US2] 分片 init 失败回退到简单上传
- [ ] T010 [P] 分片上传单元测试

---

## 阶段 4：消息发送集成

- [ ] T011 [US1] 发送前注入附件上传预处理（统一由 AttachmentUploader 处理）
- [ ] T012 [US3] 已有远程 url 跳过上传；本地 url 或 data 存在仍上传
- [ ] T013 [P] 发送流程集成测试（含附件消息）

---

## 阶段 5：事件与错误

- [ ] T014 [US4] 进度/错误回调通过 sendMessage options 对外透出
- [ ] T015 [P] 错误路径与超时测试

---

## 阶段 6：文档与验收

- [ ] T016 [P] README/文档补充附件上传说明与限制
- [ ] T017 [P] 记录未实现范围与后续计划
- [x] T018 [P] 补充分片上传实现回归测试（init/part/complete/error）`tests/unit/upload/multipart-upload.test.ts`
- [x] T019 [P] 补充 simple upload 回归测试（progress/abort/timeout/http-error/response-parse）`tests/unit/upload/simple-upload.test.ts`
