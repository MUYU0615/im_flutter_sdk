# 微信小程序 Demo

本目录提供一个原生微信小程序 demo，用于验证 websdk2 在小程序环境下的最小主路径：

- SDK 初始化
- 登录 / 登出
- 发送 `text`、`image`、`voice`、`video`、`file`、`location`、`cmd`、`custom` 8 类消息

## 目录说明

- `pages/index/`: 单页联调界面
- `utils/sdk-loader.ts`: SDK 加载入口，当前固定使用 `dist/index.js`
- `utils/platform-adapters.ts`: 小程序 request/socket/upload/runtime/storage/image 适配层
- `utils/demo-runtime.ts`: 初始化、登录、登出、发送消息的轻量运行时封装

## 使用方式

1. 在仓库根目录安装依赖。
2. 构建 SDK 产物。
3. 用微信开发者工具导入 `miniprogram-demo/`。

参考命令：

```bash
npm install
npm run build
```

## 当前导入模式

当前 demo 默认走 `dist` 模式：

- 小程序侧通过 `../../dist/index.js` 加载 SDK
- 不依赖直接引用 `src/` 源码
- 如果重新构建 SDK，请先执行 `npm run build`

## 初始化约束

本 demo 刻意保持初始化表单最小化，只保留：

- `appKey`
- `restApiUrl`
- `wsUrl`

固定行为：

- 通过 `serviceConfig.serverUrls` 固定使用页面填写的 REST / WebSocket 地址
- `enableSyncData = []`
- 小程序平台适配器由 SDK 自动识别并装配
- 缓存加密模式使用 SDK 默认自动策略

说明：

- demo 不提供自定义 DNS 地址输入
- `ChatClient` 仍是单例；如果已经初始化过，再改初始化配置需要重启小程序

## 附件消息说明

- 图片 / 视频：使用小程序素材选择器
- 文件 / 语音：使用 `chooseMessageFile`
- 位置：支持手输经纬度，也支持从地图选择

语音素材当前使用文件选择方式，不包含录音能力。

## 手工验证清单

- [ ] 微信开发者工具可成功打开 `miniprogram-demo/`
- [ ] 执行 `npm run build` 后 demo 可正常启动
- [ ] 可完成初始化
- [ ] 可完成登录
- [ ] 可完成登出
- [ ] 可发送文本消息
- [ ] 可发送图片消息
- [ ] 可发送语音消息
- [ ] 可发送视频消息
- [ ] 可发送文件消息
- [ ] 可发送位置消息
- [ ] 可发送命令消息
- [ ] 可发送自定义消息
- [ ] 缺少必填字段时页面有明确错误日志

## 已完成的自动化验证

本次实现已补以下自动化测试：

```bash
npm run test:run -- tests/unit/miniapp-demo tests/integration/miniapp-demo
```

另外已补充 socket 抽象相关回归测试与 `npm run type-check`。
