---

description: "消息扩展字段实现任务清单"
---

# 任务清单：消息扩展字段

**Input**: `/specs/017-message-extra-fields/`  
**Prerequisites**: spec.md、plan.md  
**Tests**: 必须包含单元测试与回归测试  
**Organization**: 按阶段执行，先测试再实现

## 格式: `[ID] [P?] 描述`

---

## 阶段 1：类型与创建参数

- [X] T001 扩展 `src/types/index.ts`：新增 `direct/receiverList/deliverOnlineOnly/priority/isBroadcast/isContentReplaced`
- [X] T002 [P] 扩展 `src/types/message-create.ts`：创建参数支持 `receiverList/deliverOnlineOnly/priority`
- [X] T003 [P] 扩展 `src/validators/message-create.ts`：新增字段校验规则

---

## 阶段 2：测试优先（创建链路）

- [X] T004 [P] 更新 `tests/unit/message/create-text-message.test.ts`：断言 `direct` 默认值与 `receiverList/priority` 透传
- [X] T005 [P] 更新 `tests/unit/message/create-cmd-custom-message.test.ts`：断言 `deliverOnlineOnly` 顶层透传

---

## 阶段 3：创建链路实现

- [X] T006 更新 `src/message/create-message.ts`：构建 Message 时透传扩展字段并默认 `direct = 'SEND'`

---

## 阶段 4：测试优先（协议与接收链路）

- [X] T007 [P] 更新 `tests/unit/core/message/message-receiver.test.ts`：断言 `direct/isBroadcast/isContentReplaced` 下行解析与 ACK 不回调

---

## 阶段 5：协议实现

- [X] T008 更新 `src/protocol/msync/codec.ts`：实现 `receiverList/deliverOnlineOnly/priority` 编码映射与 `direct/isBroadcast/isContentReplaced` 解码

---

## 阶段 6：验证与收尾

- [X] T009 运行并通过：`npm run test:run -- tests/unit/message tests/unit/core/message/message-receiver.test.ts`
- [X] T010 运行并通过：`npm run lint`
- [X] T011 更新版本与 `CHANGELOG.md`，并提交 commit（不 push）
