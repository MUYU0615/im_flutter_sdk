# 功能规格：Manager 注册与使用（use 为主，init managers 为辅）

**Feature Branch**: `009-manager-usage`  
**Created**: 2026-01-29  
**Status**: Draft  
**Input**: 用户需求：“提供 use 与 init managers 两种注册方式，但明确 use 为主，init 为辅；Manager 仅在 use 后具备类型提示。”  
**Reference**:
- `docs/reference/api.md`
- `specs/001-im-sdk-refactor/plan.md`

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - use 注册单个 Manager 并获得类型提示 (Priority: P1)

开发者通过 `client.use(ChatManager)` 注册管理器后，返回的 client 为同一实例，但类型上扩展出 `chatManager` 属性与完整提示；未使用 `use` 的 client 不包含该属性。

**Why this priority**: `use` 是主入口方式，必须具备最清晰的类型体验与最少的心智负担。

**Independent Test**: 仅实现 `use` 即可让开发者完成单个管理器注册与调用。

**Acceptance Scenarios**:
1. **Given** 已初始化的 `client`，**When** 调用 `client.use(ChatManager)`，**Then** 返回的 client 实例不变但具备 `chatManager` 类型提示。
2. **Given** 未调用 `use` 的 `client`，**When** 直接访问 `client.chatManager`，**Then** TypeScript 报类型错误。
3. **Given** `chatManager` 未绑定 `client`，**When** 调用 `chatManager.getHistoryMessage()`，**Then** 抛出明确的未绑定错误。

---

### 用户故事 2 - init 批量注册 Manager（高级用法）(Priority: P1)

开发者在 `ChatClient.init({ managers })` 中批量注册管理器，自动完成绑定；文档明确此方式为高级用法，主推 `use`。

**Why this priority**: 批量注册可减少样板代码，满足需要统一初始化或自定义实例的场景。

**Independent Test**: 仅实现 `init({ managers })` 即可完成批量注册与自动绑定。

**Acceptance Scenarios**:
1. **Given** `ChatClient.init({ managers: [ChatManager] })`，**When** 初始化完成，**Then** `client.chatManager` 可用且已绑定。
2. **Given** `ChatClient.init({ managers: [new ChatManager()] })`，**When** 初始化完成，**Then** 使用自定义实例并完成绑定（key 取自实例的 `constructor.key`）。
3. **Given** `managers` 中存在重复 key，**When** 初始化，**Then** 抛出参数校验错误。

---

### 用户故事 3 - 多 Manager 链式注册与类型叠加 (Priority: P2)

开发者通过链式 `use` 注册多个管理器，类型提示能够逐步叠加。

**Why this priority**: 多管理器是常态场景，链式方式可确保类型连续性。

**Independent Test**: 仅实现链式 `use` 即可验证多管理器类型叠加。

**Acceptance Scenarios**:
1. **Given** `client.use(ChatManager).use(ContactManager)`，**When** 使用返回的新 client，**Then** 同时具备 `chatManager` 与 `contactManager` 类型提示。
2. **Given** 重复 `use(ChatManager)`，**When** 再次调用，**Then** 返回同一实例且不产生副作用。

### Edge Cases

- `use` 与 `init({ managers })` 混用时的重复注册处理与冲突策略。
- 管理器 `key` 冲突（不同管理器使用相同 key）。
- 管理器内部调用在 `bind` 前触发。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: ChatClient 必须提供 `use(ManagerCtor)` 注册单个管理器，并返回带新管理器属性的扩展类型。
- **FR-002**: `use` 为主入口（默认推荐），`init({ managers })` 为辅入口（高级用法）。
- **FR-003**: ChatClient.init 必须支持可选 `managers` 参数，允许传入管理器构造器或实例并自动绑定；实例的 key 必须从 `manager.constructor.key` 获取，缺失时抛出参数校验错误。
- **FR-004**: 管理器必须声明唯一 `key` 且实现 `bind(client)`，绑定前调用需抛出明确错误。
- **FR-005**: `use` 重复注册同一 key 时需幂等处理，返回已有实例且不重复绑定。
- **FR-006**: `init` 传入的 `managers` 列表如存在重复 key，必须抛出参数校验错误。
- **FR-007**: `use` 与 `init` 混用时，如 key 已注册且构造器匹配则返回已注册实例；若构造器不匹配或实例冲突，必须抛出参数校验错误。
- **FR-008**: 多管理器链式 `use` 必须支持类型叠加（TypeScript 可推导出所有已注册管理器属性）。
- **FR-009**: `use` 仅接受无参构造器；需要配置参数时应通过 `init({ managers: [new Manager(options)] })` 传入实例。
- **FR-010**: 管理器未绑定时调用方法必须抛出 `ValidationError`，错误码为 `ERROR_CODES.VALIDATION_REQUIRED`，错误信息为 `Manager is not bound to ChatClient`，并在 details 中包含 `managerKey`。

### 关键实体 *(include if feature involves data)*

- **ChatClient**: SDK 入口，负责管理器注册与绑定。
- **ManagerBase**: 管理器基类约束（`key` + `bind(client)`）。
- **ManagerRegistry**: 管理器注册表（key → instance）。

### 设计与类型建议

```ts
export interface ManagerBase<C> {
  bind(client: C): void;
}

export interface ManagerConstructor<M extends ManagerBase<ChatClient>, K extends string> {
  new (): M;
  readonly key: K;
}

export type WithManager<C, K extends string, M extends ManagerBase<C>> = C & {
  readonly [P in K]: M;
};
```

```ts
const client = ChatClient.init({ appKey: 'org#app' })
  .use(ChatManager)
  .use(ContactManager);

client.chatManager.getHistoryMessage();
client.contactManager.getContacts();
```

> 提示：若使用 `init({ managers })` 需要类型推导，应以 tuple 形式传入，并在 API 上提供泛型支持；文档需提示 `use` 为主入口。实例注册时 key 取自 `manager.constructor.key`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `use` 注册后，TypeScript 能提示对应的 `client.<managerKey>`。
- **SC-002**: `init({ managers })` 能自动绑定所有管理器且无重复 key 问题。
- **SC-003**: `use` 为主入口在文档与示例中明确体现，`init` 标注为高级用法。

## Out of Scope

- ChatManager/ContactManager 的具体业务 API 设计与实现。
- `im-sdk-web/contacts` 等子路径导出设计。
