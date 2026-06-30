---

description: "附件消息 data 内部缓存化"
---

# 任务清单：附件消息 data 内部缓存化

**Input**: `/specs/008-attachment-data-cache/`  
**Prerequisites**: plan.md、spec.md  
**Tests**: 必须包含单元测试  
**Organization**: 任务按用户故事分组

## 格式: `[ID] [P?] [Story] 描述`

---

## 阶段 1：缓存与类型调整

- [x] T001 [P] 新增 AttachmentFileStore（set/get/consume/clear）并提供单测
- [x] T002 [P] MessageBody 移除 data；CreateMessageParams 保留 data
- [x] T003 [P] create-message 写入缓存并从返回消息体移除 data

---

## 阶段 2：发送流程集成

- [x] T004 [US1] AttachmentUploader 从缓存读取文件并上传
- [x] T005 [US2] 本地 url 缓存缺失抛出 UploadError；远程 url 允许直接发送
- [x] T006 [US3] 发送成功后清理缓存；失败保留用于重试；登出/销毁时清理全部缓存

---

## 阶段 3：测试与验证

- [x] T007 [P] 附件消息创建不包含 data 的单元测试
- [x] T008 [P] 上传流程使用缓存文件的单元测试
- [x] T009 [P] 失败重试与登出/销毁清理缓存的测试
