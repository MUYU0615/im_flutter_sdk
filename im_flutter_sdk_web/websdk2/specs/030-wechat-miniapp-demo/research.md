# Research: 微信小程序 Demo

## Decision 1: 使用原生微信小程序单页 demo，而不是引入新的跨端框架

- **Decision**: 新增独立的 `miniprogram-demo/` 原生微信小程序工程，使用单页承载初始化、登录、发送消息和日志四个区域。
- **Rationale**: 用户明确要求“再创建一个微信小程序的 demo，和现在的 demo 目录平级”；仓库当前没有现成的 Taro / uni-app 基础设施，直接引入新框架会显著扩大范围并增加工具链风险。
- **Alternatives considered**:
  - 引入 Taro：可复用 React 经验，但需要新增框架、编译链和额外依赖，不符合最小交付目标。
  - 引入 uni-app：跨端扩展性更强，但当前需求只针对微信小程序，额外抽象收益不足。
  - 继续扩展现有 Web demo：无法在微信开发者工具中直接验证真实小程序运行时。

## Decision 2: 小程序 demo 默认使用 build 后的 SDK 产物

- **Decision**: 小程序 demo 的 SDK 引入策略以根目录 `dist/` 构建产物为第一优先级，通过统一的 `sdk-loader.ts` 封装导入方式。
- **Rationale**: 用户已经明确允许“如果微信小程序 demo 里不能现在这样引用 sdk 源码的话使用 build 之后的 sdk 也行”；微信开发者工具对源码直引、ESM/Node 兼容和仓库路径解析更敏感，优先使用构建产物能降低环境差异带来的风险。
- **Alternatives considered**:
  - 直接引用 `src/`：开发联调更方便，但小程序工具链兼容性不稳定，首发风险高。
  - 引用浏览器 bundle：IIFE 产物不适合当前 TypeScript 小程序工程的模块化接入。

## Decision 3: 初始化固定走 `serviceConfig.serverUrls`，关闭自动联系人同步，避免扩大 SDK 改造面

- **Decision**: 小程序 demo 初始化默认采用固定 `restApiUrl` / `wsUrl`，映射到 `serviceConfig.serverUrls`，并将 `enableAutoSyncContacts` 保持关闭。
- **Rationale**:
  - 规格已明确“初始化可以简单一点不用支持自定义的 dns 地址”。
  - 当前登录主路径在配置 `serviceConfig.serverUrls` 时不需要经过 `resolveDnsConfig()` 或 `RestClient`。
  - 当前联系人同步链路只有在 `enableAutoSyncContacts=true` 时才会触发，因此本特性无需改造 `SyncTransportClient`。
- **Alternatives considered**:
  - 保留 DNS_CONFIG 初始化：会把 DNS 拉取、`RestClient` 适配和更复杂的表单输入一并带入本次实现。
  - 默认开启自动联系人同步：会把联系人同步专用 WebSocket 链路纳入范围，不符合“最小可运行”目标。

## Decision 4: SDK 侧最小必要改造聚焦在 socket 抽象，而不是全面改造所有 Web 依赖

- **Decision**: 本次仅把真正阻塞小程序主路径的连接/发送链路从浏览器原生 `WebSocket` 收口到平台 socket 抽象，改造重点放在 `ConnectionManager`、`HeartbeatManager`、`MessageSender` 和 `CoreSDK`。
- **Rationale**:
  - 当前登录与文本消息发送直接依赖 `new WebSocket()` 和 `WebSocket.OPEN`。
  - 在固定服务地址模式下，小程序 demo 不依赖 `RestClient` 完成初始化/登录主路径。
  - 缓存模块虽然直接依赖 `localStorage`，但当前实现可在缺失时自然降级，不会阻塞 demo 主路径。
- **Alternatives considered**:
  - 顺手改造 `RestClient`、缓存、联系人同步、所有上传 helper：技术上更完整，但超出本次 demo 的必要范围。
  - 不改 SDK，只在 demo 侧做兼容：无法绕过 `ConnectionManager` 和 `MessageSender` 对浏览器 `WebSocket` 的强绑定。

## Decision 5: 附件消息通过 `MiniAppFile` + 小程序适配器走通，图片处理采用“能力优先、失败回退原图”

- **Decision**: 小程序 demo 使用现有 `MiniAppFile` / `CompatibleFile` 类型承载本地素材；通过小程序 `RequestAdapter`、`UploadAdapter` 和 `ImageProcessor` 覆盖附件预检、上传、图片信息读取与 MD5 计算；图片压缩失败时沿用现有上传器中的“回退为原图发送”语义。
- **Rationale**:
  - `create-message.ts` 与 `upload-source.ts` 已支持 `MiniAppFile.path`。
  - 附件上传器在非 Web 源上要求 `uploadAdapter`，并在预检/图片处理阶段依赖 `requestAdapter` 与 `imageProcessor`。
  - 当前上传器已内建“生成大图失败则回退原图”的稳定语义，适合在小程序端复用。
- **Alternatives considered**:
  - 小程序端所有图片强制原图发送：能降低实现复杂度，但会偏离现有 Web demo 的主要发送语义。
  - 完整复刻浏览器图片处理器：会引入更多图形 API 适配，不符合本次最小范围。

## Decision 6: 验收采用“自动化单元/集成 + 手工验证清单”，不新增自动化 E2E

- **Decision**: 本特性不新增仓库自动化 E2E，而是通过单元测试、集成测试和微信开发者工具手工验证清单完成验收。
- **Rationale**:
  - 当前仓库已有的 E2E 基础设施针对浏览器 demo，不直接适用于微信小程序运行容器。
  - 规格已明确 E2E 层以手工验证清单承接。
- **Alternatives considered**:
  - 为微信小程序额外搭建自动化 E2E 基础设施：投入过大，超出本次 demo 的交付范围。
