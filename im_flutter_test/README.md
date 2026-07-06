# im_flutter_test

Flutter SDK API 自动化测试桥接端。Android、iOS、Web 都通过同一套
WebSocket JSON 协议接收 `native-auto-test` 的请求，并转发到
`Client.instance.<manager>.callNativeMethod(cmd, info)`。

## 配置

测试 App 不再打包 SDK 初始化配置。SDK options、服务器地址、DNS 开关等都由
`native-auto-test` 在 bridge ready 后通过 `Client.init` 下发。

首次运行前先创建控制端真实配置：

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

## 桥接范围

Android、iOS、Web 三个平台都通过同一套 WebSocket JSON 协议执行
`manager/cmd/info` 请求。`Client.init` 是特殊入口：由 bridge 收到控制端下发的
SDK options 后调用真实 SDK 初始化，其余 SDK API 继续通过 manager
`callNativeMethod(cmd, info)` 转发。

App 本身只负责 WebSocket 连接、事件转发、媒体素材和真实 SDK 调用，不维护测试环境
配置、不保存 REST 凭据，也不伪造 SDK 能力。
