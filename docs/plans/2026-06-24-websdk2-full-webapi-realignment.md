# WebSDK2 全量 Web API 重对齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 `websdk2` 完整工程与生成出的中文 API 文档，重新核对全部 Web API 的公开能力、Flutter Web adapter 实现、真实 E2E case、coverage 统计与中文报告，确保实现、覆盖、统计、case 四层结论一致。

**Architecture:** 先建立“文档 API -> Flutter Web adapter -> coverage -> case”四向映射基线，再按 manager 分批校正。每一批都以真实 E2E 为准，不接受只改统计或只改实现。所有 blocked 只保留两类测试结论：`API未对齐iOS/Android` 与 `API执行未通过`。

**Tech Stack:** websdk2、Node/npm、TypeScript API 文档生成脚本、Flutter/Dart、Python pytest、WebSocket 驱动的 `native-auto-test`

---

## 文件结构与责任

- `im_flutter_sdk_web/websdk2/`
  - Web SDK 5.0.0 源码工程与官方 API 文档生成入口。
- `im_flutter_sdk_web/lib/src/managers/*.dart`
  - Flutter Web manager 层，负责 method key 到 Web SDK 能力映射。
- `im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`
  - 真实 Web SDK 调用封装层。
- `native-auto-test/config/web_real_e2e_coverage.yaml`
  - Web 真实 E2E 覆盖源数据。
- `native-auto-test/tests/web_real/*.py`
  - Web 真实 E2E 用例。
- `native-auto-test/docs/agents/web/*.md`
  - 中文覆盖矩阵、覆盖报告、no-real-api 审计与基线报告。
- `native-auto-test/src/tools/web_real_e2e_*.py`
  - 覆盖与报告生成脚本。

---

### Task 1: 固定文档与审计输入基线

**Files:**
- Modify: `im_flutter_sdk_web/websdk2/docs/reference/api-reference.zh-CN.md`
- Modify: `im_flutter_sdk_web/websdk2/docs-site/api/zh-CN/**`（如生成）
- Modify: `docs/plans/2026-06-24-websdk2-full-webapi-realignment.md`

- [ ] **Step 1: 重新生成中文 API markdown 文档**

Run:

```bash
cd /Users/dujiepeng/work/qa/hub_all/im_flutter_sdk/im_flutter_sdk_web/websdk2
npm run docs:api:md:zh
```

Expected:
- 生成或更新 `docs/reference/api-reference.zh-CN.md`
- 命令退出码为 0

- [ ] **Step 2: 视需要生成中文 HTML API 文档**

Run:

```bash
cd /Users/dujiepeng/work/qa/hub_all/im_flutter_sdk/im_flutter_sdk_web/websdk2
npm run docs:api:html:zh
```

Expected:
- 生成或更新 `docs-site/api/zh-CN`
- 命令退出码为 0

- [ ] **Step 3: 记录当前文档工程缺口**

需要记录但不在本任务中修复：
- `docs/intergration` 是否存在
- JIRA 中提供的集成文档路径是否与实际工程一致

- [ ] **Step 4: 提交本阶段产物**

```bash
git add im_flutter_sdk_web/websdk2/docs/reference/api-reference.zh-CN.md
git add im_flutter_sdk_web/websdk2/docs-site/api/zh-CN 2>/dev/null || true
git add docs/plans/2026-06-24-websdk2-full-webapi-realignment.md
git commit -m "docs: refresh websdk2 zh api reference baseline"
```

---

### Task 2: 建立四向映射基线表

**Files:**
- Create: `docs/specs/websdk2-webapi-mapping-2026-06-24.md`
- Modify: `native-auto-test/config/web_real_e2e_coverage.yaml`

- [ ] **Step 1: 从文档抽取 manager/API 清单**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
p = Path('/Users/dujiepeng/work/qa/hub_all/im_flutter_sdk/im_flutter_sdk_web/websdk2/docs/reference/api-reference.zh-CN.md')
text = p.read_text(encoding='utf-8')
current = None
out = []
for line in text.splitlines():
    if line.startswith('## src/managers/') and line.endswith('.ts'):
        current = line.split('/')[-1].replace('.ts','')
    elif line.startswith('### ') and '=>' in line and current:
        sig = line[4:].strip()
        name = sig.split('(')[0].strip()
        out.append((current, name, sig))
print(len(out))
for item in out:
    print('\t'.join(item))
PY
```

Expected:
- 输出 Web SDK 文档公开 API 清单
- 该清单作为后续映射输入

- [ ] **Step 2: 建立映射文档骨架**

在 `docs/specs/websdk2-webapi-mapping-2026-06-24.md` 中按 manager 写出表格：

```md
| 文档 Manager | 文档 API | Flutter method key / manager | interop 方法 | coverage 状态 | case | 结论 |
|---|---|---|---|---|---|---|
```

- [ ] **Step 3: 先填满 GroupManager 与 ChatManager**

至少先覆盖：
- `group.*`
- `chat-manager.*`

Expected:
- 能看出文档 API 与当前 Flutter Web 侧的第一批差异

- [ ] **Step 4: 提交本阶段产物**

```bash
git add docs/specs/websdk2-webapi-mapping-2026-06-24.md
git commit -m "docs: add websdk2 web api mapping baseline"
```

---

### Task 3: 定义统一判定规则并固化到文档

**Files:**
- Modify: `docs/specs/websdk2-webapi-mapping-2026-06-24.md`
- Modify: `native-auto-test/docs/agents/web/WEB_REAL_E2E_COVERAGE_REPORT.md`

- [ ] **Step 1: 在映射文档中加入四类差异桶**

四类桶必须固定为：
- 文档已公开，adapter 未接
- adapter 已接，但方法名/层级/参数语义不对
- adapter 已接，但 coverage 状态不对
- coverage 状态对，但 case/断言不足

- [ ] **Step 2: 固化 blocked 测试口径**

只允许：
- `API未对齐iOS/Android`
- `API执行未通过`

- [ ] **Step 3: 把判定规则补进报告生成逻辑需要遵守的说明**

如果报告里已体现，无需大改代码；如果规则和现有生成逻辑冲突，后续任务再修脚本。

- [ ] **Step 4: 提交本阶段产物**

```bash
git add docs/specs/websdk2-webapi-mapping-2026-06-24.md
git add native-auto-test/docs/agents/web/WEB_REAL_E2E_COVERAGE_REPORT.md
git commit -m "docs: define web api realignment classification rules"
```

---

### Task 4: 优先重审 GroupManager 全组

**Files:**
- Modify: `im_flutter_sdk_web/lib/src/managers/group_manager_web.dart`
- Modify: `im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`
- Modify: `native-auto-test/tests/web_real/test_real_web_conversation_manager.py`
- Modify: `native-auto-test/config/web_real_e2e_coverage.yaml`

- [ ] **Step 1: 核对文档公开能力与当前 adapter 的差异**

重点先查：
- `muteAllMembers`
- `unmuteAllMembers`
- `blockGroup`
- `unblockGroup`
- `uploadSharedFile`
- `downloadSharedFile`

- [ ] **Step 2: 先修 `muteAllMembers / unMuteAllMembers`**

要求：
- 按文档公开层级确认真实调用方式
- 不再保留“Web 无公开 API”旧结论
- 以真实 E2E 为准决定 supported 或继续 blocked

- [ ] **Step 3: 为 `muteAllMembers / unMuteAllMembers` 增补或修正真实用例**

建议扩展现有：
- `tests/web_real/test_real_web_conversation_manager.py::test_real_web_group_mute_list_server_state`

断言至少覆盖：
- 开启全员禁言后，详情或服务端读回显示全员禁言状态
- 关闭全员禁言后，该状态恢复

- [ ] **Step 4: 跑最小回归**

Run:

```bash
python3 -m src.tools.web_e2e_runner \
  --run-id web-real-group-mute-all-realign \
  --web-sdk-mode real_sdk \
  --headless-startup-wait 150 \
  --startup-timeout 240 \
  --flutter-timeout 300 \
  -- tests/web_real/test_real_web_conversation_manager.py::test_real_web_group_mute_list_server_state \
  --target-platform web -q
```

Expected:
- 明确得到 pass 或稳定失败证据

- [ ] **Step 5: 提交本阶段产物**

```bash
git add im_flutter_sdk_web/lib/src/managers/group_manager_web.dart
git add im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart
git add native-auto-test/tests/web_real/test_real_web_conversation_manager.py
git add native-auto-test/config/web_real_e2e_coverage.yaml
git commit -m "feat: realign group mute-all web api coverage"
```

---

### Task 5: 重审 ChatManager 全组

**Files:**
- Modify: `im_flutter_sdk_web/lib/src/managers/chat_manager_web.dart`
- Modify: `im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`
- Modify: `native-auto-test/tests/web_real/test_real_web_chat_server.py`
- Modify: `native-auto-test/tests/web_real/test_real_web_chat_smoke.py`
- Modify: `native-auto-test/config/web_real_e2e_coverage.yaml`

- [ ] **Step 1: 对照文档核 `chat-manager.*` 公开能力**

重点先查：
- `createCombineMessage`
- `downloadAndParseCombineMessage`
- `markConversationRead`
- `downloadAttachment`
- `searchMessages`
- `modifyMessage`
- `getSupportedTranslationLanguages`
- `translateMessage`

- [ ] **Step 2: 重新确认 `sendMessageWithType` 与 `combineMessage` 的边界**

要求：
- `txt` 与 `combine` 继续拆开判定
- 不能让 `txt` 支持外推成 `combine` 支持

- [ ] **Step 3: 逐项核 case 是否真的证明了文档语义**

例如：
- `getMessage`
- `loadMessagesWithIds`
- `getMessageCount`
- `searchMsgsByOptions`

如果只是“借真实 history 模拟出语义”，要在 mapping 文档里说明。

- [ ] **Step 4: 跑最小回归**

Run:

```bash
python3 -m src.tools.web_e2e_runner \
  --run-id web-real-chat-realign \
  --web-sdk-mode real_sdk \
  --headless-startup-wait 150 \
  --startup-timeout 240 \
  --flutter-timeout 300 \
  -- tests/web_real/test_real_web_chat_server.py \
  --target-platform web -q
```

- [ ] **Step 5: 提交本阶段产物**

```bash
git add im_flutter_sdk_web/lib/src/managers/chat_manager_web.dart
git add im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart
git add native-auto-test/tests/web_real/test_real_web_chat_server.py
git add native-auto-test/tests/web_real/test_real_web_chat_smoke.py
git add native-auto-test/config/web_real_e2e_coverage.yaml
git commit -m "feat: realign chat manager web api coverage"
```

---

### Task 6: 重审 ChatRoomManager 与 ChatThreadManager

**Files:**
- Modify: `im_flutter_sdk_web/lib/src/managers/chat_room_manager_web.dart`
- Modify: `im_flutter_sdk_web/lib/src/managers/chat_thread_manager_web.dart`
- Modify: `im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`
- Modify: `native-auto-test/tests/web_real/test_real_web_chat_room.py`
- Modify: `native-auto-test/tests/web_real/test_real_web_conversation_manager.py`
- Modify: `native-auto-test/config/web_real_e2e_coverage.yaml`

- [ ] **Step 1: 核对文档 API 与当前 blocked/support 状态**

重点：
- `createChatRoom`
- `changeChatRoomOwner`
- `onChatRoomChanged`
- `getChatThreadLastMessageList`
- 线程事件

- [ ] **Step 2: 区分“文档公开但执行失败”与“文档无对等能力”**

要求：
- 不能继续混成一个 blocked 原因

- [ ] **Step 3: 跑聊天室与线程最小回归**

Run:

```bash
python3 -m src.tools.web_e2e_runner \
  --run-id web-real-room-thread-realign \
  --web-sdk-mode real_sdk \
  --headless-startup-wait 150 \
  --startup-timeout 240 \
  --flutter-timeout 300 \
  -- tests/web_real/test_real_web_chat_room.py tests/web_real/test_real_web_conversation_manager.py \
  --target-platform web -q
```

- [ ] **Step 4: 提交本阶段产物**

```bash
git add im_flutter_sdk_web/lib/src/managers/chat_room_manager_web.dart
git add im_flutter_sdk_web/lib/src/managers/chat_thread_manager_web.dart
git add im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart
git add native-auto-test/tests/web_real/test_real_web_chat_room.py
git add native-auto-test/tests/web_real/test_real_web_conversation_manager.py
git add native-auto-test/config/web_real_e2e_coverage.yaml
git commit -m "feat: realign chatroom and thread web api coverage"
```

---

### Task 7: 重审事件类与剩余 manager

**Files:**
- Modify: `im_flutter_test/lib/bridge/event_bridge_handler.dart`
- Modify: `im_flutter_test/lib/bridge/im_websocket_bridge.dart`
- Modify: `native-auto-test/config/web_real_e2e_coverage.yaml`
- Modify: `native-auto-test/tests/web_real/*.py`

- [ ] **Step 1: 对照文档里的 event handler API**

重点核：
- 哪些事件在 Web SDK 文档中明确公开
- 哪些只是当前测试 bridge 本地合成

- [ ] **Step 2: 对 MessageManager / Unclassified 做一次统一重判**

要求：
- 不再沿用历史 bridge 直觉
- 以文档公开面 + 测试层真实透传证据为准

- [ ] **Step 3: 只对能形成真实 E2E 的事件补 case**

不能形成真实 E2E 的继续 blocked，但 reason 必须准确。

- [ ] **Step 4: 提交本阶段产物**

```bash
git add im_flutter_test/lib/bridge/event_bridge_handler.dart
git add im_flutter_test/lib/bridge/im_websocket_bridge.dart
git add native-auto-test/config/web_real_e2e_coverage.yaml
git add native-auto-test/tests/web_real
git commit -m "feat: realign web event api coverage and cases"
```

---

### Task 8: 全量重算统计并刷新中文报告

**Files:**
- Modify: `native-auto-test/docs/agents/web/WEB_REAL_E2E_API_MATRIX.md`
- Modify: `native-auto-test/docs/agents/web/WEB_REAL_E2E_COVERAGE_REPORT.md`
- Modify: `native-auto-test/docs/agents/web/WEB_REAL_E2E_NO_REAL_API_AUDIT.md`
- Modify: `native-auto-test/docs/agents/web/WEB_REAL_E2E_BASELINE.md`

- [ ] **Step 1: 刷新文档**

Run:

```bash
cd /Users/dujiepeng/work/qa/hub_all/im_flutter_sdk/native-auto-test
make web-real-docs
```

- [ ] **Step 2: 校验统计**

要求：
- `pending: 0`
- `supported / blocked / not_applicable` 与映射表一致
- `Supported 但需额外说明` 章节与实际语义一致

- [ ] **Step 3: 必要时更新全量基线**

Run:

```bash
make web-real-full-baseline
```

- [ ] **Step 4: 提交本阶段产物**

```bash
git add native-auto-test/docs/agents/web
git commit -m "docs: refresh full web real e2e reports after api realignment"
```

---

### Task 9: 最终校验与交付

**Files:**
- Modify: `docs/specs/websdk2-webapi-mapping-2026-06-24.md`
- Modify: `docs/plans/2026-06-24-websdk2-full-webapi-realignment.md`

- [ ] **Step 1: 跑静态校验**

Run:

```bash
cd /Users/dujiepeng/work/qa/hub_all/im_flutter_sdk
dart analyze im_flutter_sdk_web im_flutter_test
```

Expected:
- `No issues found!`

- [ ] **Step 2: 跑格式校验**

Run:

```bash
cd /Users/dujiepeng/work/qa/hub_all/im_flutter_sdk
git diff --check
```

Expected:
- 无空白错误

- [ ] **Step 3: 在映射文档中补最终总结**

必须写清：
- 文档公开但未支持的项
- 文档公开且已支持的项
- 文档无对等能力的项
- 当前 release 视角的高风险 blocked

- [ ] **Step 4: 提交本阶段产物**

```bash
git add docs/specs/websdk2-webapi-mapping-2026-06-24.md
git add docs/plans/2026-06-24-websdk2-full-webapi-realignment.md
git commit -m "docs: finalize full web api realignment audit"
```

