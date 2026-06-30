# IM SDK 跨平台兼容方案（初稿）

## 1. 目标与范围

### 1.1 目标
- 在尽量不改动业务层 API 的前提下，让 SDK 支持以下运行平台：
  - Web（现有）
  - 微信小程序
  - uni-app（含小程序端、App 端）
  - Electron（Renderer 优先，Main 进程按需）
  - React Native
- 把平台差异收敛到一层 `PlatformAdapter`，业务层（连接、消息、上传）只依赖统一接口。

### 1.2 本阶段输出
- 平台差异清单
- SDK 需兼容的 API 清单
- 一套包装接口设计（含 WebSocket/请求/上传/protobuf）
- 分阶段落地建议
- 待确认问题列表（需要你补充平台文档）

---

## 2. 当前 SDK 的平台耦合点（基于现有代码）

当前实现以浏览器为默认环境，关键耦合点如下：
- 网络请求：`src/rest/client.ts` 直接使用 `fetch + AbortController`
- 文件上传：`src/upload/simple-upload.ts`、`src/upload/multipart-upload.ts` 直接使用 `XMLHttpRequest + FormData + File/Blob`
- WebSocket：`src/core/connection/connection-manager.ts`、`src/core/message/message-sender.ts` 直接使用浏览器 `WebSocket`
- 文件类型：`src/upload/utils.ts` 当前对 `MiniAppFile` 直接报错（尚未支持小程序上传）
- 运行时检测：`src/utils/env.ts` 仅有基础 `uni` 判断，未形成统一平台检测/能力检测
- protobuf：`src/protocol/msync/root.ts` 使用 `protobufjs`，小程序场景存在 `eval/new Function` 风险

---

## 3. 各平台关键差异（首版）

| 能力项 | Web | 微信小程序 | uni-app | React Native | Electron |
|---|---|---|---|---|---|
| HTTP 请求 | `fetch`/XHR | `wx.request` | `uni.request` | `fetch`（可用）/XHR（上传进度常用） | Renderer: `fetch`，Main: Node fetch |
| 文件上传 | `XMLHttpRequest + FormData + File` | `wx.uploadFile(filePath)` | `uni.uploadFile(filePath)` | 常见为 `FormData + { uri, name, type }` | Renderer 同 Web |
| WebSocket | `new WebSocket()` | `wx.connectSocket()` + `SocketTask.send` | `uni.connectSocket()` + `SocketTask.send` | `new WebSocket()`（版本差异需验证） | Renderer 同 Web |
| 网络状态监听 | `window online/offline` | `wx.onNetworkStatusChange` | `uni.onNetworkStatusChange` | `@react-native-community/netinfo` | Renderer 同 Web |
| 前后台切换 | `document.visibilitychange` | `wx.onAppShow/onAppHide` | `uni.onAppShow/onAppHide` | `AppState` | Renderer: `visibilitychange` |
| 本地缓存 | `localStorage/indexedDB` | `wx.setStorage` | `uni.setStorage` | `AsyncStorage` | Renderer: `localStorage` |
| protobuf 运行时 | `protobufjs`可用 | 对 `eval/new Function` 敏感 | 小程序端同样敏感 | 一般可用 | Renderer 可用 |

> 说明：uni-app 实际运行平台较多（H5/App/各小程序），最终能力要以“当前 uni 编译目标”做二次判定。

---

## 4. SDK 需要统一的 API 抽象

建议将 SDK 的跨平台能力抽象为 6 组接口：

1) `RuntimeAdapter`（环境与生命周期）
- `getPlatform()`
- `onNetworkChange(listener)`
- `onAppVisibilityChange(listener)`

2) `RequestAdapter`（REST 请求）
- `request<T>(config): Promise<ResponseLike<T>>`
- 统一 timeout/cancel/error 映射

3) `UploadAdapter`（附件上传）
- `uploadFile(config): Promise<UploadResult>`
- `onProgress`/`abort`
- 支持 `File | Blob | MiniAppFile | RNFile`

4) `SocketAdapter`（长连接）
- `connect(url, protocols?) => SocketLike`
- `send(data)`、`close()`
- `onOpen/onMessage/onError/onClose`

5) `StorageAdapter`（可选，建议同步纳入）
- `getItem/setItem/removeItem`
- 先适配缓存模块，避免 localStorage 绑定

6) `ProtoAdapter`（protobuf 能力）
- `encode/decode` 接口
- 屏蔽不同运行时 protobuf 实现差异

---

## 5. 包装层设计（抹平 API 差异）

### 5.1 顶层接口建议

```ts
export type RuntimePlatform =
  | 'web'
  | 'wechat-miniapp'
  | 'uniapp'
  | 'react-native'
  | 'electron-renderer'
  | 'electron-main'
  | 'unknown';

export interface PlatformAdapter {
  readonly platform: RuntimePlatform;
  readonly request: RequestAdapter;
  readonly upload: UploadAdapter;
  readonly socket: SocketAdapter;
  readonly proto: ProtoAdapter;
  readonly runtime: RuntimeAdapter;
  readonly storage: StorageAdapter;
}
```

### 5.2 工厂方法建议

```ts
export interface CreatePlatformAdapterOptions {
  prefer?: RuntimePlatform;
  overrides?: Partial<PlatformAdapter>;
}

export function createPlatformAdapter(options?: CreatePlatformAdapterOptions): PlatformAdapter;
```

- 默认根据运行时自动检测平台（可参考老工程 `getEnvInfo` 思路）
- 支持业务侧手动注入 `overrides`（便于 Electron Main、RN 特殊环境）
- SDK 内部统一调用 `adapter.*`，不再直接触达 `fetch/WebSocket/wx.*`

### 5.3 WebSocket 抹平示例

统一 `SocketLike`：
- Web/RN/Electron：直接包一层原生 `WebSocket`
- 微信小程序/uni-app：把 `SocketTask` 适配成同样的 `send/close/onX` 接口

### 5.4 上传抹平示例

统一输入 `UploadSource`：
- Web：`File/Blob`
- 小程序/uni-app：`{ path, name, type, size }`
- RN：`{ uri, name, type, size? }`

由各平台 adapter 决定内部调用：
- Web：XHR/FormData
- 小程序/uni-app：`uploadFile`
- RN：优先 XHR/FormData（兼容进度）

---

## 6. protobufjs 在小程序的兼容方案

你提到 `protobufjs` 在小程序中因 `eval()` 不可用，这是核心阻塞项。建议两条路线并行评估：

### 路线 A（推荐优先）：静态代码生成 + minimal runtime
- 使用 `pbjs/pbts` 在构建阶段生成静态 JS/TS 代码
- 运行时仅依赖 `protobufjs/minimal`（避免动态反射路径）
- SDK 内部通过 `ProtoAdapter` 调用生成后的静态编解码器

优点：
- 运行时最稳定，构建后体积/性能可控
- 与多端打包工具兼容性通常更好

### 路线 B（兼容历史）：沿用你们 `weichatPb`
- 针对小程序平台走 `weichatPb` 实现
- Web/RN/Electron 维持现有 `protobufjs`
- 通过 `ProtoAdapter` 在运行时切换

优点：
- 可快速复用老工程验证过的方案

风险：
- 两套 protobuf 运行时并存，后续维护成本更高
- 需要保证 wire 格式与字段行为完全一致

---

## 7. 建议改造顺序（低风险分阶段）

### Phase 1：先搭“适配层骨架”（不改业务行为）
- 新建 `src/platform/` 目录与统一接口
- 实现 `web-adapter`（等价于当前逻辑）
- SDK 关键路径改为依赖 adapter（请求/上传/ws）

### Phase 2：补齐微信小程序/uni-app
- 实现 `wechat-miniapp-adapter`、`uniapp-adapter`
- 重点打通：登录请求、WebSocket 收发、附件上传
- 增加端到端用例：文本消息 + 图片/文件消息

### Phase 3：补齐 React Native/Electron
- RN 先打通请求+ws，再补上传进度
- Electron 优先声明仅支持 Renderer；Main 进程按需提供自定义 adapter 注入

### Phase 4：protobuf 收敛
- 选定路线 A 或 B
- 建立编解码一致性测试（同一 payload 在各平台 encode/decode 一致）

---

## 8. 待你补充的文档/信息（我目前不确定）

为避免方案偏差，下面这些点请你给我对应文档或现网约束：

1. 小程序上传约束
- `wx.uploadFile` 是否需要额外签名/header 规则（除 `Authorization` 外）？ 不需要
- 上传是否必须走 `filePath`，还是允许直接二进制流？ 不限制，能上传就行

2. 小程序 WebSocket 细节
- 你们线上是否依赖 `SocketTask` 的特定行为（如重连时机、二进制帧类型）？ 无特殊行为
- `onMessage` 收到二进制时的数据格式（`ArrayBuffer`/其他）有无历史兼容处理？ 不需要兼容历史

3. uni-app 目标端范围
- 仅 uni 小程序端，还是包含 uni App（Android/iOS）？ 包含Android/iOS，但仅仅是通过web转的
- 是否需要支持 `nvue`/离线打包场景？不需要

4. React Native 基线版本
- RN 最低版本是多少？是否已内置 `AbortController`、`Blob`、`WebSocket binaryType` 能力？ 主流版本就行，不需要考虑历史版本的兼容。使用xmlhttprequest?

5. Electron 支持边界
- 只要求 Renderer 进程可用，还是 Main 进程也要直接跑 SDK？ Renderer only

6. protobuf 兼容策略偏好
- 是否接受引入“构建期生成静态 pb 代码”的流程？接受
- 你更倾向复用 `weichatPb` 还是统一迁移到静态生成方案？ 优先统一到 protobufjs 静态生成成方案（全平台一套）

---

## 9. 参考来源（你提到的历史实现）

- 小程序 protobuf 兼容：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/weichatPb`
- 历史环境检测：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/utils/index.ts` 的 `getEnvInfo`
- 小程序上传文件文档： `https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/wx.uploadFile.html`
- 小程序本地存储的文档： `https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorage.html`

---

## 10. 扩展入口与错误语义（US5 补充）

### 10.1 适配器解析入口

- `ChatClient.init` 不暴露平台适配器注入参数，SDK 在初始化阶段根据运行环境自动解析平台能力。
- Web / Electron / React Native 默认沿用 Web 兼容适配器；微信、QQ、头条、百度、支付宝、钉钉等小程序环境走内置小程序适配器。
- 内部适配器解析仍支持默认能力组合，用于 SDK 自身装配 `request/upload/socket/runtime/proto/storage/imageProcessor`。

### 10.2 关键能力缺失错误契约

- 关键能力定义：`request/upload/socket/proto`
- 缺失关键能力时，在初始化阶段直接抛错（fail-fast），不进入部分可用状态。
- 错误结构（示例）：

```ts
{
  code: 'PLATFORM_MISSING_CAPABILITY',
  stage: 'init',
  retryable: false,
  details: {
    required: ['request', 'upload', 'socket', 'proto'],
    missing: ['socket']
  }
}
```

### 10.3 单一 protobuf 方案约束

- 工厂默认始终注入静态 protobuf 适配器（`createStaticProtoAdapter`）。
- 不再保留运行时 JSON 或多方案回退分支；编码类型不存在时直接抛出 `PLATFORM_PROTO_FAILED`。

---

## 11. 静态 protobuf 产物生成与 CI 校验（新增）

### 11.1 本地生成

- proto 源文件：`src/protocol/msync/proto-source.json`
- 生成产物：`src/protocol/msync/proto.ts`
- 生成命令：`npm run proto:gen`
- 校验命令：`npm run proto:check`
- 构建命令：`npm run build`（会先自动执行 `prebuild -> proto:check`）

### 11.2 开发约束

- 修改 proto 源定义后，必须先执行 `npm run proto:gen` 再提交代码。
- SDK 运行时只消费 `src/protocol/msync/proto.ts`，不在运行时做动态解析与回退。

### 11.3 CI 约束

- GitHub Actions 新增 `Proto Static Check` 工作流：
  1. `npm ci`
  2. `npm run proto:check`
  3. `npm run test:run -- tests/unit/platform tests/unit/protocol`
- 若生成产物与源定义不一致，CI 会直接失败并阻断合并。
