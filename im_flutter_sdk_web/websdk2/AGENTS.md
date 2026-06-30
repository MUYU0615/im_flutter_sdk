# AGENTS 规则（Codex 与 Cursor 共用）

本文件只保留仓库特有、需要高频命中的协作规则。详细的技术原则、API 约束、测试门禁与代码规范以 [.specify/memory/constitution.md](/Users/zhangdong/code/websdk2/.specify/memory/constitution.md) 为准。

## 高优先级规则

- 协作沟通、计划、变更说明默认中文；对外 API 注释与文档按 Constitution 的双语规则执行。
- 修改项目后必须先验证，再更新版本号、[CHANGELOG.md](/Users/zhangdong/code/websdk2/CHANGELOG.md)，最后提交 `git commit`，不要 `git push`。
- 每次 `git commit` 的 commit message 必须使用中文。
- 大改动先写计划文件并等用户确认，再开始编码。
- 新功能开发先询问是否需要新建分支。
- 如果用户是在提问，先回答问题，再询问是否需要执行修改。
- 如果用户要求与现有规则或常理冲突，先说明风险与替代方案，再等待确认。

## API 错误码与文档维护

- 公开 API 注释里的 `@throws` 不是错误码文档的维护来源；不要通过给源码 JSDoc 添加 `@throws` 来维护 API Reference 的错误码表。
- REST 服务端业务错误以 `src/rest/api-errors.json` 的 `apis.<operation>.errors` 为唯一结构化来源：运行时 `RestClient` 会按请求中的 `operation` 读取该字段映射为 `SDKError.code`，Markdown 与 TypeDoc HTML API Reference 也从该字段生成错误码表。
- 本地参数校验错误由实现代码直接抛出 `ValidationError`；如果需要出现在 API Reference 中，应在同一个 `apis.<operation>` 下添加 `localErrors.<publicMethod>`。`localErrors` 仅用于文档生成与错误码聚合，不参与 REST 服务端错误匹配。
- 新增或调整 REST API 时，必须确保 `client.request(..., { operation })`、`api-errors.json` 的 API key、以及公开方法名之间可对应；如果公开方法名和 operation 不一致，在 `scripts/api-error-operation-aliases.js` 中补充映射。
- API Reference 中“可能出现的错误码”表应由 `api-errors.json` 生成，位置在当前 API 的 Parameters、Returns、Example 之后；表格面向用户，只展示 Code、含义、HTTP、处理建议、可重试等可处理信息，不展示内部来源 Key。
- 修改 `api-errors.json` 或相关生成脚本后，至少运行 `npm run docs:api:check` 与 `npm run errors:check`，并重新生成受影响的 API Reference 文档。

## 上下文入口

- 项目原则与质量要求：[constitution.md](/Users/zhangdong/code/websdk2/.specify/memory/constitution.md)
- 项目概览：[docs/process/project-summary.md](/Users/zhangdong/code/websdk2/docs/process/project-summary.md)
- 使用说明与 Spec-Kit 工作流：[README.md](/Users/zhangdong/code/websdk2/README.md)
- 架构总览：[project-structure.md](/Users/zhangdong/code/websdk2/docs/architecture/project-structure.md)
- 测试架构：[testing-architecture.md](/Users/zhangdong/code/websdk2/docs/testing/testing-architecture.md)
- 测试策略：[testing-layered-strategy.md](/Users/zhangdong/code/websdk2/docs/testing/testing-layered-strategy.md)
- 功能规格与方案：`specs/*/spec.md`、`specs/*/plan.md`、`specs/*/tasks.md`

## 技能路由表

| 技能                       | 适用场景                                        | 触发词示例                                                                                  | 文件                                                                                                                             |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `project-onboarding`       | 了解项目、快速上手、新人熟悉工程                | `了解项目`、`项目结构`、`从哪开始`、`先熟悉工程`                                            | [.agent/skills/project-onboarding/SKILL.md](/Users/zhangdong/code/websdk2/.agent/skills/project-onboarding/SKILL.md)             |
| `speckit-feature-workflow` | 写 spec、出 plan、拆 tasks、按 Speckit 流程执行 | `写 spec`、`出 plan`、`拆 tasks`、`按 speckit 来`、`implement`                              | [.agent/skills/speckit-feature-workflow/SKILL.md](/Users/zhangdong/code/websdk2/.agent/skills/speckit-feature-workflow/SKILL.md) |
| `test-layer-enforcer`      | 设计测试方案、补测试、判断测试层                | `补测试`、`测试方案`、`集成测试`、`e2e`、`契约测试`、`类型测试`、`门禁`                     | [.agent/skills/test-layer-enforcer/SKILL.md](/Users/zhangdong/code/websdk2/.agent/skills/test-layer-enforcer/SKILL.md)           |
| `real-env-test-runner`     | 判断真实环境测试、联调与环境变量问题            | `真实环境测试`、`联调`、`real env`、`为什么 env 改错还通过`、`e2e 为什么没连真实环境`       | [.agent/skills/real-env-test-runner/SKILL.md](/Users/zhangdong/code/websdk2/.agent/skills/real-env-test-runner/SKILL.md)         |
| `browser-real-env-runner`  | 在宿主浏览器里实际打开 demo、点击、双账号联调   | `在浏览器里跑`、`宿主浏览器联调`、`真实浏览器验证`、`双账号浏览器验证`、`帮我在浏览器里操作` | [.agent/skills/browser-real-env-runner/SKILL.md](/Users/zhangdong/code/websdk2/.agent/skills/browser-real-env-runner/SKILL.md)   |
| `test-command-runner`      | 执行单测、集成测试、覆盖率与测试门禁            | `跑单测`、`跑集成测试`、`出覆盖率`、`跑门禁`、`跑 pr gate`、`跑 nightly`、`跑 release gate` | [.agent/skills/test-command-runner/SKILL.md](/Users/zhangdong/code/websdk2/.agent/skills/test-command-runner/SKILL.md)           |
| `release-change-check`     | 收尾、发版前检查、提交前检查                    | `收尾`、`准备提交`、`提交前检查`、`发版前检查`、`changelog`、`版本号`                       | [.agent/skills/release-change-check/SKILL.md](/Users/zhangdong/code/websdk2/.agent/skills/release-change-check/SKILL.md)         |

路由规则：

- 优先根据触发词匹配上表对应 skill
- 如果多个 skill 同时命中，按“项目理解 -> Speckit 流程 -> 测试约束 -> 真实环境判断 -> 测试执行 -> 收尾检查”的顺序组合使用
- 命中任意 `.agent/skills/*` 后，先用一句短话显式提示已命中的 skill 名称，例如：`本次命中 skill: test-command-runner`









## WebSDK2 开发指南

自动从所有功能计划生成。最后更新：2026-04-28

## 当前技术栈
- 语言/版本：TypeScript 5.x（strict）；TypeScript 5.x（strict）+ 微信小程序原生 TypeScript 配置；TypeScript 5.x  Node.js 脚本；TypeScript 5.0+（strict）；TypeScript 5.x
- 主要依赖：现有 ChatClient、Manager 注册体系、CacheManager、EventHub、RestClient、PushManager、MSync protobuf 编解码链路、Vitest、Vite、Playwright；现有 UserInfoManager、ContactManager、RestClient、CacheManager、EventHub、MSync protobuf 编解码、Vitest、Vite、eslint；现有 GroupManager / Group 公开 API、RestClient、CacheManager、UserInfoManager、EventHub、MSync protobuf 编解码、Vitest、Vite、eslint；zod、vitest、vite、eslint、现有 RestClient、CacheManager、EventHub、UserInfoManager、GroupManager、MSync protobuf 编解码
- 存储方案：继续复用 localStorage conversation cache；本期升级会话缓存 schema、会话类型 canonical naming 与增量字段（marks / 扩展 source 语义）；不新增新的持久化介质；localStorage 继续只保存 UserInfoSummary 摘要缓存；新增的完整资料真相保持会话级内存态；联系人快照继续复用现有 ContactCache / CacheManager；不新增持久化介质；group 域内部运行时真相保持会话级内存态；用户资料缓存继续复用现有 localStorage CacheManager / UserInfoCache 摘要缓存；继续复用现有 localStorage CacheManager；用户资料缓存扩展版本元数据；新增群名片独立缓存键与缓存类；不引入新的持久化介质；不新增持久化；继续沿用现有消息、上传、缓存链路；Message.channel 结构不变
- 项目形态：单仓库 SDK 库项目（src/、tests/、demo/）；单仓库 SDK 库项目（src/  tests/）；单仓库 SDK 库项目  平级小程序 demo 工程；单仓库 SDK 库项目（src/  tests/  demo/）

## 项目结构

```text
.cursor/
.specify/
docs/
specs/
src/
tests/
demo/
scripts/
```

## 常用命令
- `npm run test:run`
- `npm run lint`
- `npm run type-check`
- `npm run test:coverage`
- `npm run test:gate:pr`
- `npm run test:e2e`
- `npm run docs:api:check`

## 代码风格
- TypeScript strict 模式，禁止 `any`，公共 API 优先使用 `interface`
- 所有函数与方法显式声明返回类型，异步逻辑优先使用 `async/await + try/catch`
- 优先命名导出，类型导入使用 `import type`，格式化遵循 Prettier 配置

## 最近更新
- 034-conversation-rest-api（2026-04-28）：补充 TypeScript 5.x（strict） + 现有 ChatClient、Manager 注册体系、CacheManager、EventHub、RestClient、PushManager、MSync protobuf 编解码链路、Vitest、Vite、Playwright；存储：继续复用 localStorage conversation cache；本期升级会话缓存 schema、会话类型 canonical naming 与增量字段（marks / 扩展 source 语义）
- 033-user-info-subscription（2026-04-23）：补充 TypeScript 5.x（strict） + 现有 UserInfoManager、ContactManager、RestClient、CacheManager、EventHub、MSync protobuf 编解码、Vitest、Vite、eslint；存储：不新增新的持久化介质；localStorage 继续只保存 UserInfoSummary 摘要缓存；新增的完整资料真相保持会话级内存态；联系人快照继续复用现有 ContactCache / CacheManager
- 032-group-internal-oo-pilot（2026-04-22）：补充 TypeScript 5.x（strict） + 现有 GroupManager / Group 公开 API、RestClient、CacheManager、UserInfoManager、EventHub、MSync protobuf 编解码、Vitest、Vite、eslint；存储：不新增持久化介质；group 域内部运行时真相保持会话级内存态；用户资料缓存继续复用现有 localStorage CacheManager / UserInfoCache 摘要缓存

<!-- 手动补充开始 -->
<!-- 手动补充结束 -->

## 当前活跃技术
- 存储：[如适用，例如 PostgreSQL、CoreData、文件或 N/A]（001-im-sdk-refactor）
- TypeScript 5.x + Vite 5、Vitest、Zod、RestClient（内部）（002-chatclient-mvp）
- 存储：N/A（002-chatclient-mvp）
- TypeScript 5.x + Zod（参数校验）、Vitest（单元测试）（003-message-create）
- TypeScript 5.x + Vitest（004-event-system）
- TypeScript 5.x（005-error-handling）
- 方案摘要：对齐原工程私有协议，使用 protobuf 编码/解码与 WebSocket 收发消息。实现登录 provision 握手、消息发送/ACK/接收流程，并在重构过程中拆解 mSync 编解码逻辑，使结构更清晰、可维护。附件上传与消息去重暂不实现。（006-protobuf-ws）
- 方案摘要：为附件类消息增加上传流程，按照文件大小选择简单上传或分片上传，上传成功后补齐消息体再发送。保持与原工程上传行为一致，错误处理接入 005 规范。（007-file-upload）
- 方案摘要：将附件消息的 data 字段从对外 MessageBody 中移除，改为发送阶段的内部缓存。创建消息时把文件对象写入缓存并生成本地 URL；发送时从缓存读取文件进行上传，并在发送成功/失败后清理缓存。（008-attachment-data-cache）
- 方案摘要：在 ChatClient 上提供管理器注册能力，主入口为 use(Manager)，辅入口为 init({ managers })。use 返回带管理器属性的扩展类型；init 支持构造器或实例并自动绑定。管理器需声明唯一 key 并提供 bind(client)。（009-manager-usage）
- 方案摘要：新增 ChannelManager 作为唯一入口，负责创建、列表与查询 Channel 实例。Channel 实例作为 ChannelManager 的产物，提供创建消息与发送消息语法糖，底层复用 ChatClient 现有能力。（010-channel-module）
- 方案摘要：在 ChatClient.init 初始化配置中新增连接与设备相关参数，覆盖 HttpDNS、设备标识、服务地址、内容替换策略、自动登录与版本上报能力，并与旧工程行为保持一致。（011-chatclient-init-params）
- TypeScript 5.0+（strict） + zod、protobufjs、vitest、vite、eslint（012-log-report）
- 存储：N/A（内存日志缓冲）（012-log-report）
- TypeScript 5.x（strict） + zod、protobufjs、vitest、vite、eslint（013-websocket-reconnect）
- 存储：N/A（连接状态与重连计数仅内存态）（013-websocket-reconnect）
- TypeScript 5.0+（strict） + zod、protobufjs、vitest、vite、eslint（014-local-cache-module）
- 存储：localStorage（浏览器端）（014-local-cache-module）
- TypeScript 5.x（strict） + Vite 5、Rollup（Vite 内置）、TypeScript、Vitest（015-manager-exports）
- 存储：N/A（015-manager-exports）
- 方案摘要：基于 specs/016-presence-manager/spec.md 与旧工程 presenceApi.ts 实现 PresenceManager（不新建分支）（016-presence-manager）
- TypeScript 5.x（strict） + Vitest；src/protocol/msync/proto.ts / src/protocol/msync/codec.ts（017-message-extra-fields）
- TypeScript 5.x（strict） + zod、protobufjs/minimal、vitest、vite、eslint（018-cross-platform-adapter）
- 存储：Web 默认 localStorage（后续通过 StorageAdapter 扩展到小程序/RN）（018-cross-platform-adapter）
- TypeScript 5.x（strict） + zod、protobufjs/minimal、vitest、vite、eslint（019-combine-message）
- 存储：N/A（沿用现有消息缓存与附件资源访问模型）（019-combine-message）
- TypeScript 5.x（strict） + zod、protobufjs/minimal、vitest、vite、eslint（020-stream-message）
- 存储：N/A（内存流缓存会话，不引入持久化）（020-stream-message）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient 与错误映射模块（021-push-manager）
- 存储：N/A（仅 REST 读写，不引入本地持久化）（021-push-manager）
- TypeScript 5.x  Node.js 脚本 + TypeDoc 0.27+、现有 TypeScript 编译配置（022-typedoc-api-site）
- 存储：N/A（静态文件产物）（022-typedoc-api-site）
- TypeScript 5.x（strict） + vitest、@vitest/coverage-v8、Playwright（E2E）、现有 CoreSDK/EventHub/协议编解码模块（023-test-layer-strategy）
- 存储：N/A（不引入业务持久化，仅依赖测试环境数据与测试日志产物）（023-test-layer-strategy）
- TypeScript 5.x（strict） + zod、protobufjs、long、vitest、vite、eslint（024-contact-sync）
- 存储：localStorage（沿用现有 CacheManager；联系人关系缓存新增独立 key，用户资料缓存复用现有 userInfoMap，以 cacheIntegrity 标记冷启动可用性）（024-contact-sync）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient、CacheManager、EventHub、MSync protobuf 编解码、024 联系人同步控制器与错误映射模块（025-contact-manager-api）
- 存储：联系人关系缓存沿用 localStorage（ContactCache / CacheManager）；黑名单仅维护会话级内存快照，不新增持久化（025-contact-manager-api）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient、CacheManager、ChatClient manager 注册体系、统一错误模型、结构化日志模块（026-user-info-manager-api）
- 存储：用户资料缓存继续复用现有 localStorage CacheManager / UserInfoCache；不新增新的持久化介质（026-user-info-manager-api）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient、CacheManager、EventHub、UserInfoManager、MSync protobuf 编解码、现有上传下载适配层（027-group-manager-api）
- 存储：群组域不新增持久化介质；用户资料继续复用现有 localStorage CacheManager / UserInfoCache 摘要缓存；群组列表/成员/黑名单/allowlist/禁言列表等默认保持会话级内存态（027-group-manager-api）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient、CacheManager、EventHub、UserInfoManager、MSync protobuf 编解码、现有下载/文件删除适配能力（028-chatroom-manager-api）
- 存储：聊天室域不新增持久化介质；用户资料继续复用 localStorage CacheManager / UserInfoCache 摘要缓存；聊天室列表、成员、管理员、黑名单、allowlist、禁言列表与属性快照默认保持会话级内存态（028-chatroom-manager-api）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 AttachmentUploader / UploadAdapter、现有 MSync protobuf 编解码、现有平台适配层（029-image-attachment-upload-optimization）
- 存储：不新增持久化；本地附件继续复用 attachmentFileStore；图片预处理结果保持发送会话级内存态（029-image-attachment-upload-optimization）
- TypeScript 5.x（strict）+ 微信小程序原生 TypeScript 配置 + 现有 ChatClient / create*Message API、platformAdapterOptions、MiniAppFile / CompatibleFile 类型、Vitest、Vite 构建产物、微信小程序原生 wx.* 能力（030-wechat-miniapp-demo）
- 存储：demo 页面状态与日志保存在页面内存；SDK 缓存维持当前实现，在小程序环境下允许降级为不可用，不新增持久化介质（030-wechat-miniapp-demo）
- TypeScript 5.x（strict） + 现有 ChatClient、Manager 注册体系、EventHub、消息创建模块、Vitest、Vite、Playwright、现有上传/协议编解码链路（031-chat-manager-replace-channel）
- 存储：不新增持久化；继续沿用现有消息、上传、缓存链路；Message.channel 结构不变（031-chat-manager-replace-channel）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient、CacheManager、EventHub、UserInfoManager、GroupManager、MSync protobuf 编解码（031-message-profile-sync）
- 存储：继续复用现有 localStorage CacheManager；用户资料缓存扩展版本元数据；新增群名片独立缓存键与缓存类；不引入新的持久化介质（031-message-profile-sync）
- TypeScript 5.x（strict） + 现有 GroupManager / Group 公开 API、RestClient、CacheManager、UserInfoManager、EventHub、MSync protobuf 编解码、Vitest、Vite、eslint（032-group-internal-oo-pilot）
- 存储：不新增持久化介质；group 域内部运行时真相保持会话级内存态；用户资料缓存继续复用现有 localStorage CacheManager / UserInfoCache 摘要缓存（032-group-internal-oo-pilot）
- TypeScript 5.x（strict） + 现有 UserInfoManager、ContactManager、RestClient、CacheManager、EventHub、MSync protobuf 编解码、Vitest、Vite、eslint（033-user-info-subscription）
- 存储：不新增新的持久化介质；localStorage 继续只保存 UserInfoSummary 摘要缓存；新增的完整资料真相保持会话级内存态；联系人快照继续复用现有 ContactCache / CacheManager（033-user-info-subscription）
- TypeScript 5.x（strict） + 现有 ChatClient、Manager 注册体系、CacheManager、EventHub、RestClient、PushManager、MSync protobuf 编解码链路、Vitest、Vite、Playwright（034-conversation-rest-api）
- 存储：继续复用 localStorage conversation cache；本期升级会话缓存 schema、会话类型 canonical naming 与增量字段（marks / 扩展 source 语义）（034-conversation-rest-api）

## 最近变更
- 034-conversation-rest-api（2026-04-28）：更新 语言/版本：TypeScript 5.x（strict）；主要依赖：现有 ChatClient、Manager 注册体系、CacheManager、EventHub、RestClient、PushManager、MSync protobuf 编解码链路、Vitest、Vite、Playwright；存储：继续复用 localStorage conversation cache；本期升级会话缓存 schema、会话类型 canonical naming 与增量字段（marks / 扩展 source 语义）
- 033-user-info-subscription（2026-04-23）：更新 语言/版本：TypeScript 5.x（strict）；主要依赖：现有 UserInfoManager、ContactManager、RestClient、CacheManager、EventHub、MSync protobuf 编解码、Vitest、Vite、eslint；存储：不新增新的持久化介质；localStorage 继续只保存 UserInfoSummary 摘要缓存；新增的完整资料真相保持会话级内存态；联系人快照继续复用现有 ContactCache / CacheManager
- 032-group-internal-oo-pilot（2026-04-22）：更新 语言/版本：TypeScript 5.x（strict）；主要依赖：现有 GroupManager / Group 公开 API、RestClient、CacheManager、UserInfoManager、EventHub、MSync protobuf 编解码、Vitest、Vite、eslint；存储：不新增持久化介质；group 域内部运行时真相保持会话级内存态；用户资料缓存继续复用现有 localStorage CacheManager / UserInfoCache 摘要缓存
- 031-message-profile-sync（2026-04-20）：更新 语言/版本：TypeScript 5.x（strict）；主要依赖：zod、vitest、vite、eslint、现有 RestClient、CacheManager、EventHub、UserInfoManager、GroupManager、MSync protobuf 编解码；存储：继续复用现有 localStorage CacheManager；用户资料缓存扩展版本元数据；新增群名片独立缓存键与缓存类；不引入新的持久化介质
- 031-chat-manager-replace-channel（2026-04-22）：更新 语言/版本：TypeScript 5.x（strict）；主要依赖：现有 ChatClient、Manager 注册体系、EventHub、消息创建模块、Vitest、Vite、Playwright、现有上传/协议编解码链路；存储：不新增持久化；继续沿用现有消息、上传、缓存链路；Message.channel 结构不变






## websdk2 开发指南

自动从所有功能计划生成。最后更新：2026-06-01

## 当前技术栈
- 语言/版本：TypeScript 5.x（strict）；TypeScript 5.x（strict）  Node.js CLI；TypeScript 5.x（strict）+ 微信小程序原生 TypeScript 配置；TypeScript 5.x  Node.js 脚本；TypeScript 5.0+（strict）
- 主要依赖：现有 ChatClient、GroupManager、ContactManager、CacheManager、EventHub、SyncTransportClient、GroupRepository、MSync MUC 事件链路、protobufjs/light 静态编解码适配层、zod、Vitest、Vite、Playwright；现有 ChatClient、Manager 注册体系、CoreSDK、MessageReceiver、EventHub、CacheManager、RestClient、MSync codec/proto、Vitest、Vite、Playwright、现有小程序平台适配与 demo/fixture；现有 ChatClient、ChatManager、MessageReceiver、MessageSender、StreamMessageHandler、EventHub、MSync codec/proto、Vitest、Vite、Playwright；现有 ChatClient、CoreSDK、MessageReceiver、EventHub、MSync codec/proto、ContactManager、GroupManager、ChatThreadManager、ChatManager、Vitest、Vite、Playwright
- 存储方案：localStorage（沿用 CacheManager；仅新增 joined-groups 预览缓存，最多 100 个轻量群组和预览/受限元数据；当前登录会话内 GroupRepository 保存本轮同步到的最多 3000 个群；不新增持久化介质，不持久化完整 3000 群列表）；不新增持久化；继续复用现有 localStorage/CacheManager；本期只调整能力归属、事件处理和构建验证，不改变消息、联系人、用户资料、群组或聊天室缓存 schema；N/A；本功能只调整事件类型与事件分发，不新增持久化，不改变消息、会话或缓存 schema；N/A；本功能只派发事件，不新增持久化，不改变现有联系人/群组/会话/消息缓存所有权；N/A（纯测试代码，不引入持久化）
- 项目形态：单仓库 SDK 库项目（src/、tests/、demo/、specs/）；单仓库 SDK 库项目（src/、tests/、specs/、docs/、demo/、scripts/）；单仓库 SDK 库项目（src/、tests/、specs/、docs/）；单仓库 SDK 项目内的测试子目录

## 项目结构

```text
.cursor/
.specify/
docs/
specs/
src/
tests/
demo/
scripts/
```

## 常用命令
- `npm run test:run`
- `npm run lint`
- `npm run type-check`
- `npm run test:coverage`
- `npm run test:gate:pr`
- `npm run test:e2e`
- `npm run docs:api:check`

## 代码风格
- TypeScript strict 模式，禁止 `any`，公共 API 优先使用 `interface`
- 所有函数与方法显式声明返回类型，异步逻辑优先使用 `async/await + try/catch`
- 优先命名导出，类型导入使用 `import type`，格式化遵循 Prettier 配置

## 最近更新
- 045-group-auto-sync（2026-06-01）：补充 TypeScript 5.x（strict） + 现有 ChatClient、GroupManager、ContactManager、CacheManager、EventHub、SyncTransportClient、GroupRepository、MSync MUC 事件链路、protobufjs/light 静态编解码适配层、zod、Vitest、Vite、Playwright；存储：localStorage（沿用 CacheManager；仅新增 joined-groups 预览缓存，最多 100 个轻量群组和预览/受限元数据；当前登录会话内 GroupRepository 保存本轮同步到的最多 3000 个群；不新增持久化介质，不持久化完整 3000 群列表）
- 044-tree-shaking-optimization（2026-05-28）：补充 TypeScript 5.x（strict） + 现有 ChatClient、Manager 注册体系、CoreSDK、MessageReceiver、EventHub、CacheManager、RestClient、MSync codec/proto、Vitest、Vite、Playwright、现有小程序平台适配与 demo/fixture；存储：不新增持久化；继续复用现有 localStorage/CacheManager；本期只调整能力归属、事件处理和构建验证，不改变消息、联系人、用户资料、群组或聊天室缓存 schema
- 043-chat-manager-event-cleanup（2026-05-25）：补充 TypeScript 5.x（strict） + 现有 ChatClient、ChatManager、MessageReceiver、MessageSender、StreamMessageHandler、EventHub、MSync codec/proto、Vitest、Vite、Playwright；存储：N/A；本功能只调整事件类型与事件分发，不新增持久化，不改变消息、会话或缓存 schema

<!-- 手动补充开始 -->
<!-- 手动补充结束 -->

## 当前活跃技术
- 存储：[如适用，例如 PostgreSQL、CoreData、文件或 N/A]（001-im-sdk-refactor）
- TypeScript 5.x + Vite 5、Vitest、Zod、RestClient（内部）（002-chatclient-mvp）
- 存储：N/A（002-chatclient-mvp）
- TypeScript 5.x + Zod（参数校验）、Vitest（单元测试）（003-message-create）
- TypeScript 5.x + Vitest（004-event-system）
- TypeScript 5.x（005-error-handling）
- 方案摘要：对齐原工程私有协议，使用 protobuf 编码/解码与 WebSocket 收发消息。实现登录 provision 握手、消息发送/ACK/接收流程，并在重构过程中拆解 mSync 编解码逻辑，使结构更清晰、可维护。附件上传与消息去重暂不实现。（006-protobuf-ws）
- 方案摘要：为附件类消息增加上传流程，按照文件大小选择简单上传或分片上传，上传成功后补齐消息体再发送。保持与原工程上传行为一致，错误处理接入 005 规范。（007-file-upload）
- 方案摘要：将附件消息的 data 字段从对外 MessageBody 中移除，改为发送阶段的内部缓存。创建消息时把文件对象写入缓存并生成本地 URL；发送时从缓存读取文件进行上传，并在发送成功/失败后清理缓存。（008-attachment-data-cache）
- 方案摘要：在 ChatClient 上提供管理器注册能力，主入口为 use(Manager)，辅入口为 init({ managers })。use 返回带管理器属性的扩展类型；init 支持构造器或实例并自动绑定。管理器需声明唯一 key 并提供 bind(client)。（009-manager-usage）
- 方案摘要：新增 ChannelManager 作为唯一入口，负责创建、列表与查询 Channel 实例。Channel 实例作为 ChannelManager 的产物，提供创建消息与发送消息语法糖，底层复用 ChatClient 现有能力。（010-channel-module）
- 方案摘要：在 ChatClient.init 初始化配置中新增连接与设备相关参数，覆盖 DNS_CONFIG 地址发现、固定服务地址直连、设备标识、内容替换策略、自动登录与版本上报能力，并与旧工程行为保持一致。（011-chatclient-init-params）
- TypeScript 5.0+（strict） + zod、protobufjs、vitest、vite、eslint（012-log-report）
- 存储：N/A（内存日志缓冲）（012-log-report）
- TypeScript 5.x（strict） + zod、protobufjs、vitest、vite、eslint（013-websocket-reconnect）
- 存储：N/A（连接状态与重连计数仅内存态）（013-websocket-reconnect）
- TypeScript 5.0+（strict） + zod、protobufjs、vitest、vite、eslint（014-local-cache-module）
- 存储：localStorage（浏览器端）（014-local-cache-module）
- TypeScript 5.x（strict） + Vite 5、Rollup（Vite 内置）、TypeScript、Vitest（015-manager-exports）
- 存储：N/A（015-manager-exports）
- 方案摘要：基于 specs/016-presence-manager/spec.md 与旧工程 presenceApi.ts 实现 PresenceManager（不新建分支）（016-presence-manager）
- TypeScript 5.x（strict） + Vitest；src/protocol/msync/proto.ts / src/protocol/msync/codec.ts（017-message-extra-fields）
- TypeScript 5.x（strict） + zod、protobufjs/minimal、vitest、vite、eslint（018-cross-platform-adapter）
- 存储：Web 默认 localStorage（后续通过 StorageAdapter 扩展到小程序/RN）（018-cross-platform-adapter）
- TypeScript 5.x（strict） + zod、protobufjs/minimal、vitest、vite、eslint（019-combine-message）
- 存储：N/A（沿用现有消息缓存与附件资源访问模型）（019-combine-message）
- TypeScript 5.x（strict） + zod、protobufjs/minimal、vitest、vite、eslint（020-stream-message）
- 存储：N/A（内存流缓存会话，不引入持久化）（020-stream-message）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient 与错误映射模块（021-push-manager）
- 存储：N/A（仅 REST 读写，不引入本地持久化）（021-push-manager）
- TypeScript 5.x  Node.js 脚本 + TypeDoc 0.27+、现有 TypeScript 编译配置（022-typedoc-api-site）
- 存储：N/A（静态文件产物）（022-typedoc-api-site）
- TypeScript 5.x（strict） + vitest、@vitest/coverage-v8、Playwright（E2E）、现有 CoreSDK/EventHub/协议编解码模块（023-test-layer-strategy）
- 存储：N/A（不引入业务持久化，仅依赖测试环境数据与测试日志产物）（023-test-layer-strategy）
- TypeScript 5.x（strict） + zod、protobufjs、long、vitest、vite、eslint（024-contact-sync）
- 存储：localStorage（沿用现有 CacheManager；联系人关系缓存新增独立 key，用户资料缓存复用现有 userInfoMap，以 cacheIntegrity 标记冷启动可用性）（024-contact-sync）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient、CacheManager、EventHub、MSync protobuf 编解码、024 联系人同步控制器与错误映射模块（025-contact-manager-api）
- 存储：联系人关系缓存沿用 localStorage（ContactCache / CacheManager）；黑名单仅维护会话级内存快照，不新增持久化（025-contact-manager-api）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient、CacheManager、ChatClient manager 注册体系、统一错误模型、结构化日志模块（026-user-info-manager-api）
- 存储：用户资料缓存继续复用现有 localStorage CacheManager / UserInfoCache；不新增新的持久化介质（026-user-info-manager-api）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient、CacheManager、EventHub、UserInfoManager、MSync protobuf 编解码、现有上传下载适配层（027-group-manager-api）
- 存储：群组域不新增持久化介质；用户资料继续复用现有 localStorage CacheManager / UserInfoCache 摘要缓存；群组列表/成员/黑名单/allowlist/禁言列表等默认保持会话级内存态（027-group-manager-api）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient、CacheManager、EventHub、UserInfoManager、MSync protobuf 编解码、现有下载/文件删除适配能力（028-chatroom-manager-api）
- 存储：聊天室域不新增持久化介质；用户资料继续复用 localStorage CacheManager / UserInfoCache 摘要缓存；聊天室列表、成员、管理员、黑名单、allowlist、禁言列表与属性快照默认保持会话级内存态（028-chatroom-manager-api）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 AttachmentUploader / UploadAdapter、现有 MSync protobuf 编解码、现有平台适配层（029-image-attachment-upload-optimization）
- 存储：不新增持久化；本地附件继续复用 attachmentFileStore；图片预处理结果保持发送会话级内存态（029-image-attachment-upload-optimization）
- TypeScript 5.x（strict）+ 微信小程序原生 TypeScript 配置 + 现有 ChatClient / create*Message API、SDK 内置平台适配器、MiniAppFile / CompatibleFile 类型、Vitest、Vite 构建产物、微信小程序原生 wx.* 能力（030-wechat-miniapp-demo）
- 存储：demo 页面状态与日志保存在页面内存；SDK 缓存维持当前实现，在小程序环境下允许降级为不可用，不新增持久化介质（030-wechat-miniapp-demo）
- TypeScript 5.x（strict） + 现有 ChatClient、Manager 注册体系、EventHub、消息创建模块、消息发送/接收链路、RestClient、现有合并消息下载解析器、Vitest、Vite、Playwright（031-chat-manager-replace-channel）
- 存储：不新增持久化；继续沿用现有消息、上传、缓存与合并消息链路；公开消息定位以 conversationId/conversationType 为准（031-chat-manager-replace-channel）
- TypeScript 5.x（strict） + zod、vitest、vite、eslint、现有 RestClient、CacheManager、EventHub、UserInfoManager、GroupManager、MSync protobuf 编解码（031-message-profile-sync）
- 存储：继续复用现有 localStorage CacheManager；用户资料缓存扩展版本元数据；新增群名片独立缓存键与缓存类；不引入新的持久化介质（031-message-profile-sync）
- TypeScript 5.x（strict） + 现有 GroupManager / Group 公开 API、RestClient、CacheManager、UserInfoManager、EventHub、MSync protobuf 编解码、Vitest、Vite、eslint（032-group-internal-oo-pilot）
- 存储：不新增持久化介质；group 域内部运行时真相保持会话级内存态；用户资料缓存继续复用现有 localStorage CacheManager / UserInfoCache 摘要缓存（032-group-internal-oo-pilot）
- TypeScript 5.x（strict） + 现有 UserInfoManager、ContactManager、RestClient、CacheManager、EventHub、MSync protobuf 编解码、Vitest、Vite、eslint（033-user-info-subscription）
- 存储：不新增新的持久化介质；localStorage 继续只保存 UserInfoSummary 摘要缓存；新增的完整资料真相保持会话级内存态；联系人快照继续复用现有 ContactCache / CacheManager（033-user-info-subscription）
- TypeScript 5.x（strict） + 现有 ChatClient、Manager 注册体系、CacheManager、EventHub、RestClient、PushManager、MSync protobuf 编解码链路、Vitest、Vite、Playwright（034-conversation-rest-api）
- 存储：继续复用 localStorage conversation cache；本期升级会话缓存 schema、会话类型 canonical naming 与增量字段（marks / 扩展 source 语义）（034-conversation-rest-api）
- TypeScript 5.x（strict） + 现有 ChatClient、ChatManager、CacheManager、EventHub、024-contact-sync 的 WSS transport 思路、MSync protobuf 编解码链路、protobufjs/light 静态编解码适配层、Vitest、Vite、Playwright（035-session-list-sync）
- 存储：新增 session-list 专用 schema/key；旧 conversation cache 继续保留供旧会话列表逻辑使用；session-list checkpoint 单独持久化 sessions_last_sync_ts（035-session-list-sync）
- TypeScript 5.x（strict） + 现有 ChatClient、ChatManager、RestClient、当前 SDK2 上传能力（含 src/platform/upload 等现有实现）、CacheManager、EventHub、Vitest、Vite、Playwright（036-voice-to-text）
- 存储：N/A（本特性不新增持久化；仅读取现有消息列表用于 demo 展示）（036-voice-to-text）
- TypeScript 5.x（strict） + 现有 ChatClient、ChatManager、消息创建模块、zod 校验器、MessageSender / MessageReceiver、MSync protobuf 编解码、AttachmentUploader、CacheManager、EventHub、profile sync 队列、Vitest、Vite、Playwright（037-message-conversation-fields）
- 存储：不新增持久化；conversation cache 继续使用现有 localStorage 机制，但消息驱动的会话摘要输入从 message.channel 改为 message.conversationId/conversationType（037-message-conversation-fields）
- TypeScript 5.x（strict）  Node.js CLI + 现有 TypeScript/Vitest/eslint；Node.js fs/path/process；尽量避免引入重 CLI 框架（038-ai-skill-distribution）
- 存储：用户项目本地文件系统；安装 manifest 以 JSON 文件形式落盘（038-ai-skill-distribution）
- TypeScript 5.x（strict） + 现有 ChatClient、CoreSDK、ConnectionManager、EventHub、RestClient、MSync codec、zod/Validator、Vitest、Vite、eslint（039-chatclient-token-rtc）
- 存储：N/A；本功能只维护当前登录会话内 token 生命周期状态和计时器，不新增持久化（039-chatclient-token-rtc）
- TypeScript 5.x（strict） + 现有 ChatClient、ChatManager、消息创建模块、zod 校验器、MSync protobuf 编解码、Vitest、Vite、eslint（040-message-meta-env）
- 存储：N/A；本功能不新增持久化，也不改现有缓存结构（040-message-meta-env）
- TypeScript 5.x（strict） + Playwright、真实 demo 页面、ChatClient、ContactManager、GroupManager、ChatRoomManager、PresenceManager、ChatManager、浏览器上下文隔离（041-real-env-robot-migration）
- 存储：N/A（纯测试代码，不引入持久化）（041-real-env-robot-migration）
- TypeScript 5.x（strict） + 现有 ChatClient、CoreSDK、MessageReceiver、EventHub、MSync codec/proto、ContactManager、GroupManager、ChatThreadManager、ChatManager、Vitest、Vite、Playwright（042-multi-device-listener）
- 存储：N/A；本功能只派发事件，不新增持久化，不改变现有联系人/群组/会话/消息缓存所有权（042-multi-device-listener）
- TypeScript 5.x（strict） + 现有 ChatClient、ChatManager、MessageReceiver、MessageSender、StreamMessageHandler、EventHub、MSync codec/proto、Vitest、Vite、Playwright（043-chat-manager-event-cleanup）
- 存储：N/A；本功能只调整事件类型与事件分发，不新增持久化，不改变消息、会话或缓存 schema（043-chat-manager-event-cleanup）
- TypeScript 5.x（strict） + 现有 ChatClient、Manager 注册体系、CoreSDK、MessageReceiver、EventHub、CacheManager、RestClient、MSync codec/proto、Vitest、Vite、Playwright、现有小程序平台适配与 demo/fixture（044-tree-shaking-optimization）
- 存储：不新增持久化；继续复用现有 localStorage/CacheManager；本期只调整能力归属、事件处理和构建验证，不改变消息、联系人、用户资料、群组或聊天室缓存 schema（044-tree-shaking-optimization）
- TypeScript 5.x（strict） + 现有 ChatClient、GroupManager、ContactManager、CacheManager、EventHub、SyncTransportClient、GroupRepository、MSync MUC 事件链路、protobufjs/light 静态编解码适配层、zod、Vitest、Vite、Playwright（045-group-auto-sync）
- 存储：localStorage（沿用 CacheManager；仅新增 joined-groups 预览缓存，最多 100 个轻量群组和预览/受限元数据；当前登录会话内 GroupRepository 保存本轮同步到的最多 3000 个群；不新增持久化介质，不持久化完整 3000 群列表）（045-group-auto-sync）

## 最近变更
- 045-group-auto-sync（2026-06-01）：更新 语言/版本：TypeScript 5.x（strict）；主要依赖：现有 ChatClient、GroupManager、ContactManager、CacheManager、EventHub、SyncTransportClient、GroupRepository、MSync MUC 事件链路、protobufjs/light 静态编解码适配层、zod、Vitest、Vite、Playwright；存储：localStorage（沿用 CacheManager；仅新增 joined-groups 预览缓存，最多 100 个轻量群组和预览/受限元数据；当前登录会话内 GroupRepository 保存本轮同步到的最多 3000 个群；不新增持久化介质，不持久化完整 3000 群列表）
- 044-tree-shaking-optimization（2026-05-28）：更新 语言/版本：TypeScript 5.x（strict）；主要依赖：现有 ChatClient、Manager 注册体系、CoreSDK、MessageReceiver、EventHub、CacheManager、RestClient、MSync codec/proto、Vitest、Vite、Playwright、现有小程序平台适配与 demo/fixture；存储：不新增持久化；继续复用现有 localStorage/CacheManager；本期只调整能力归属、事件处理和构建验证，不改变消息、联系人、用户资料、群组或聊天室缓存 schema
- 043-chat-manager-event-cleanup（2026-05-25）：更新 语言/版本：TypeScript 5.x（strict）；主要依赖：现有 ChatClient、ChatManager、MessageReceiver、MessageSender、StreamMessageHandler、EventHub、MSync codec/proto、Vitest、Vite、Playwright；存储：N/A；本功能只调整事件类型与事件分发，不新增持久化，不改变消息、会话或缓存 schema
- 042-multi-device-listener（2026-05-22）：更新 语言/版本：TypeScript 5.x（strict）；主要依赖：现有 ChatClient、CoreSDK、MessageReceiver、EventHub、MSync codec/proto、ContactManager、GroupManager、ChatThreadManager、ChatManager、Vitest、Vite、Playwright；存储：N/A；本功能只派发事件，不新增持久化，不改变现有联系人/群组/会话/消息缓存所有权
- 041-real-env-robot-migration（2026-05-21）：更新 语言/版本：TypeScript 5.x（strict）；主要依赖：Playwright、真实 demo 页面、ChatClient、ContactManager、GroupManager、ChatRoomManager、PresenceManager、ChatManager、浏览器上下文隔离；存储：N/A（纯测试代码，不引入持久化）
