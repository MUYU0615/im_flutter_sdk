---

description: "错误处理与数字错误码"
---

# 任务清单：错误处理与数字错误码

**Input**: `/specs/005-error-handling/`  
**Prerequisites**: plan.md、spec.md  
**Tests**: 必须包含单元测试  
**Organization**: 任务按用户故事分组

## 格式: `[ID] [P?] [Story] 描述`

---

## 阶段 1：错误契约与码表

- [x] T001 定义 API_ERRORS 结构标准并对齐 EMError 官方码表
- [x] T002 [P] 更新 SDK 基础错误类，加入 `details`
- [x] T003 [P] 增加错误码文档生成流程，输出到 `docs/reference/errors.md`
- [x] T004 [P] 规定并实现 `details` 字段结构规范校验（单测覆盖）
- [x] T005 [P] 明确扩展错误码标注规则（非官方码需注明来源）并体现在文档生成

---

## 阶段 2：用户故事 1 - 参数校验错误

- [x] T006 [P] 定义校验错误码（必填/格式）
- [x] T007 [US1] 更新参数校验器，抛出数字校验错误并包含字段详情
- [x] T008 [P] 补充校验错误单元测试

---

## 阶段 3：用户故事 2 - 消息发送失败

- [x] T009 [US2] 定义消息发送错误码（未连接/ACK 超时/发送失败）
- [x] T010 [US2] 更新消息发送器返回数字错误码与消息标识
- [x] T011 [P] 补充消息发送失败单元测试

---

## 阶段 4：用户故事 3 - REST 错误（传输 vs 业务）

- [x] T012 [US3] 定义 REST 传输错误码与映射
- [x] T013 [US3] 定义 API 业务错误码映射（参考 refactor.md 第 6 点）
- [x] T014 [US3] 更新 REST 客户端区分并映射传输/业务错误
- [x] T015 [P] 补充 REST 错误映射单元测试

---

## 阶段 5：用户故事 4 - Ajax/Fetch 错误

- [x] T016 [US4] 包装 fetch/ajax 异常为传输错误码，包含必要信息
- [x] T017 [P] 补充 fetch 异常单元测试

---

## 阶段 6：文档

- [x] T018 [P] 编写错误契约、码表与 API 错误表文档

---

## 阶段 7：Runtime 错误映射轻量化与本地化文案分离

- [ ] T019 [P] 将完整错误码源拆分为 runtime 映射字段与 zh-CN/en-US 文案字段，明确单一源数据结构
- [x] T020 [P] 生成 runtime-only error maps，移除默认 SDK bundle 中的 `message/reason/action/summary` 文案字段
- [x] T021 [P] 按 Manager 拆分 runtime error maps，并保留 `common` 共享映射
- [ ] T022 [US3] 调整 REST 错误 resolver，按 `operation -> manager common -> global common -> HTTP fallback` 顺序匹配
- [x] T023 [P] 调整 `error-codes.ts`，避免直接 import 包含文案的完整 `api-errors.json`
- [x] T024 [P] 生成 zh-CN/en-US locale packs，用于文档与可选业务展示
- [x] T025 [P] 更新中文和英文 API Reference 生成脚本，使错误码表分别读取对应语言文案
- [x] T026 [P] 增加文案覆盖检查：runtime 映射 key 必须有 zh-CN 文案，公开 API 错误映射必须有 en-US 文案
- [x] T027 [P] 增加构建检查：runtime error maps 不得包含本地化文案字段或中文长文案
- [x] T028 [P] 增加 tree-shaking 检查：未引入某个 Manager 时不应包含该 Manager 的 API 专属错误映射
- [x] T029 [P] 补充重复 server error key 的单元测试，确保 `exceed_limit` 等 key 按 operation 精确匹配
- [ ] T030 [P] 记录可选 CDN locale pack 加载策略，明确 CDN 只影响展示文案，不影响核心错误映射
