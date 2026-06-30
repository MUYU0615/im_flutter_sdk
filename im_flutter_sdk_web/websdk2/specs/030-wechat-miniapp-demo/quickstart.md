# Quickstart: 微信小程序 Demo

## 1. 前置准备

1. 在仓库根目录安装依赖。
2. 构建 SDK 产物，供小程序 demo 使用。
3. 使用微信开发者工具打开 `miniprogram-demo/`。

参考命令：

```bash
npm install
npm run build
```

## 2. 启动 Demo

1. 在微信开发者工具中导入 `miniprogram-demo/` 目录。
2. 确认 demo 使用的 SDK 引入方式为当前文档约定的默认模式。
3. 编译通过后进入首页。

## 3. 初始化

在初始化区域填写：

- `appKey`
- `restApiUrl`
- `wsUrl`

然后执行初始化。

预期结果：

- 页面显示初始化成功日志
- SDK 状态从“未初始化”进入“已初始化未登录”

## 4. 登录

在登录区域填写：

- `userId`
- `token`

然后执行登录。

预期结果：

- 页面显示登录成功日志
- 当前用户信息可见
- 发送区域进入可用状态

## 5. 发送消息

### 文本消息

1. 输入目标 ID
2. 输入文本内容
3. 点击发送

预期结果：显示发送结果日志

### 附件消息

支持：

- 图片
- 语音
- 视频
- 文件

操作步骤：

1. 选择消息类型
2. 选择本地素材
3. 补齐必要元数据
4. 点击发送

预期结果：显示发送结果日志；失败时有明确错误信息

### 非附件消息

支持：

- 位置
- 命令
- 自定义

操作步骤：

1. 选择对应类型
2. 填写必要字段
3. 点击发送

预期结果：显示发送结果日志

## 6. 登出

点击登出按钮。

预期结果：

- 页面回到已初始化未登录状态
- 日志中可见登出结果

## 7. 手工验证清单

- [ ] demo 能在微信开发者工具中编译并打开
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
- [ ] 未初始化时不能登录或发送消息
- [ ] 缺少必填字段时有明确提示

## 8. 自动化验证建议

实现完成后至少执行：

```bash
npm run test:run
npm run lint
npm run type-check
```

若本特性新增了集成测试，再补充执行对应的 `tests/integration` 覆盖。

## 9. 本次实现已执行验证

2026-04-19 已执行并通过：

```bash
npm run test:run -- tests/unit/miniapp-demo tests/integration/miniapp-demo tests/unit/core/connection/connection-manager.test.ts tests/unit/core/connection/heartbeat.test.ts tests/unit/core/message/message-sender.test.ts tests/unit/core/message/combine-message-sender.test.ts
npm run test:run -- tests/unit/core/connection-message.test.ts
npm run lint
npm run type-check
npm run build
```
