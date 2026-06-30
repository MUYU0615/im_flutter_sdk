---
name: android-api-coverage
description: Use when统计 Android 原生 SDK API 是否被 Flutter wrapper 和 native-auto-test 覆盖，或比较 Android/iOS/Web 三端 API 对齐缺口。
---

# Android API Coverage

## 用途

用于生成 SDK API 级覆盖统计。统计必须按两层链路看，不能只看 Flutter wrapper：

1. 原生 Android SDK API 覆盖层：
   - Android 原生 SDK 4.23 里有哪些 manager/API。
   - Flutter Android wrapper 是否封装了这些原生 API。
   - `native-auto-test` 是否通过 case 覆盖到对应 wrapper API。
2. 三端对齐层：
   - 已经进入 Flutter wrapper/test 框架的 API，Android、iOS、Web 是否都有同语义入口。
   - 某个平台不存在、未实现、不适用、仅本地 adapter、真实 SDK 不支持，要分开记录。

## 统计口径

Android 4.23 是原生 API 基准。正确链路是：

```text
Android 原生 SDK 4.23 API
  -> im_flutter_sdk_android wrapper 封装
  -> im_flutter_sdk_interface / Dart cmd
  -> im_flutter_test bridge
  -> native-auto-test case
  -> iOS/Web 同语义 API 对齐
```

### 第一层：原生 Android SDK API 到测试覆盖

必须真实扫描 Android SDK 4.23 的 AAR/JAR，不允许只看 `MethodKey.java` 或 wrapper 分支。

目标输入：

- Gradle 依赖：`io.hyphenate:hyphenate-chat:4.23.0`。
- 本地 AAR/JAR：优先从 Gradle cache 或 `im_flutter_sdk_android/android/libs` 找到实际 4.23 SDK 包。
- 扫描 manager 类 public 方法，例如：
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

输出必须回答：

- `native_android_api_exists`：Android 4.23 原生 SDK 是否存在该 API。
- `android_wrapper_covered`：Flutter Android wrapper 是否封装该原生 API。
- `automation_covered`：`native-auto-test` 是否有 case 覆盖该 wrapper API。
- `native_to_wrapper_mapping`：原生 API 映射到哪个 `manager/cmd`；无法自动映射时标记 `manual_mapping_required`。
- `native_test_requirement`：该原生 API 应直接 E2E、间接 E2E、先补 wrapper，还是人工确认。
- `coverage_conclusion`：该原生 API 当前结论，例如 `covered_by_case`、`case_required`、`manual_review_required`、`wrapper_missing`。
- `coverage_reason_zh`：必须用中文解释结论原因。

原则：只要原生 SDK public API 存在，就必须出现在统计表里，并且必须有覆盖结论。不能因为它暂时没有 Flutter wrapper 或不是一对一 E2E 就从表里消失。

### 第二层：wrapper 进入测试框架后的三端对齐

Android API 入口必须来自 wrapper 分发扫描：

- 扫描 `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/*Wrapper.java`。
- 识别 `MethodKey.xxx.equals(call.method)` 分支。
- 解析分支对应 handler，并扫描 handler 方法体。
- handler 中出现 `EMClient.getInstance()`、`chatManager()`、`groupManager()`、`EMMessage`、`EMOptions` 等痕迹时，只能记录为 `android_wrapper_sdk_call_evidence=yes`。
- 这个字段只是 wrapper 调用证据，不等于“已扫描原生 SDK 确认 API 存在”。
- 只声明 MethodKey、但 wrapper 没有可调分支，不算 wrapper 覆盖。

iOS/Web 也按可调入口扫描，不只看 key：

- iOS：扫描 `*Wrapper.m` 中 `[Key isEqualToString:call.method]`。
- Web：扫描 `client_web.dart` 和 `managers/*_web.dart` 中 `case _MethodKeys.xxx:`。

## 必须输出的维度

报告必须同时包含：

- Android 原生 SDK API 总数。
- Android 原生 SDK API -> Flutter Android wrapper：封装多少、缺哪些。
- Android 原生 SDK API -> native-auto-test：自动化覆盖多少、缺哪些。
- Android 原生 SDK API -> 覆盖结论：直接覆盖、缺 case、需间接确认、缺 wrapper 分别多少。
- Flutter wrapper API -> 三端对齐：Android/iOS/Web 各自覆盖多少、缺哪些。
- Android 相对缺失：iOS/Web 有但 Android wrapper 缺哪些。
- 每条 API 的证据：原生 SDK class/method、Android wrapper 文件/行号/handler、iOS/Web 文件/行号、自动化 case 文件。

## 标准命令

在仓库根目录执行：

```bash
cd /Users/dujiepeng/work/qa/hub_all/im_flutter_sdk
python3 native-auto-test/src/tools/android_423_api_coverage_report.py
```

默认输出：

- `native-auto-test/out/android-4.23-api-coverage.html`
- `native-auto-test/out/android-4.23-api-coverage.csv`
- `native-auto-test/out/android-4.23-api-coverage-summary.json`

当前脚本主要覆盖“第二层：wrapper 三端对齐”。如果报告没有 `native_android_api_exists`、`native_android_class`、`native_android_method` 字段，就不能宣称已经完成“原生 Android SDK API 覆盖统计”。

## 结果解读

- `native_android_api_exists=yes`：真实 Android SDK 4.23 中存在该原生 API。
- `android_wrapper_covered=no`：Android 原生 SDK 有 API，但 Flutter Android wrapper 未封装。
- `automation_covered=no`：Android 原生 SDK/API wrapper 链路存在，但测试工程未扫描到 case 覆盖。
- `native_test_requirement=direct_e2e`：应通过 wrapper API 和 native-auto-test 直接覆盖。
- `native_test_requirement=indirect_e2e`：应通过事件、对象字段、状态查询或组合流程间接覆盖，并绑定 case 证据。
- `native_test_requirement=wrapper_required`：原生 API 存在，但需要先确认/补 Flutter wrapper。
- `coverage_conclusion=covered_by_case`：已扫描到 wrapper 映射和自动化 case 引用。
- `coverage_conclusion=case_required`：wrapper 已映射，但缺自动化 case。
- `coverage_conclusion=manual_review_required`：适合间接覆盖，需人工绑定或确认 case。
- `coverage_conclusion=wrapper_missing`：原生 API 存在，但当前 wrapper 未映射。
- `android_covered=no`：其他平台有，但 Android wrapper 没有同 `manager/api` 可调入口。
- `ios_covered=no`：Android 有，但 iOS 没有同 `manager/api` 可调入口。
- `web_covered=no`：Android 有，但 Web 没有同 `manager/api` 可调入口。
- `android_wrapper_sdk_call_evidence=no`：Android wrapper 有入口，但 handler 中未扫描到直接 SDK 调用证据；需要人工确认是否是配置、桥接、本地对象或漏扫。

## 注意事项

- 这个报告统计“API 覆盖”，不代表 case 运行通过。
- 自动化覆盖是源码引用扫描，不能替代 pytest 执行结果。
- Web 的 `local_adapter` 能力不能默认视为真实 SDK E2E；如需真实 E2E 结果，要结合 Web real E2E 报告。
- Android 版本升级后，先确认 `im_flutter_sdk_android/android/build.gradle` 中 SDK 版本，再重新运行本报告。
- 如果本地没有 Android 4.23 AAR/JAR，必须先下载或让 Gradle 解析依赖；否则只能生成 wrapper 对齐报告，不能生成原生 Android SDK 基准报告。
