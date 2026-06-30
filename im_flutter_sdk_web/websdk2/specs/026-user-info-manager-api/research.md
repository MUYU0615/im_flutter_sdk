# 026 研究结论（Phase 0）

## 1) 查询命名对齐策略

- **Decision**: 查询 API 对齐移动端，采用 `fetchUserInfoByUserId` 与 `fetchUserInfoByAttribute`，并移除旧 `fetchUserInfoById`。
- **Rationale**: 移动端已经按“默认字段查询 / 显式属性查询”稳定分流；继续保留旧 Web 混合参数方法会让类型、文档和测试长期处于双轨状态。
- **Alternatives considered**:
  - 保留 `fetchUserInfoById` 并接受 `string | string[]`: 仍然把两种查询语义压在一个名字下，扩展成本高。
  - 保留旧名作为兼容别名: 可以降低迁移成本，但会延长公开 API 双轨期，与本期“直接收敛”目标冲突。

## 2) 更新命名对齐策略

- **Decision**: 更新 API 对齐移动端，采用 `updateOwnInfo` 与 `updateOwnInfoByAttribute`，并移除旧 `updateUserInfo` / `updateOwnUserInfo`。
- **Rationale**: 查询侧已经选择移动端语义，更新侧若继续保留 Web 旧命名，UserInfoManager 会出现“查询对齐、更新不对齐”的割裂模型。
- **Alternatives considered**:
  - 仅把 `updateUserInfo` 改名为 `updateOwnInfo`: 无法清晰表达“整对象更新”和“单属性更新”的语义差异。
  - 保留旧更新名兼容: 迁移成本更低，但会让导出、JSDoc、示例和测试长期维护两套入口。

## 3) 查询成功响应 envelope 归一化

- **Decision**: 查询实现与测试以已确认真实样例 `{ timestamp, data, lastModified, duration }` 为主；`data` 作为 `Record<userId, attributes>` 主数据来源，`lastModified` 作为 `Record<userId, number>` 内部元数据来源。
- **Rationale**: 你已给出真实成功响应；Constitution 明确要求 REST/API 映射必须基于真实返回结构编写与验证。
- **Alternatives considered**:
  - 沿用当前代码里的 `entities` / `data.entities` 历史兼容解析作为主路径: 不能体现当前已确认真实样例，且会继续掩盖资料时间戳映射。
  - 直接把 envelope 暴露给调用方: 违反“SDK 对外方法返回业务对象”的规范。

## 4) 更新成功响应 envelope 归一化

- **Decision**: 更新实现与测试以已确认真实样例 `{ timestamp, data, lastModified, duration }` 为主；`data` 表示当前用户已设置过的全部属性，SDK 统一归一化为 `UserInfo`。
- **Rationale**: 真实成功响应已经明确，继续仅按请求参数本地拼装返回值会丢失服务端最终状态，也无法处理服务端补全或回写差异。
- **Alternatives considered**:
  - 成功返回 `void`: 会让调用方更新后还要额外查询一次，不符合你已确认的返回方向。
  - 继续返回摘要模型 `UserInfoSummary`: 无法承载 `mail/phone/gender/birth` 等字段。

## 5) 公开返回模型选择

- **Decision**: 查询和更新统一返回 `UserInfo`；`updateOwnInfoByAttribute` 的返回与 `updateOwnInfo` 完全一致。
- **Rationale**: 统一业务对象能让查询/更新、缓存桥接和文档示例都围绕同一模型展开，减少类型扩散。
- **Alternatives considered**:
  - 查询返回完整对象、更新返回 `void` 或摘要对象: 调用方体验与类型心智不一致。
  - 更新单属性 API 返回不同结构: 会增加测试和文档复杂度。

## 6) 缓存桥接策略

- **Decision**: 公开层返回完整 `UserInfo`，缓存层继续复用现有 `UserInfoSummary` 与 `CacheManager`；通过一个统一投影 helper 把完整对象写入摘要缓存。
- **Rationale**: 014 的缓存体系已经在线使用，直接重构持久化模型成本高；桥接可以在不打破现有缓存结构的前提下完成 026 的公开 API 升级。
- **Alternatives considered**:
  - 直接把 `UserInfoCache` 扩为完整资料模型: 风险更大，会影响 014、024 和现有缓存落盘兼容。
  - 完全不写回缓存，仅返回本次结果: 会破坏 014 对查询/更新成功后写缓存的要求。

## 7) 破坏性迁移策略

- **Decision**: 接受本期公开 API 的破坏性调整；旧查询名与旧更新名全部移除，通过类型错误、迁移说明、CHANGELOG 和对照文档完成迁移引导。
- **Rationale**: 你已经明确选择不保留兼容层；继续拖延兼容期只会增加实现和维护成本。
- **Alternatives considered**:
  - 保留一层兼容别名: 短期更平滑，但与当前需求决策冲突。
  - 在 manager 内运行时打印废弃告警后延迟删除: 仍然需要保留双实现或双导出，不符合本期目标。

## 8) API 对照文档产出策略

- **Decision**: 后续新增 `docs/reference/user-info-manager-api.md`，结构与写法直接参考 `docs/reference/contact-manager-api.md`。
- **Rationale**: 仓库里已经有一份稳定的“REST 与 SDK 返回对照”模板，复用它可以保持跨 manager 文档风格统一。
- **Alternatives considered**:
  - 只在 `docs/reference/api.md` 里补示例: 不足以承载真实 envelope、字段映射与迁移说明。
