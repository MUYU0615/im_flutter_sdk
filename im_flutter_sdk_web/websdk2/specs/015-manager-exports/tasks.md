# Tasks: Manager 独立导出与 Tree Shaking 优化

**Input**: Design documents from `/specs/015-manager-exports/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 未在规格中强制要求新增测试任务。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 项目初始化与现状确认

- [X] T001 盘点现有构建与导出配置（`package.json`, `vite.config.ts`, `src/index.ts`）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 为所有 user story 提供基础结构

- [X] T002 创建 Manager 子路径入口目录并导出 ChannelManager（`src/managers/channel/index.ts`）
- [X] T003 调整主入口复用子路径导出（`src/index.ts`）
- [X] T004 配置多入口 ESM 输出并保留模块边界（`vite.config.ts`）

---

## Phase 3: User Story 1 - 只引入单个 Manager 以缩小包体 (Priority: P1) 🎯 MVP

**Goal**: 支持 `im-sdk-web/managers/channel` 子路径导入并保证 tree shaking 生效。

**Independent Test**: 在示例工程仅导入子路径并构建，验证产物不包含其他 Manager 代码。

### Implementation for User Story 1

- [X] T005 [US1] 增加子路径导出映射与类型声明路径（`package.json`）
- [X] T006 [US1] 确保子路径 `.d.ts` 产物与 ESM 产物一致（`tsconfig.build.json` 与构建脚本）

---

## Phase 4: User Story 2 - CDN/脚本引入使用单文件 bundle (Priority: P2)

**Goal**: 输出单文件 bundle，支持脚本引入。

**Independent Test**: 使用单文件 bundle 在简单 HTML 页面中初始化 SDK。

### Implementation for User Story 2

- [X] T007 [US2] 添加单文件 bundle 构建配置（`vite.config.ts`）
- [X] T008 [US2] 为 bundle 配置发布入口（`package.json`，如 `unpkg`/`jsdelivr`）

---

## Phase 5: User Story 3 - CJS 环境可正常使用 (Priority: P2)

**Goal**: `require('im-sdk-web')` 可正常加载。

**Independent Test**: 在 CJS 环境中调用基础 API 无运行时错误。

### Implementation for User Story 3

- [X] T009 [US3] 添加 CJS 输出构建配置（`vite.config.ts`）
- [X] T010 [US3] 更新 CJS 入口映射（`package.json` 的 `main`/`exports.require`）

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 文档与收尾校验

- [X] T011 [P] 更新导入方式文档说明（`docs/reference/api.md`）
- [X] T012 运行构建与产物检查（`package.json` 中的 `npm run build`）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P2)**: Can start after Foundational (Phase 2)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2)

### Parallel Opportunities

- T002 与 T003 可并行（不同文件）
- T007/T009 可并行（同一配置文件需串行合并，执行需协调）
- T011 可并行执行

---

## Parallel Example: User Story 1

```bash
# 任务可并行示例（团队协作）
# 终端 A
# 执行 T005：更新 package.json exports

# 终端 B
# 执行 T006：检查/调整 d.ts 输出配置
```
