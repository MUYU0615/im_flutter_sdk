# Data Model: 微信小程序 Demo

## 1. MiniAppDemoSession

### Purpose

描述小程序 demo 当前会话的整体状态，用于驱动页面可操作性、日志展示和按钮禁用逻辑。

### Fields

- `connectionState`: `disconnected | connecting | connected | reconnecting | reconnectFailed`
- `isInitialized`: `boolean`
- `isLoggedIn`: `boolean`
- `currentUserId`: `string | null`
- `currentTargetId`: `string`
- `currentChannelType`: `single | group | room`
- `activeMessageType`: `text | image | voice | video | file | location | cmd | custom`
- `sdkMode`: `dist`
- `lastOperationStatus`: `idle | success | error`

### Validation Rules

- `isLoggedIn=true` 时必须满足 `isInitialized=true`
- `currentUserId` 仅在 `isLoggedIn=true` 时允许非空
- `activeMessageType` 必须始终落在支持的 8 类消息集合内

### State Transitions

- `idle -> initialized`: 初始化成功
- `initialized -> logged_in`: 登录成功
- `logged_in -> initialized`: 登出成功
- 任一状态可进入 `error` 结果展示，但不会改变基础状态机中的已初始化/已登录事实

## 2. MiniAppInitInput

### Purpose

描述小程序 demo 初始化所需的最小输入集合。

### Fields

- `appKey`: `string`
- `restApiUrl`: `string`
- `wsUrl`: `string`
- `serviceConfig.serverUrls`: 固定服务地址配置，由 `restApiUrl` / `wsUrl` 映射生成
- `enableAutoSyncContacts`: `false`

### Validation Rules

- `appKey` 必填
- `restApiUrl` 必填，且为可识别的 HTTP(S) 地址
- `wsUrl` 必填，且为可识别的 WS(S) 地址
- 本 feature 固定通过 `serviceConfig.serverUrls` 直连，不暴露 DNS_CONFIG 输入

### Relationships

- 初始化成功后写入 `MiniAppDemoSession`
- 作为 `ChatClient.init()` 的输入映射来源

## 3. MiniAppLoginInput

### Purpose

描述登录区需要的凭证数据。

### Fields

- `userId`: `string`
- `token`: `string`

### Validation Rules

- `userId` 必填
- `token` 必填
- 仅在 `MiniAppDemoSession.isInitialized=true` 时允许提交

## 4. MiniAppMessageDraft

### Purpose

统一表示当前待发送的消息草稿，按消息类型分支出不同的必填字段。

### Shared Fields

- `type`: `text | image | voice | video | file | location | cmd | custom`
- `channelType`: `single | group | room`
- `targetId`: `string`

### Type-specific Fields

#### Text Draft

- `message`: `string`

#### Image Draft

- `filename`: `string`
- `filetype`: `string`
- `width`: `number`
- `height`: `number`
- `isGif`: `boolean`
- `imageType`: `'original' | 'large'`
- `selection`: `MiniAppAttachmentSelection | null`

#### Voice Draft

- `filename`: `string`
- `filetype`: `string`
- `duration`: `number`
- `selection`: `MiniAppAttachmentSelection | null`

#### Video Draft

- `filename`: `string`
- `filetype`: `string`
- `duration`: `number`
- `width`: `number | undefined`
- `height`: `number | undefined`
- `selection`: `MiniAppAttachmentSelection | null`

#### File Draft

- `filename`: `string`
- `filetype`: `string`
- `fileSize`: `number | undefined`
- `selection`: `MiniAppAttachmentSelection | null`

#### Location Draft

- `latitude`: `number`
- `longitude`: `number`
- `address`: `string | undefined`
- `buildingName`: `string | undefined`

#### Cmd Draft

- `action`: `string`
- `paramsJson`: `string`

#### Custom Draft

- `event`: `string`
- `paramsJson`: `string`

### Validation Rules

- `targetId` 必填
- 附件类消息必须包含 `selection`
- 文本消息必须包含非空 `message`
- 位置消息必须包含合法经纬度
- 命令和自定义消息的参数 JSON 必须为空或可解析为对象

## 5. MiniAppAttachmentSelection

### Purpose

表示用户在小程序环境中选择的本地素材，并作为 `MiniAppFile` 的输入来源。

### Fields

- `path`: `string`
- `name`: `string`
- `type`: `string`
- `size`: `number`
- `kind`: `image | voice | video | file`
- `duration`: `number | undefined`
- `width`: `number | undefined`
- `height`: `number | undefined`

### Validation Rules

- `path` 必填，且必须是小程序可访问的本地临时文件路径
- `kind` 与当前消息草稿类型必须一致
- `size` 必须大于等于 0

### Relationships

- 可转换为 `MiniAppFile`
- 被 `MiniAppMessageDraft` 的附件类分支引用

## 6. MiniAppPlatformAdapterProfile

### Purpose

描述 demo 注入给 SDK 的平台能力集合，用于保证小程序主路径可运行。

### Fields

- `request`: `enabled`
- `socket`: `enabled`
- `upload`: `enabled`
- `runtime`: `enabled | noop`
- `imageProcessor`: `enabled`

### Validation Rules

- `socket` 必须启用，否则无法登录/发消息
- `upload` 与 `imageProcessor` 对附件类消息为必需
- `request` 对附件预检与未来扩展场景为必需

## 7. MiniAppLogEntry

### Purpose

向用户展示最近操作结果，便于联调和排障。

### Fields

- `id`: `string`
- `level`: `info | warn | error`
- `message`: `string`
- `time`: `string`
- `operation`: `init | login | logout | send | select-file | runtime`

### Validation Rules

- `message` 必填
- `operation` 必须归一到预定义集合

## Derived Mappings

### AttachmentSelection -> MiniAppFile

- `path -> path`
- `name -> name`
- `type -> type`
- `size -> size`

### DemoSession + MessageDraft -> SDK Calls

- `MiniAppInitInput -> ChatClient.init()`
- `MiniAppLoginInput -> client.login()`
- `MiniAppMessageDraft(type=text) -> createTextMessage() + sendMessage()`
- `MiniAppMessageDraft(type in attachment types) -> create{Type}Message({ data: MiniAppFile }) + sendMessage()`

## Non-goals in Data Model

- 不建模联系人、群组、聊天室、Push、缓存调试等现有 Web demo 扩展能力
- 不为小程序 demo 引入独立持久化消息列表或会话列表数据模型
