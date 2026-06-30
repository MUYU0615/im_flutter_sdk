---
name: native-auto-test-framework
description: Use when working in native-auto-test on SDK API coverage, Web/Android/iOS parity, case design, WebSocket SDK calls, REST user setup, release-note regression mapping, reports, or cross-platform test framework rules.
---

# Native Auto Test Framework

## 用途

`native-auto-test` 是跨平台 SDK 自动化框架，覆盖 Web、Android、iOS 以及后续新增 SDK 目标。它通过同一个测试控制面验证 SDK API 覆盖、真实服务行为、事件投递、服务端状态和跨平台一致性。

本项目不是 Flutter demo 辅助工具，也不是单个平台 adapter 测试集。平台 SDK 源码、桥接 key、release note、Web SDK 文档、coverage YAML 和可执行 case 都是证据来源，需要互相校验。

## 核心规则

1. 不要把单个平台源码当成唯一 API 基线。
   - Android `MethodKey.java` 和 iOS `MethodKeys.h` 是重要参考，但不是唯一事实来源。
   - 它们可能落后于测试工程、Web SDK 文档或已确认 SDK 能力。
2. 不要把 release note 当成完整 API 基线。
   - release note 是增量回归输入。
3. 同步响应成功、Promise resolve 或 WebSocket response 只证明调用返回了。
   - 业务成功必须由接收端状态、服务端状态、事件、本地状态或其他稳定可观察结果支撑。
4. 平台差异必须显式记录。
   - unsupported、未暴露、不可用、不适用、环境阻塞、已实现但失败要分开统计。
5. Suite 必须按“平台 × 执行层”拆分。
   - 平台：Android、iOS、Web、后续新增平台；`mobile` 只能作为兼容设备组，不是统计平台。
   - 执行层：真实 E2E、wrapper mapping、fixture、capability、unit。
   - wrapper mapping/local/unit 不能算真实 SDK 覆盖。
6. Web E2E 默认使用 `real_sdk`。只有明确做 wrapper JSON 映射验证时，才手动指定 Web 兼容模式 `local_adapter`。
7. 默认不要为每个 SDK 模块创建一个 skill。
   - 只有模块反复出现多账号、多设备、服务端状态或事件流 setup 时，才增加复用 helper 或 reference。

## 选择正确参考

| Task | Read |
|---|---|
| API inventory, coverage matrix, Web parity, platform support reasons | `references/api-coverage-alignment.md` |
| New or changed SDK cases, assertion strength, pass/fail criteria | `references/case-design-assertions.md` |
| WebSocket SDK call, response wait, event wait, quick manual probe | `references/ws-usage.md` |
| Create/delete temporary REST users for test setup | `references/rest-user-provisioning.md` |
| Map SDK release notes to regression cases | `references/release-note-mapping.md` |

## MethodKeys 到 E2E 的覆盖流程

当用户提供“需要增加的方法”或新增平台时，按这个顺序处理：

1. 先建立 API 清单。
   - Android 看 `../im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java`。
   - iOS 看 `../im_flutter_sdk_ios/ios/Classes/MethodKeys.h`。
   - Web 和新增平台看对应 MethodKeys、capability YAML、adapter 映射或公开文档。
2. 补齐本测试工程的 key 映射。
   - 同步 `src/sdk_api/cmd_keys.py`、`src/sdk_api/event_keys.py` 或对应 coverage/capability 配置。
   - 如果平台没有该方法，记录为“未找到 API”或“未暴露”，不要写成 supported。
3. 设计参数矩阵。
   - 每个方法至少覆盖默认成功、关键可选参数、对象参数子字段、枚举值、边界值、非法值。
   - 不同参数必须产生不同 E2E 可观察结果：响应字段、服务端状态、接收端事件、本地状态、错误码或 unsupported 分类。
4. 写可执行 case。
   - 统一通过 `manager/cmd/info` 驱动 `../im_flutter_test/`。
   - 成功用 `assert_response_matches`；失败用 `assert_error(code, description)` 或固定错误模板。
   - 事件必须断言 `type="event"`、`eventType` 和关键 `data` 字段。
5. 扩展跨平台统计。
   - Android、iOS、Web 和新增平台都要有状态：支持、未找到、找到但未实现、已实现但未通过、不适用、待确认。
   - 统计和报告输出到 `/Users/dujiepeng/work/qa/hub_all/im_flutter_sdk/native-auto-test/out`。
   - 优先复用 `src/tools/platform_api_support_report.py`、Web coverage/report 工具和 `config/*coverage*.yaml`。

## Suite 分层

默认全量测试应只包含目标平台真实 E2E 和基础设施/能力校验。任何只验证 wrapper JSON 映射、本地 adapter、local store、合成事件、mock/fixture 的用例必须显式标记并通过单独入口运行。

建议命名：

- `real_e2e`：真实 SDK + 真实服务 + 真实事件/状态闭环。
- `wrapper_mapping`：验证 `manager/cmd/info/result/event` 的 wrapper JSON 映射、桥接路由和稳定错误结构。Web 当前可通过 `local_adapter` 模式执行这层测试。
- `fixture`：不连接真实被测端的配置、manifest、工具校验。
- `capability`：能力声明、覆盖矩阵、平台状态校验。
- `unit`：纯函数或脚本单测。

跨平台报告只把 `real_e2e` 作为覆盖证据；`wrapper_mapping` 等其他层用于辅助定位和防回归。

## 参数严格校验要求

- 不接受只测 happy path 的 SDK 覆盖。
- 可选参数要覆盖“未传、空值、合法值、非法值”中的关键组合。
- 对象参数要展开到子字段，例如 options、filter、fetch options、message body。
- 枚举参数要覆盖主要枚举分支，并确认不同分支产生不同返回、事件或状态。
- 边界值和非法值要冻结稳定错误码/文案；不稳定错误先 discovery，再 strict。
- 忽略字段必须最小化。同步响应通常只忽略 `sequence`；事件只额外忽略时间类字段和明确不稳定字段。

## 现有辅助区域

- WebSocket 调用使用 `src/tools/ws_client.py` 和 `skills/im-ws/scripts/` 下的脚本。
- REST 用户准备使用 `src/rest_api/user_api.py` 和 `skills/im-rest-users/scripts/` 下的脚本。
- Contact flow 使用 `src/test_flow/model_test_flow.py` 和 `skills/im-contact-flow/scripts/contact_flow.py`。
- Release note 映射可复用 `skills/release-note-case-mapping/references/mapping-checklist.zh.md`。

这些 helper 本身不定义覆盖完整性。覆盖判断必须遵守上面的框架规则和 reference。
