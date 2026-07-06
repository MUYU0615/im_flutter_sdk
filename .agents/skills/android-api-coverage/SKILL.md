---
name: android-api-coverage
description: 当需要以 Android 当前测试版本的真实原生 SDK API 为基线，统计 Flutter wrapper、native-auto-test 用例和 iOS/Web 对齐缺口时使用。
---

# Android API 覆盖统计

## 统计目标

这个 skill 只处理 API 覆盖统计，不证明用例运行通过。真实执行结果以 `e2e-run`、pytest HTML、Allure 和 case-results 为准。

统计分两层：

- 原生 Android SDK API -> Flutter Android wrapper -> native-auto-test 自动化覆盖。
- 已进入测试框架的 API -> Android/iOS/Web/新增平台同语义入口对齐。

Android 当前测试版本来自 `native-auto-test/config/sdk_version_capability_policy.yaml`，不要在 skill 或 case 中把 4.23.0 当永久基线。

## 必须扫描真实 SDK

原生 API 基线必须来自当前测试版本的 Android AAR/JAR 或源码包，不能只看 `MethodKey.java`。

优先扫描：

- `EMClient`
- `EMChatManager`
- `EMContactManager`
- `EMGroupManager`
- `EMChatRoomManager`
- `EMConversation`
- `EMMessage`
- `EMPushManager`
- `EMPresenceManager`
- `EMChatThreadManager`

只要当前测试版本原生 SDK 公开 API 存在，就必须进入统计表。wrapper 未封装或测试未覆盖时，记录缺口，不从表中删除。

## Wrapper 和自动化覆盖口径

Android wrapper 覆盖必须看到可调用分支：

- 扫描 `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/*Wrapper.java`。
- 识别 `MethodKey.xxx.equals(call.method)` 分支。
- 追踪 handler 是否调用 `EMClient.getInstance()`、manager、`EMMessage`、`EMOptions` 等 SDK 相关对象。

只声明 MethodKey、不存在可调用分支，不算 wrapper 覆盖。handler 中有 SDK 调用痕迹只能说明 wrapper 调用证据，不等于已经真实跑通。

自动化覆盖来自 `native-auto-test/tests/`、cmd/event key、case marker 和 case-results。源码引用扫描只能证明“有覆盖意图”，不能替代真实 E2E 执行结果。

## 三端对齐口径

iOS/Web 也按可调用入口扫描，不只看 key：

- iOS：扫描 `*Wrapper.m` 中的 call.method 分发和 handler。
- Web：扫描 `client_web.dart`、`managers/*_web.dart` 和 MethodKeys 等价入口。

三端状态至少区分：

- 原生 SDK 缺失
- wrapper 未暴露
- 找到但未实现
- 自动化未覆盖
- 真实 E2E 未通过
- 不适用
- 版本差异暂不覆盖
- 服务未开通或环境阻塞

原因必须输出中文。

## 标准命令

在仓库根目录或 `native-auto-test/` 下使用 Makefile 入口：

```bash
cd native-auto-test
make android-api-coverage
```

如果需要传扫描参数：

```bash
make android-api-coverage ARGS="..."
```

当前底层脚本名称仍包含历史版本号，但报告口径应读取版本能力策略中的当前测试版本。后续重构脚本名时，不改变这个 skill 的统计口径。

## 输出要求

输出统一放在 `native-auto-test/out/`，至少包含：

- Android 原生 SDK API 总数。
- 原生 API 已封装、未封装数量和明细。
- 原生 API 已有自动化覆盖、缺用例数量和明细。
- 直接 E2E、间接 E2E、需补 wrapper、需人工确认的结论。
- Android/iOS/Web 同语义入口对齐情况。
- 每条记录的证据：原生 class/method、wrapper 文件/行号、case 文件、平台状态和中文原因。

`native-api-coverage` 是原生 API 主表；`wrapper-platform-alignment` 只是三端 wrapper 对齐辅助表。
