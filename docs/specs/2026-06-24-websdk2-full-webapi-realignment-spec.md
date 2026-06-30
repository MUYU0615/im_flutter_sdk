# WebSDK2 全量 Web API 重对齐 Spec

## 背景

当前 `im_flutter_sdk` 中的 Web 能力覆盖是围绕 Flutter Web adapter、`native-auto-test`
 的真实 E2E、以及中文 coverage 报告逐步演进出来的。随着 `websdk2` 完整工程与
 中文 API 文档可用，之前“只基于 vendor bundle 搜索、已有 case 行为、bridge 现状”
 得出的部分结论，需要重新审视。

本次工作的目标不是单独修某几个 API，而是以 `websdk2` 官方公开 API 文档为基线，
重审全部 Web API 在以下四层上的一致性：

1. `websdk2` 文档公开能力
2. Flutter Web adapter 实现
3. `native-auto-test` 真实 E2E case
4. `web_real_e2e_coverage.yaml` 与中文报告统计

## 目标

建立一套面向 Web SDK 5.0.0 release 的统一判断基线，确保：

- 文档公开的 Web API，都能在 Flutter Web 侧找到明确映射或明确缺失说明；
- 每个 `supported` 项都有真实 E2E 证据；
- 每个 `blocked` 项都能明确归类为：
  - `API未对齐iOS/Android`
  - `API执行未通过`
- `case`、`coverage`、`实现`、`报告` 四层结论不互相矛盾；
- 可以基于最终结果输出面向 `HIM-22263` 的 release 测试结论。

## 范围

本次范围是 **全部 Web API**，不是只看 Jira 中单独提到的几个功能点。

覆盖对象包括：

- `websdk2` 中文 API 文档中的全部 manager API
- `im_flutter_sdk_web/lib/src/managers/*.dart`
- `im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`
- `native-auto-test/config/web_real_e2e_coverage.yaml`
- `native-auto-test/tests/web_real/*.py`
- `native-auto-test/docs/agents/web/*.md`

特别关注的高风险组：

- `GroupManager`
- `ChatManager`
- `ChatRoomManager`
- `ChatThreadManager`
- `MessageManager`
- `Unclassified` 事件类能力

## 不在本次范围内

以下内容不作为本 spec 的主目标：

1. 新增与当前 Flutter method key 完全无关的全新产品能力。
2. Android/iOS SDK 行为修复本身。
3. 非 Web release 测试工程的重构。
4. 仅为了“看起来更整洁”而做的无关代码整理。

## 已知事实

### 1. `websdk2` 工程已可用

当前本地已具备：

- `im_flutter_sdk_web/websdk2/package.json`
- API 文档生成脚本
- `npm install` 可执行
- `npm run docs:api:md:zh` 可生成中文 API Reference

已确认文档产物：

- `im_flutter_sdk_web/websdk2/docs/reference/api-reference.zh-CN.md`

### 2. 当前 coverage 不是直接按 `websdk2` 文档建的

`web_real_e2e_coverage.yaml` 使用的是 Flutter/bridge 视角的 API 名称与能力拆分。
因此不能把文档 API 数量直接与 coverage 数量作一一比较，必须建立映射层。

### 3. 已出现过“文档纠正历史结论”的情况

例如：

- `GroupManager.muteAllMembers / unMuteAllMembers`

之前基于 vendor bundle 搜索，被归为“Web 无公开 API”；  
而 `websdk2` 中文文档明确公开了：

- `client.groupManager.getGroup('group-1').muteAllMembers()`
- `client.groupManager.getGroup('group-1').unmuteAllMembers()`

这说明必须以 `websdk2` 文档重新核对现有结论。

## 核心设计

### 一、建立四向映射基线

必须先建立统一映射表，至少包含以下列：

| 列 | 含义 |
|---|---|
| 文档 Manager | `websdk2` 文档中的 manager 名称 |
| 文档 API | 文档公开方法 |
| Flutter method key / manager | 当前 Flutter Web 侧入口 |
| interop 方法 | `real_web_sdk_interop.dart` 中的真实调用方法 |
| coverage 状态 | 当前 `supported/blocked/not_applicable` |
| case | 对应真实 E2E 用例 |
| 结论 | 当前是否一致、缺什么 |

这张表是后续所有修正动作的唯一基线。

### 二、统一判定规则

所有差异必须落到以下四类之一：

1. **文档已公开，adapter 未接**
2. **adapter 已接，但方法名/层级/参数语义不对**
3. **adapter 已接，但 coverage 状态不对**
4. **coverage 状态对，但 case/断言不足**

所有 `blocked` 最终只能保留两类测试结论：

- `API未对齐iOS/Android`
- `API执行未通过`

不能继续保留模糊 blocked 解释。

### 三、按 manager 分批重审

优先顺序：

1. `GroupManager`
2. `ChatManager`
3. `ChatRoomManager`
4. `ChatThreadManager`
5. `ConversationManager / MessageManager`
6. `Contact / Presence / Push / UserInfo / Client`

原因：

- `GroupManager` 已知存在最典型的“文档公开能力与当前 blocked 结论冲突”；
- `ChatManager` 影响消息主链路与 release 结论；
- 事件类能力最复杂，放在后面统一收口更稳。

### 四、每一批只接受真实 E2E 结论

每个修正都必须经过：

1. 修实现或修 coverage 结论
2. 跑对应最小真实 E2E
3. 更新 coverage
4. 刷新中文文档
5. 跑静态校验与 diff 校验

不接受下面这些“伪完成”：

- 只改 `yaml`
- 只改报告
- 只改 adapter，但没有真实 E2E 证明
- 只因为文档有 API，就自动记成 supported

## 成功标准

完成后必须满足：

1. 文档公开的 Web API 都能在映射表中找到落点。
2. 每个 `supported` 都有真实 E2E 证据。
3. 每个 `blocked` 都能清晰归入：
   - `API未对齐iOS/Android`
   - `API执行未通过`
4. `case`、`coverage`、`实现`、`报告` 四层结论一致。
5. `pending` 继续保持为 `0`。
6. 能输出一份面向 `HIM-22263` 的 release 视角结果：
   - 已通过
   - 明确 bug
   - 与 iOS/Android 未对齐
   - `Supported 但需额外说明`

## 风险与注意事项

### 1. 文档与当前工程版本可能存在微差

当前 `websdk2/package.json` 版本是 `0.14.161`，而 Jira 提到的本地包是
`0.14.154.tgz` 对应 release 5.0.0。  
因此文档核对时必须记录：

- 这是“以当前完整源码工程文档为准”的重审；
- 若文档与已接入 tgz 有差异，要单独标明版本差异影响。

### 2. `docs/intergration` 当前仍未在本地工程中找到

Jira 明确提到了该路径，但当前本地 `websdk2` 工程下尚未找到这一目录。  
这需要在 release 结论中单独作为文档缺口记录。

### 3. 事件类能力不能只看文档名

对于 `MessageManager` 和 `Unclassified` 中的大量事件：

- 仅文档公开 callback 名称，不代表当前 Flutter Web 测试层就真的透传了真实回调；
- 必须确认真实 Web SDK 回调是否能穿过当前 bridge 进入测试层。

## 输出物

本次 spec 驱动下最终应产出：

1. 文档 API 与 Flutter Web 覆盖的映射表
2. 修正后的 adapter / case / coverage
3. 刷新后的中文矩阵与报告
4. 面向 `HIM-22263` 的 Web release 测试结论

## 下一步

基于本 spec，下一步进入实施计划：

- `docs/plans/2026-06-24-websdk2-full-webapi-realignment.md`

执行顺序从“建立映射基线表”开始，然后优先进入 `GroupManager` 全组重审。

