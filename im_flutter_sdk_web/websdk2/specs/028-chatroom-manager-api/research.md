# 028 研究结论（Phase 0）

## 1) ChatRoomManager 作为聊天室域唯一公开入口，ChatRoom 作为单聊天室 façade

- **Decision**: 所有旧 `chatRoomApi.ts` 的聊天室域能力统一下沉到 `ChatRoomManager`，单聊天室上下文通过 `chatRoomManager.getChatRoom(chatRoomId)` 返回的 `ChatRoom` 对象访问；不保留 connection 风格公开 API 或别名。
- **Rationale**: 027 已经把群组域收口到 `GroupManager + Group` 模型。028 若继续保留 connection 风格聊天室入口，会让 manager 架构再次分裂。
- **Alternatives considered**:
  - 保留一层 connection 兼容别名：迁移期更平滑，但会长期污染公开 API 面。
  - 把聊天室能力继续全部放在 manager：入口单一，但单聊天室上下文能力缺少自然归属，和 027 风格不一致。

## 2) ChatRoom 不暴露同步属性、同步访问器或字段级 getter

- **Decision**: `ChatRoom` 仅承载显式异步方法；聊天室详情字段统一通过 `getInfo()` / `refresh()` 返回，不新增 `getName()`、`getOwner()`、`getCreateTimestamp()`、`getMuteExpireTimestamp()` 这类字段级 getter。
- **Rationale**: 这是你已经明确确认的对象边界，也是 028 与 027 保持一致的关键。如果同时存在 `getInfo()` 和字段级 getter，会重新引入“本地快照 vs 远端读取”的双重语义。
- **Alternatives considered**:
  - 保留移动端字段 getter：跨端表面更像，但会破坏 Web SDK 当前的异步方法模型。
  - 暴露同步属性缓存：实现上方便，但会引入缓存时效与一致性歧义。

## 3) 与群组同构的聊天室读取结果直接复用 027 的业务结构

- **Decision**: 聊天室详情、成员、管理员、禁言列表、黑名单、allowlist、公告、共享文件列表/删除等与群组同构或近同构的接口，直接复用 027 已确认的字段命名、数据结构和对象化策略。
- **Rationale**: 这类接口 upstream 语义一致，027 已经确认过真实返回与归一化方式，028 复用能显著降低拍字段风险，并保证跨域对象模型一致。
- **Alternatives considered**:
  - 单独定义聊天室专属变体：看起来更独立，但会制造不必要的结构分叉。
  - 全量依赖旧工程 TypeScript 类型推断：推进更快，但缺少 027 已确认样例的保护。

## 4) 聊天室公开列表保持单一分页结果模型

- **Decision**: `getChatRoomList()` 返回统一的 `ChatRoomListResult`，内部归一化优先基于 `docs/reference/chatroom-api.md` 的真实样例和 027 已确认的群组同构接口。
- **Rationale**: 当前公开面只保留公开聊天室列表，减少重复入口后，列表契约应尽量保持单一且稳定。
- **Alternatives considered**:
  - 继续保留已加入聊天室列表公开入口：能力更多，但会把旧接口差异长期暴露在公开面上。

## 5) 用户资料补齐统一复用 UserInfoManager，读取类 API 与事件保持同构

- **Decision**: 原本只返回 `userId` 或用户字符串的聊天室接口与聊天室事件统一复用 `UserInfo`；先读缓存，缺失时批量调用 `fetchUserInfoByUserId`，失败时回退最小 `UserInfo`。
- **Rationale**: 仓库在 025/026/027 已经形成稳定的资料补齐模式；028 直接复用这条链路，行为一致、测试资产也能复用。
- **Alternatives considered**:
  - 聊天室域单独定义 `ChatRoomUser` 类型：会和现有 `UserInfo` 重复造型。
  - 读取类接口对象化、事件仍只给字符串：调用体验分裂，事件层仍要业务自己补资料。

## 6) 事件名按 Web SDK 规范收敛，且共享文件事件不进入新的公开模型

- **Decision**: 聊天室事件采用 Web SDK 收敛后的多事件模型，如 `onChatRoomDestroyed`、`onMembersJoined`、`onAllowListAdded`、`onChatRoomInfoChanged`、`onMuteListAdded`、`onAttributesUpdate` 等；旧 `uploadFile` / `deleteFile` 相关聊天室 operation 不进入新的公开事件 API。
- **Rationale**: 你已经明确要求参考移动端拆分业务事件，同时进一步确认公开命名需要与 GroupManager 的 Web SDK 口径一致。两者结合后的结果就是“移动端业务语义 + Web 命名规范 + Web 对象化 payload”。
- **Alternatives considered**:
  - 保留一个 `onChatroomEvent` 总入口：实现简单，但业务事件不够类型化。
  - 继续暴露共享文件事件：看似完整，但违背已确认范围。

## 7) onChatRoomInfoChanged 采用“必要时补拉详情”的策略

- **Decision**: `onChatRoomInfoChanged` 对外返回完整标准化后的 `ChatRoomDetail`；若 MUC 原始事件不足以组装完整对象，则在派发前受控补拉一次聊天室详情。
- **Rationale**: 该事件语义上对应“聊天室规格对象发生变化”。如果只给 patch，调用方仍要自行决定是否再拉一次详情，公开 API 会变得不稳定。
- **Alternatives considered**:
  - 只返回 patch：网络最省，但调用方负担最大。
  - 每次都强制补拉：结果稳定，但所有规格变更事件都会增加网络成本。

## 8) 聊天室属性接口保留部分成功语义，但公开结果必须稳定

- **Decision**: `setAttributes`、`setAttribute`、`removeAttributes`、`removeAttribute` 继续承接 upstream 的部分成功能力，但对外统一收敛为稳定的属性变更结果对象，而不是默认暴露原始 `successKeys/errorKeys/status` 包装。
- **Rationale**: 聊天室属性接口已经有真实样例，且其“部分成功”是业务事实，不能丢；但直接暴露原始 envelope 会破坏 SDK 统一返回业务对象的原则。
- **Alternatives considered**:
  - 只要有失败就全部抛错：语义更简单，但会丢失部分成功信息。
  - 直接透传 `successKeys/errorKeys`：实现最省，但对外模型不统一。

## 9) 共享文件上传 API 从 028 公开范围中移除

- **Decision**: `uploadSharedFile` 不迁移到 028 的 `ChatRoom` 公开 API，不出现在 contract、文档、类型与任务范围中。
- **Rationale**: 需求方已在 `docs/reference/chatroom-api.md` 明确标注“移除这个 api”。继续把它留在 028 里只会制造后续实现与文档偏差。
- **Alternatives considered**:
  - 先保留为待定：短期看似灵活，但会让 plan/tasks 范围持续漂移。
  - 作为内部 API 保留：对公开面无价值，还会增加维护负担。

## 10) REST 契约确认优先级以真实样例和 027 同构接口为准

- **Decision**: 028 的 REST 解析与测试优先使用 `docs/reference/chatroom-api.md` 中已补充的真实样例；对未直接给出聊天室样例但已在 027 确认过相同 upstream 形态的接口，显式复用群组域契约；只有当实现阶段发现 upstream 与当前样例/同构推断不一致时，才追加新的样例。
- **Rationale**: 这同时满足 Constitution 的“真实返回样例优先”要求和你此前确认的“同类 REST API 可以复用群组数据结构”规则。
- **Alternatives considered**:
  - 所有聊天室接口都重新索要样例：最稳，但会放慢推进且有重复劳动。
  - 仅凭旧工程类型直接推断所有返回：推进快，但拍字段风险高。
