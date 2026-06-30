# 018 数据模型（Phase 1）

## 1) PlatformAdapterProfile

- **描述**: 描述当前运行环境的平台类型与能力实现集合。
- **关键字段**:
  - `platformId`: 平台标识（`web` / `wechat-miniapp` / `uniapp` / `react-native` / `electron-renderer` / `unknown`）
  - `request`: 请求能力实现
  - `upload`: 上传能力实现
  - `socket`: 长连接能力实现
  - `runtime`: 生命周期与网络监听能力实现
  - `proto`: 编解码能力实现
  - `storage`: 存储能力实现
- **约束**:
  - 初始化时必须完整具备关键能力（`request/upload/socket/proto`），缺失则 fail-fast。
  - `uni-app H5` 需在能力画像中保留独立平台上下文标记。

## 2) UnifiedTransportContract

- **描述**: 统一的传输层行为契约，定义跨平台一致的请求/上传/连接/错误语义。
- **关键字段**:
  - `requestConfig`: 方法、地址、头、超时、取消信号
  - `uploadConfig`: 上传源、目标地址、鉴权头、进度回调
  - `socketConfig`: 地址、协议、心跳与重连参数
  - `errorContract`: 统一错误码、错误阶段、可重试标记
- **约束**:
  - 错误码语义跨平台一致。
  - 进度事件统一为 `loaded/total/percent`。
  - 连接状态事件统一映射为 SDK 内部标准事件。

## 3) AttachmentUploadContext

- **描述**: 附件上传全流程上下文，承载从输入文件到服务端资源结果的状态。
- **关键字段**:
  - `sourceType`: `web-file` / `miniapp-path` / `rn-uri`
  - `source`: 文件源元数据（name/type/size/path/uri）
  - `status`: `pending` / `uploading` / `completed` / `failed` / `canceled`
  - `progress`: `loaded/total/percent`
  - `result`: 上传成功后的资源信息（url/secret/fileLength/...）
  - `error`: 失败错误（统一错误契约）
- **状态流转**:
  - `pending -> uploading -> completed`
  - `pending -> uploading -> failed`
  - `pending -> uploading -> canceled`

## 4) CodecCapabilityProfile

- **描述**: 编解码能力配置与验证状态。
- **关键字段**:
  - `strategy`: `protobuf-static`
  - `runtime`: `protobufjs/minimal`
  - `sampleValidationPassed`: 是否通过样本一致性校验
  - `versionTag`: 当前编解码方案版本标识
- **约束**:
  - 同一 SDK 版本只允许一个 `strategy`。
  - 初始化阶段如编解码能力不可用则立即失败。

## 5) RuntimeLifecycleContext

- **描述**: 网络变化、前后台切换与连接恢复相关上下文。
- **关键字段**:
  - `networkState`: `online` / `offline`
  - `appState`: `foreground` / `background`
  - `lastTransitionAt`: 最近状态切换时间
  - `reconnectReason`: 触发重连原因
- **约束**:
  - 跨平台事件必须映射为统一语义。
  - 仅对真实连接状态变化触发对外事件，避免重复噪音。
