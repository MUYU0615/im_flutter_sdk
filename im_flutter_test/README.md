# im_flutter_test

Flutter SDK API 自动化测试桥接端。Android、iOS、Web 都通过同一套
WebSocket JSON 协议接收 `native-auto-test` 的请求，并转发到
`Client.instance.<manager>.callNativeMethod(cmd, info)`。

## 配置

`assets/config.yaml` 是指向 `../native-auto-test/config.yaml` 的软链。
首次运行前先创建真实配置：

```bash
cd ../native-auto-test
cp config.yaml.template config.yaml
```

## 运行

```bash
# Android/iOS 与现有方式一致
flutter run

# Web smoke
flutter run -d chrome
```

页面启动后在桥接配置页连接 WebSocket 服务，并选择与 Python case 相同的 topic。
Web 端建议使用 `native-auto-test` 输出的动态 topic。

## Web MVP 范围

`im_flutter_test` 不依赖聚合包 `im_flutter_sdk`。Android、iOS、Web 三个平台都
通过 `im_flutter_sdk_interface` 暴露的 `Client.instance` 与各 manager 的
`callNativeMethod(cmd, info)` 执行 JSON bridge 请求。

Web 平台由独立的 `im_flutter_sdk_web` 插件包提供最小 `ClientWeb` 实现，测试
App 仅在 Web 启动时注册该插件。它用于让 Web 被测端通过同一套 WebSocket JSON
协议参与 `native-auto-test` 回归。

当前 Web adapter 支持：

- `init`
- `login`
- `loginWithAgoraToken`
- `renewToken`
- `getCurrentUser`
- `isConnected`
- `isLoggedInBefore`
- `getToken`
- `getCurrentDeviceId`
- `startCallback`
- `logout`
- `ChatManager.sendMessage` 文本消息

其他 manager/API 在 MVP 阶段返回稳定 unsupported 错误，后续在
`im_flutter_sdk_web` 中按 capability 逐步补齐。
