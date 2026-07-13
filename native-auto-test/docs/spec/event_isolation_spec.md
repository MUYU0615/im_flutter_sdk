# native-auto-test 事件隔离与消息匹配完整 Spec

日期：2026-07-08

状态：已落地到 `src/tools/event_waiter.py`、消息 helper 和相关真实 E2E case。当前执行命令、报告查看和脚本入口以 `../testing_runbook.md` 为准。

## 背景

`native-auto-test/` 通过 WebSocket 控制 `im_flutter_test/` 调用真实 Flutter SDK，并接收 SDK 回调事件。当前 Android 全量 E2E 中出现多类疑似串事件失败，例如：

- `test_chat_fetch_history_messages_success` 预期收到 `s3-history-*`，实际匹配到上一个 case 的 `s3-pin-*`。
- `fetch_history_by_options` 又收到前一个 history case 的消息，表现为事件流整体滞后。
- 多个 send/success 类 case 收到 `status=0` 的早期发送事件，但断言需要发送完成后的最终消息。
- 群组、thread、media 等 case 使用发送时的临时 `msgId` 判断接收方事件，但接收方事件里的 `msgId` 可能是服务端落库后的最终 ID。

这些问题不能简单归类为 SDK 缺陷。现有测试框架确实存在事件污染和事件竞态风险。

## 当前机制

`src/tools/ws_client.py` 里 `DeviceConnection` 已经提供单连接双工能力：

- `call()` 通过同一条 WebSocket 发送请求，并按 request id 等待响应。
- 后台 `recv_loop` 持续接收服务端响应和 SDK event。
- 非当前请求响应进入 `_recv_queue`，再由 `receive_message()` 消费。
- `receive_message(match_event_type=...)` 会先查 `_event_buffer`，再从 `_recv_queue` 取消息。
- 不匹配的消息会放回 `_event_buffer`。

这能解决“事件先于显式 wait 到达后丢失”的一部分问题，但当前匹配粒度主要停留在 `eventType`。只要队列或 buffer 里存在旧的 `onMessageSuccess` / `onMessagesReceived`，测试就可能直接拿到旧事件并断言失败。

## 问题定义

### 1. eventType 级匹配不足

大量用例只调用：

```python
device.receive_message(match_event_type=Cmd.onMessageSuccess.value)
```

这只证明收到了某类事件，不能证明事件属于当前 case、当前发送者、当前接收者、当前会话、当前消息内容或当前消息阶段。

### 2. 请求响应和 SDK 事件没有全局顺序保证

WebSocket command response 和 SDK callback event 是两条异步语义流。即使在同一连接中，也不能假设：

```text
sendMessage response 一定早于 onMessagesReceived
onMessageSuccess(status=2) 一定早于 onMessageSuccess(status=0)
当前 case 的 event 一定早于历史积压 event
```

所以 case 不能依赖“发送完再开始 wait，就只会等到本 case 的事件”。

### 3. 外部消息可能污染测试账号

如果测试账号不是 run 级别完全隔离，或者同一账号被其他环境、人工调试、旧进程复用，SDK 仍会正常收到来自非本次自动化系统的消息。这类消息在真实 SDK 视角是合法事件，但对当前 case 是污染。

### 4. `msgId` 存在多个语义

同一次发送链路里至少存在三类 ID：

| 名称 | 来源 | 语义 |
|---|---|---|
| `temp_msg_id` | 发送请求入参或本地创建消息阶段 | 发送前/发送中本地临时 ID |
| `final_msg_id` | `onMessageSuccess` 成功完成后的消息 | 服务端确认后的发送方最终 ID |
| `receiver_msg_id` | 接收方 `onMessagesReceived` | 接收端本地落库后的消息 ID，可能与发送方最终 ID 不同 |

因此接收方事件不能默认使用发送请求阶段的 `msgId` 严格匹配。成功后的消息 ID 应以发送完成事件返回的消息为准；接收方通常应优先使用 marker/content/from/to/chatType/convId 组合匹配。

## 目标

1. 让 E2E 只消费和断言属于当前 case 的事件。
2. 允许 SDK 事件早于 command response、晚于 response、乱序或重复到达。
3. 明确区分临时消息 ID、发送完成 ID、接收方消息 ID。
4. 对被忽略的事件保留可观测证据，便于 Allure 和日志定位。
5. 先以最小可用改造覆盖高风险 chat/message 用例，再逐步推广。
6. 保持真实 SDK E2E，不引入 mock、fixture 或本地替代实现。

## 非目标

1. 第一阶段不重写 `im_flutter_test` WebSocket 协议。
2. 第一阶段不要求所有平台一次性完成迁移。
3. 不把测试桥接、账号配置、REST 凭据、pytest 断言或报告逻辑混入发布 SDK 包。
4. 不用固定 sleep 作为核心解决方案。
5. 不默认把所有不匹配事件重新排队给后续 case 使用；跨 case 复用事件本身就是污染源。

## 核心设计

### 1. 增加谓词匹配等待能力

在 native-auto-test 测试工具层提供统一 helper：

```python
wait_event_matching(
    device,
    *,
    event_type: str,
    predicate: Callable[[dict], bool],
    timeout: float = 20.0,
    poll_timeout: float = 1.0,
    max_events: int = 50,
    description: str = "",
    ignored_limit: int = 20,
) -> dict
```

行为：

1. 循环调用 `device.receive_message(match_event_type=event_type, timeout=poll_timeout)`。
2. 收到事件后执行 `predicate(event)`。
3. 命中则返回该事件。
4. 未命中则记录到 `ignored_events`，继续等待。
5. 到达总超时或 `max_events` 后抛出 `AssertionError`。
6. 失败信息必须包含：
   - `event_type`
   - `description`
   - timeout/max_events
   - ignored event 数量
   - 最近 N 条 ignored event 摘要

事件摘要字段建议包括：

```text
eventType, from, to, convId, chatType, msgId, status, body.type, body.content, operation
```

如果 Allure 可用，同时 attach compact JSON，避免失败报告只剩一条断言文本。

### 2. Chat/message 专用 matcher

在 `tests/chat/_message_helpers.py` 内扩展消息级 helper：

```python
wait_for_success_message(
    device,
    *,
    from_user: str,
    to_user: str,
    marker: str,
    chat_type: int = 0,
    min_status: int = 2,
) -> dict

wait_for_received_message(
    device,
    *,
    from_user: str,
    to_user: str,
    marker: str,
    chat_type: int = 0,
) -> dict
```

匹配规则：

- 发送成功事件：
  - `eventType == onMessageSuccess`
  - `msg.from == from_user`
  - `msg.to == to_user`
  - 单聊时 `msg.convId == to_user`
  - 群聊时 `msg.convId == group_id`
  - `msg.chatType == chat_type`
  - `body.content == marker` 或可识别字段包含 marker
  - `status >= min_status`
  - 返回成功阶段消息，作为 `final_msg`
- 接收消息事件：
  - `eventType == onMessagesReceived`
  - 遍历 `data.messages`
  - `msg.from == from_user`
  - `msg.to == to_user` 或群聊语义下 `msg.to == group_id`
  - 单聊接收方 `msg.convId == from_user`
  - 群聊接收方 `msg.convId == group_id`
  - `msg.chatType == chat_type`
  - `body.content == marker` 或可识别字段包含 marker
  - 返回接收方消息，作为 `receiver_msg`

### 3. case marker 规范

每个会产生消息事件的 case 必须有 run 内唯一 marker。

推荐格式：

```python
marker = f"{case_prefix}-{uuid.uuid4().hex[:6]}"
```

规则：

- 文本消息：marker 放在 `body.content`。
- CMD/custom 消息：marker 放在 action、content 或 ext 中可回读字段。
- 图片/语音/文件等媒体消息：优先放在 `displayName`、`fileName`、`ext` 或测试封装可回读字段；如果平台不支持 ext，则 spec 中记录平台限制并用其他稳定字段补足。
- 群组/thread/reaction/pin 等非普通消息操作：必须保留能回查当前 case 的 marker，例如 parent message content、operation target message content、operation 类型组合。

禁止只用 `eventType` 或只用临时 `msgId` 作为消息事件归属依据。

### 4. msgId 使用规范

发送链路必须显式区分：

```python
send_resp = device_a.call(...)
success_msg = wait_for_success_message(...)
final_msg_id = success_msg["msgId"]
received_msg = wait_for_received_message(...)
receiver_msg_id = received_msg["msgId"]
```

规则：

- `send_resp` 中的请求阶段 ID 只能作为 `temp_msg_id`。
- 需要服务端已确认消息时，使用 `success_msg.msgId`。
- 接收方本地操作如果要求接收端消息对象，使用 `received_msg.msgId`。
- 不能用 `temp_msg_id` 断言接收方 `onMessagesReceived`。
- 查询历史、pin、reaction、thread parent 等涉及服务端状态的操作，应优先使用发送成功后的 `final_msg_id`，必要时结合 marker 二次校验。

### 5. 事件消费策略

默认策略：不匹配当前 predicate 的事件视为当前 wait 的 ignored event，不返回给当前 case。

原因：

- 如果重新排队，旧污染事件会一直挡在 buffer 前面，导致后续 wait 反复命中旧事件。
- 如果跨 case 复用旧事件，无法证明事件属于当前 case。
- 当前 case 的目标事件应由 marker 和上下文唯一定位，而不是依赖队列顺序。

例外：

- 低层 WebSocket listener 行为测试可以直接验证 buffer/requeue 机制。
- 非消息类事件如果确实需要保留广义事件，可实现专用 predicate 和专用 helper，而不是使用裸 `receive_message`。

### 6. drain 策略

`drain_events()` 只能作为降低历史积压的辅助手段，不能作为事件隔离的核心。

推荐：

- 登录完成、建立新连接后可以 drain 一次。
- case 开始前可短暂 drain 旧事件，但之后所有关键事件仍必须通过 predicate 匹配。
- 不允许用长时间 drain 或 sleep 掩盖匹配不足。

## 用例迁移规则

### 必须迁移

以下模式必须替换：

```python
device.receive_message(match_event_type=Cmd.onMessageSuccess.value)
device.receive_message(match_event_type=Cmd.onMessagesReceived.value)
request_and_wait_for_event(..., event_type=...)
```

如果这些调用出现在 chat/message、group、thread、conversation mark、pin、reaction、history、media 等 case 中，必须改为 predicate helper。

### 可以保留

以下场景可以保留直接 receive：

- 测试 WebSocket listener 自身行为。
- 测试“是否产生某类事件”的低层协议 case，但必须在 case 名称和断言中明确不校验消息归属。
- 非消息类事件暂未定义 matcher 时，可临时保留，但要在迁移清单中登记。

### 静态扫描

新增扫描脚本或 pytest unit，检查高风险裸调用：

```text
tests/chat/**/*.py
tests/group/**/*.py
tests/contact/**/*.py
```

扫描命中后需要人工判定：

- 已迁移：使用 helper。
- 允许保留：添加注释或 allowlist。
- 待迁移：记录到 spec checklist。

## 实施阶段

### Phase 1：框架 helper

范围：

- 新增通用 `wait_event_matching`。
- 新增 ignored event 摘要能力。
- 为 `_message_helpers.py` 补齐文本消息 success/received helper。
- 增加 unit tests 覆盖：
  - 先收到旧 `onMessageSuccess`，再收到目标事件。
  - 先收到外部账号消息，后收到当前 marker 消息。
  - 只收到 `status=0` 时，`min_status=2` 不应通过。
  - 超时错误包含 ignored event 摘要。

验收：

- 本地 unit tests 通过。
- helper 失败信息能直接看出被忽略事件的 content/from/to/msgId/status。

### Phase 2：高风险文本链路迁移

范围：

- `test_chat_non_message_operations.py`
- `test_chat_manager_remaining_api_coverage.py`
- `test_chat_message_callbacks_and_combine.py`
- `test_chat_load_messages_by_ids.py`
- `test_chat_local_keyword_search.py`

重点修复：

- history/pin/reaction/mark/thread parent 不再拿旧事件。
- 发送完成 ID 从 success event 返回。
- 接收方消息用 marker 匹配，不用 temp msgId。

验收：

- 不再出现 `s3-history` 收到 `s3-pin` 这类内容串 case。
- 不再因为 `status=0` 早期事件导致需要成功消息的 case 失败。

### Phase 3：media/sendWithType 迁移

范围：

- 图片、语音、视频、文件、location、cmd/custom 类型。

重点：

- 为每种消息体定义 marker 字段。
- 如果平台字段无法回读 marker，记录到能力策略或 case skip 原因，不能继续用不稳定事件顺序断言。

验收：

- media case 不再互相消费上一条 media event。
- 失败时能看到实际收到的 ignored media event 摘要。

### Phase 4：群组、thread、conversation 迁移

范围：

- group ack/read、group message receive。
- thread create/reply。
- conversation mark/fetch options。

重点：

- 群聊 matcher 使用 groupId 作为 convId/to 语义。
- thread parent 使用 `final_msg_id` 或 marker 回查。
- conversation 操作如果依赖消息，先通过 marker 定位目标消息。

验收：

- 群组 case 不再因 temp/final/receiver ID 混用失败。
- conversation case 不再在 case 逻辑前消费到无关消息后失败。

### Phase 5：全量回归和报告

执行：

```bash
cd native-auto-test
make e2e-full-run ARGS="--topology config/topologies/android-primary-dual-remote.yaml --device primary_a=emulator-5554 --device primary_b=emulator-5556 --device remote_c=emulator-5560 --run-id android-full-e2e-YYYYMMDD-NNNNNN --install-mode clean -- --target-platform android"
```

要求：

- 单独启动 Allure 服务。
- 把 Allure URL、pytest HTML URL、results 路径、report 路径返回给用户。
- 对失败分类：
  - SDK/服务端行为问题
  - case 预期问题
  - 参数问题
  - 环境/登录问题
  - 仍疑似事件污染

## 验收标准

### 功能验收

1. 所有迁移后的消息类 case 不再使用裸 `eventType` 等待作为核心断言。
2. 成功消息 ID 来源于 `onMessageSuccess` 的最终成功事件。
3. 接收方消息使用 marker/from/to/chatType/convId 匹配。
4. 旧事件、外部事件、早期 status 事件会被跳过并记录。
5. 失败报告里能看到被跳过事件摘要。

### 回归验收

Android-A/Android-B 全量 E2E 后：

- 不再出现明显跨 case 内容串，例如当前 case 预期 `s3-history-*` 实际收到 `s3-pin-*`。
- 不再出现大量 “还没跑到 case 位置，收消息就失败” 的情况。
- 剩余失败能被归类为真实 SDK 行为、case 预期、参数、权限或环境问题。

### 代码质量验收

1. helper 放在 `native-auto-test/` 测试工程内，不进入发布 SDK 包。
2. 新 helper 有 unit tests。
3. 迁移保持 case 可读性，不在每个 case 内复制复杂 predicate。
4. 静态扫描能发现新增裸 `receive_message(match_event_type=...)` 的高风险用法。

## 风险与处理

### 风险 1：忽略事件后，后续 case 是否还需要这些事件

消息类 case 不应依赖别的 case 的旧事件作为证据。被当前 predicate 忽略的事件如果不属于当前 marker，继续保留只会增加污染。低层 listener 测试可单独保留 buffer 行为验证。

### 风险 2：部分消息类型没有稳定 marker 字段

先以真实 SDK 返回字段为准。能用 content/displayName/ext 的优先使用；不能稳定回读的 case 要单独登记，不能继续用事件顺序冒充归属判断。

### 风险 3：改造范围扩大

完整治理会比较大。建议先落 Phase 1 和 Phase 2，优先消除当前 Android 全量里最明显的串事件失败，再扩展到 media/group/thread。

### 风险 4：账号仍会收到外部系统消息

predicate matcher 可以跳过外部消息，但如果外部消息量很大，会增加等待时间和失败噪音。长期应配合 run 级账号隔离、账号清理和环境隔离。

## 需要确认的问题

1. media 消息是否所有平台都支持 `ext` 或等价可回读字段。
2. 群聊接收方事件中 `to`、`convId` 在 Android/iOS/Web 是否完全一致。
3. `onMessageSuccess` 是否所有平台都保证最终成功事件 `status >= 2`，还是部分平台成功态取值不同。
4. 是否要把 high-risk 裸 receive 扫描作为 CI 必过项，还是先作为本地检查项。

## 建议优先级

1. 立即做：通用 predicate wait + ignored event 摘要。
2. 立即做：文本消息 success/received helper 统一返回 `final_msg` 和 `receiver_msg`。
3. 立即迁移：history/pin/conversation/thread/group 中已观察到串事件的 case。
4. 随后迁移：media/sendWithType。
5. 最后做：静态扫描和 CI 约束。
