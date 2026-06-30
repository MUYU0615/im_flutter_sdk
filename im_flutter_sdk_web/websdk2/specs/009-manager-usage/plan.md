# 实施方案：Manager 注册与使用（use 为主，init managers 为辅）

**Branch**: `009-manager-usage` | **Date**: 2026-01-29 | **Spec**: `specs/009-manager-usage/spec.md`  
**Input**: 规范文档 `/specs/009-manager-usage/spec.md`

## 概述

在 ChatClient 上提供管理器注册能力，主入口为 `use(Manager)`，辅入口为 `init({ managers })`。`use` 返回带管理器属性的扩展类型；`init` 支持构造器或实例并自动绑定。管理器需声明唯一 `key` 并提供 `bind(client)`。

## 设计要点

1. **管理器类型约束**
   - 管理器必须实现 `ManagerBase<ChatClient>` 并声明静态 `key`。
   - `key` 使用字面量类型（`as const`）确保类型推导准确。

2. **统一注册逻辑**
   - ChatClient 内部维护注册表（`Map<key, instance>`）。
   - `use` 若 key 已存在且构造器匹配则返回已有实例（幂等）；构造器不匹配时抛出冲突错误。
   - 注册时完成 `bind(client)` 与实例挂载（`client[key] = manager`）。

3. **init 批量注册（高级用法）**
   - `init({ managers })` 允许传入构造器或实例，实例 key 取自 `manager.constructor.key`。
   - 先校验 key 冲突与构造器不匹配，后顺序注册并绑定。

4. **类型推导策略**
   - `use` 通过泛型返回 `WithManager` 扩展类型，返回对象为同一实例。
   - `init` 支持 tuple 推导（`managers: [...] as const`）以保留各 key 类型。

5. **错误与保护**
   - key 冲突：在 `init` 校验时抛出参数错误。
   - 未绑定调用：抛出 `ValidationError`（`ERROR_CODES.VALIDATION_REQUIRED`），包含 `managerKey`。

6. **构造器限制**
   - `use` 仅支持无参构造器；需要配置参数时通过实例注册。

## 实施步骤

1. 新增管理器基础类型（`ManagerBase/ManagerConstructor/WithManager`）与导出入口。
2. 扩展 `InitConfig` 支持 `managers` 入参，并调整校验逻辑。
3. 在 `ChatClient` 实现 `use` 与注册表，保证幂等与绑定。
4. 扩展 `ChatClient.init` 支持批量注册（构造器/实例）。
5. 补充文档与示例，明确 `use` 为主入口、`init` 为高级用法。

## 测试策略

- `use` 注册后可通过运行时属性访问管理器。
- `use` 重复注册同一 key 不重复绑定且返回同一实例。
- `init({ managers })` 可注册构造器与实例，且能检测重复 key。
- 链式 `use` 支持多管理器同时可用。
- tuple 注册的类型推导可通过 `tsc --noEmit` 验证。

## 风险与权衡

- **风险**：类型泛型复杂度提升。
  - **应对**：以 `use` 作为主入口，文档提供 tuple 示例。
- **风险**：`init` 允许实例可能引入状态共享。
  - **应对**：强调高级用法并要求实例自管理状态。
