# IM SDK Demo

## 说明

- 本 demo 用于本地联调当前 `im-sdk-web`。
- 登录支持两种模式：
- `userId + token`：直接调用 SDK 登录。
- `userId + password`：demo 会先请求 `/{org}/{app}/token` 换取 token，再调用 SDK 登录。
- 支持发送文本、图片、语音、视频、文件、位置、命令、自定义消息（附件类可选择本地文件，选中文件后可不填 URL/文件名/类型/大小）。
- 图片消息表单支持“发送原图”开关；默认关闭，使用本地图片文件时会按大图语义发送。
- `sendMessage` 目前可能未对外暴露，demo 会提示仅创建消息。

## 使用步骤

1. 在仓库根目录构建并 link SDK
   - `npm install`
   - `npm run build`
   - `npm link`
2. 安装 demo 依赖并链接 SDK
   - `cd demo`
   - `npm install`
   - `npm link im-sdk-web`
3. 启动 demo
   - `npm run dev`

## 环境变量预填（可选）

在 `demo/` 目录创建 `.env` 或 `.env.local`，参考 `.env.example`（支持 `VITE_` 或 `EASEMOB_` 前缀）：

```
VITE_EASEMOB_APPKEY=你的appkey
VITE_EASEMOB_USERID=你的用户id
VITE_EASEMOB_TOKEN=你的token
VITE_EASEMOB_PASSWORD=可选，未填 token 时用于换取 token
VITE_EASEMOB_DNS_URLS=可选，逗号分隔；仅在使用 DNS_CONFIG 发现时生效
VITE_EASEMOB_TARGET_ID=默认目标用户
VITE_EASEMOB_CHANNEL_TYPE=single
VITE_EASEMOB_MESSAGE=默认消息内容
```

## E2E 说明

- Playwright E2E 默认会启动当前 demo 页面，而不是单独的 harness 页面。
- E2E 用例会从项目根目录 `.env` 读取真实环境凭证，并通过页面表单显式填充初始化与登录参数。
- 因此，若你要验证 `AppKey` / `Token` 是否生效，请修改项目根目录 `.env`，而不是只修改 `demo/.env`。

## 常见问题

- demo 默认直接引用 `src` 源码，改动无需重新 build。
- 初始化面板支持两种模式：
- 使用 DNS_CONFIG 发现：可手动填写 DNS_CONFIG 地址，留空时走 SDK 内置默认 DNS_CONFIG 地址。
- 固定服务地址直连：可直接手动填写 REST 地址和 WebSocket 地址。
- DNS 地址支持多个，使用英文逗号分隔。
- 若要验证 `014-local-cache-module` 的真实浏览器超限场景，可在 demo 的“缓存调试”标签页中直接预填当前用户缓存到临界值，再用页面按钮或控制台 `window.__cacheQuota` 追加少量用户缓存，观察 SDK 的清理与重试行为。
- 手工写入 localStorage 时，请先在初始化面板把缓存加密模式切到 `off`，否则 SDK 无法读取这些明文调试数据。
