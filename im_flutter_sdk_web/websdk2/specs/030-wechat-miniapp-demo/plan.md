# 实施方案：微信小程序 Demo

**Branch**: `030-wechat-miniapp-demo` | **Date**: 2026-04-17 | **Spec**: [spec.md](/Users/zhangdong/code/websdk2/specs/030-wechat-miniapp-demo/spec.md)  
**Input**: Feature specification from `/specs/030-wechat-miniapp-demo/spec.md`

## Summary

本特性将新增一个与现有 [`demo`](/Users/zhangdong/code/websdk2/demo) 平级的微信小程序 demo，用于验证 SDK 在微信小程序环境下的三条主路径：初始化、登录/登出、以及 8 类消息发送。方案采用“两段式收口”：第一段只改造真正阻塞小程序主路径的 SDK 入口，把当前强绑定浏览器 `WebSocket` 的连接与发送链路切到既有平台适配抽象；第二段新增 `miniprogram-demo/` 原生小程序工程，由 SDK 内部自动识别小程序运行时并装配 request/socket/upload/runtime/image 适配能力，并使用 `MiniAppFile` 贯通附件消息发送。初始化流程默认走固定 `restApiUrl/wsUrl`，不依赖自定义 DNS；SDK 引入策略优先使用 build 后产物，确保在微信开发者工具中有稳定可运行路径。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）+ 微信小程序原生 TypeScript 配置  
**Primary Dependencies**: 现有 `ChatClient` / `create*Message` API、SDK 内置平台适配器、`MiniAppFile` / `CompatibleFile` 类型、Vitest、Vite 构建产物、微信小程序原生 `wx.*` 能力
**Storage**: demo 页面状态与日志保存在页面内存；SDK 缓存维持当前实现，在小程序环境下允许降级为不可用，不新增持久化介质  
**Testing**: `npm run test:run`、`npm run lint`、`npm run type-check`、必要的 `tests/integration` 补充 + 微信开发者工具手工验证清单  
**Target Platform**: 微信小程序开发者工具；仓库主工程仍保持 Web SDK 单仓库结构  
**Project Type**: 单仓库 SDK 库项目 + 平级小程序 demo 工程  
**Performance Goals**: 初始化、登录、发送链路保持异步非阻塞；demo 页面首屏只承载单页联调能力；附件发送优先复用小程序临时文件路径，避免不必要的中间拷贝  
**Constraints**:
- 必须遵循 TypeScript strict、显式返回类型、命名导出与测试分层要求
- 初始化界面不支持自定义 DNS 地址输入，默认采用固定服务地址模式
- 不破坏现有 Web demo 及现有公开消息创建/发送 API
- 小程序 demo 只覆盖基础接入与发消息主路径，不扩展联系人、群组、聊天室等高级面板
- 当前缓存模块直接依赖 `localStorage`，本特性不扩展缓存跨端重构；小程序环境允许缓存能力降级
- 自动联系人同步默认关闭，避免把联系人同步专用 WebSocket 链路纳入本次最小实现
**Scale/Scope**: 1 个平级小程序 demo、1 套小程序适配器工具、连接/发送链路的最小 SDK 抽象收口、若干单元/集成测试与手工验证文档

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 连接、登录、上传与消息发送继续保持异步非阻塞；demo 采用单页轻量结构，不额外引入重型状态层
- [x] **类型安全**: 小程序适配器、页面状态、消息草稿、连接抽象与契约模型全部使用 TypeScript strict 建模，不引入 `any`
- [x] **测试驱动**: 计划覆盖 demo 纯逻辑、平台适配输入输出、连接发送主路径协作，以及小程序联调清单
- [x] **可靠性**: 通过平台适配器替代浏览器专用 `WebSocket` 依赖，保证登录与发消息在小程序环境下可运行；初始化失败、登录失败、发送失败均有明确反馈
- [x] **可扩展性**: 复用既有 `MiniAppFile`、`UploadAdapter`、`RequestAdapter`、`ImageProcessor` 抽象与 SDK 内部平台识别能力，后续可继续演进到 uni-app / RN
- [x] **可观测性**: demo 保留初始化、登录、发送结果日志；SDK 主链路沿用现有结构化日志
- [x] **版本管理**: 实现完成后必须补版本号、`CHANGELOG.md`，并提交中文 commit

Phase 1 设计复检结果：通过（见 `research.md`、`data-model.md`、`contracts/miniapp-demo.openapi.yaml` 与 `quickstart.md`）。

## Project Structure

### Documentation (this feature)

```text
specs/030-wechat-miniapp-demo/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── miniapp-demo.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── index.ts
│   ├── connection/
│   │   ├── connection-manager.ts
│   │   └── heartbeat.ts
│   └── message/
│       └── message-sender.ts
├── platform/
│   ├── index.ts
│   ├── types.ts
│   └── ...
├── message/
│   └── create-message.ts
├── types/
│   ├── index.ts
│   ├── message-create.ts
│   └── chat-client.ts
└── utils/
    └── message-id.ts

miniprogram-demo/
├── README.md
├── app.json
├── app.ts
├── app.wxss
├── project.config.json
├── typings/
├── utils/
│   ├── sdk-loader.ts
│   ├── platform-adapters.ts
│   ├── message-drafts.ts
│   └── env.ts
└── pages/
    └── index/
        ├── index.json
        ├── index.ts
        ├── index.wxml
        └── index.wxss

tests/
├── unit/
│   └── miniapp-demo/
└── integration/
    └── miniapp-demo/
```

**Structure Decision**: 采用“单仓库 SDK + 平级原生小程序 demo”的结构。SDK 侧只收口连接发送主路径对浏览器 `WebSocket` 的强依赖，不启动更大范围的跨端重构；小程序 demo 作为独立目录管理自身页面、适配器和文档，不污染现有 `demo/` React 工程。

## Phase 0: Research

输出：`specs/030-wechat-miniapp-demo/research.md`

- 固化 demo 形态：使用原生微信小程序单页 demo，而不是额外引入 Taro / uni-app 等框架
- 固化 SDK 引入策略：优先使用 build 后产物作为小程序 demo 的稳定输入
- 固化主路径范围：初始化默认走固定 `restApiUrl/wsUrl`，关闭自动联系人同步，不为了本次 demo 顺带改 DNS / RestClient / 联系人同步专用链路
- 固化 SDK 最小改造点：把连接管理、心跳探测、消息发送从浏览器 `WebSocket` 收口到平台 socket 抽象
- 固化附件方案：小程序 demo 通过 `MiniAppFile` + request/upload/image 适配器覆盖附件消息发送；图片压缩失败时沿用现有“回退原图发送”语义
- 固化验收方式：自动化单元/集成测试 + 微信开发者工具手工验证清单，不新增自动化 E2E

## Phase 1: Design & Contracts

输出：

- `specs/030-wechat-miniapp-demo/data-model.md`
- `specs/030-wechat-miniapp-demo/contracts/miniapp-demo.openapi.yaml`
- `specs/030-wechat-miniapp-demo/quickstart.md`

设计要点：

1. 连接发送链路改造
   - `ConnectionManager` 从直接持有 `WebSocket` 收口为持有平台 socket 抽象
   - `HeartbeatManager`、`MessageSender` 与 `CoreSDK` 统一消费新的 socket 抽象
   - 保持现有 ACK、重试、重连语义不变，避免对上层 `ChatClient` API 产生破坏
2. 小程序平台适配器设计
   - `SocketAdapter`: 基于 `wx.connectSocket`
   - `RequestAdapter`: 基于 `wx.request`
   - `UploadAdapter`: 基于 `wx.uploadFile`
   - `RuntimeAdapter`: 提供最小网络/前后台桥接，或在当前版本使用 no-op
   - `ImageProcessor`: 基于 `wx.getImageInfo`、`wx.compressImage`、`FileSystemManager.readFile` + `computeMd5Hex`
3. demo 页面模型
   - 单页展示初始化、登录、发送消息、日志四个区域
   - 按消息类型维护独立草稿，但复用统一发送入口和日志视图
   - 附件类消息使用小程序选择器产出 `MiniAppFile`
4. SDK 引入策略
   - `sdk-loader.ts` 统一封装当前采用的 SDK 引入方式
   - 优先消费 `dist` 产物；若后续验证源码直引稳定，可作为开发优化，不作为首发依赖
5. 文档与验证
   - `README.md` 明确构建、导入、开发者工具启动与手工验证步骤
   - `quickstart.md` 提供仓库内部实现与验收视角的最小走查流程

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=030-wechat-miniapp-demo .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 030 的当前活跃技术、微信小程序 demo 目标、平台适配抽象与最小 SDK 收口范围写入 agent 上下文，供 `/speckit.tasks` 与实现阶段使用。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 收口 `ConnectionManager` / `HeartbeatManager` / `MessageSender` 到平台 socket 抽象
2. 为小程序 demo 实现 request/socket/upload/runtime/image 适配器
3. 搭建 `miniprogram-demo/` 基础工程与单页 UI
4. 接入初始化、登录、登出主路径
5. 接入文本、位置、命令、自定义消息发送
6. 接入图片、语音、视频、文件消息发送与本地素材选择
7. 补齐 README、手工验证清单与运行说明
8. 补齐单元/集成测试、版本号、`CHANGELOG.md` 与中文 commit

## Complexity Tracking

无额外豁免项。
