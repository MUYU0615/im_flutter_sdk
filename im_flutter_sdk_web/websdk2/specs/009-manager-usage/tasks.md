---

description: "Manager 注册与使用（use 为主，init managers 为辅）"
---

# 任务清单：Manager 注册与使用（use 为主，init managers 为辅）

**Input**: `/specs/009-manager-usage/`  
**Prerequisites**: plan.md、spec.md  
**Tests**: 建议包含单元测试  
**Organization**: 任务按用户故事分组

## 格式: `[ID] [P?] [Story] 描述`

---

## 阶段 1：基础类型与配置

- [x] T001 [P] 新增管理器基础类型 `src/types/manager.ts`（ManagerBase/ManagerConstructor/WithManager/ManagerInstanceKey 规则）并导出
- [x] T002 [P] 扩展 `src/types/chat-client.ts` 的 `InitConfig` 支持 `managers` 入参
- [ ] T003 [P] 更新 `src/validators/chat-client.ts` 支持 managers 校验、`constructor.key` 缺失校验与重复 key 检测

---

## 阶段 2：用户故事 1 - use 注册单个 Manager (P1)

- [x] T004 [US1] 在 `src/chat-client.ts` 实现管理器注册表与 `use` 方法（幂等、构造器匹配校验、绑定、挂载）
- [x] T005 [US1] 新增 `tests/unit/chat-client/manager-use.test.ts` 覆盖 use 注册与幂等行为

---

## 阶段 3：用户故事 2 - init 批量注册 Manager（高级用法）(P1)

- [x] T006 [US2] 扩展 `ChatClient.init` 支持 `managers`（构造器/实例）并复用注册逻辑
- [x] T007 [US2] 新增 `tests/unit/chat-client/manager-init.test.ts` 覆盖批量注册与 key 冲突

---

## 阶段 4：用户故事 3 - 多 Manager 链式注册 (P2)

- [x] T008 [US3] 支持 `use` 链式调用并保持类型叠加（TypeScript 推导）
- [x] T009 [US3] 新增 `tests/types/manager-usage.d.ts` 覆盖 tuple 推导的类型校验
- [ ] T010 [US3] 在 `tests/unit/chat-client/manager-use.test.ts` 增加链式注册的运行时验证

---

## 阶段 5：文档与示例

- [ ] T011 [P] 更新 `docs/reference/api.md`，明确 `use` 为主入口、`init` 为高级用法，并补充 tuple 示例
