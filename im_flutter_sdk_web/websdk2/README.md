# IM SDK Web 重构项目

## 项目结构

```text
websdk2/
├── .agent/
│   └── skills/            # 跨模型共用的项目级 skill
├── .codex/
│   └── prompts/           # Speckit 项目内 prompt
├── .cursor/
│   └── commands/          # Cursor 斜杠命令（9个命令文件）
│       ├── speckit.constitution.md     # 建立项目原则
│       ├── speckit.specify.md          # 明确功能需求
│       ├── speckit.plan.md             # 制定技术方案
│       ├── speckit.tasks.md            # 生成任务清单
│       ├── speckit.implement.md        # 开始实现
│       └── ... (其他增强命令)
├── .specify/
│   ├── memory/
│   │   └── constitution.md  # 项目原则（已填充）
│   ├── templates/          # 各种文档模板
│   └── scripts/            # 自动化脚本
├── specs/
│   └── 001-im-sdk-refactor/  # 功能规格文档
│       ├── spec.md          # 功能需求规格
│       ├── plan.md          # 技术实现方案
│       ├── tasks.md         # 任务清单
│       ├── data-model.md    # 数据模型设计
│       ├── contracts/       # API 契约
│       └── quickstart.md    # 快速开始指南
├── plans/
│   ├── active/             # 跨 feature 的进行中计划
│   └── archive/            # 历史计划归档
└── README.md
```

## 文档目录说明

- `docs/architecture/`
  - 项目架构、协议、缓存、跨平台适配
- `docs/testing/`
  - 测试架构、测试分层、真实环境说明
- `docs/reference/`
  - API 对照、错误码、命名规范、参考资料
- `docs/process/`
  - Spec-Kit、协作流程、代码修改指南
- `docs/decisions/`
  - 重要设计决策与方案留档
- `plans/active/`
  - 当前进行中的跨功能计划
- `plans/archive/`
  - 已完成或仅需留档的历史计划

补充约定：

- 新功能正式方案优先写入 `specs/<feature-id>/plan.md`
- 只有跨 feature 的临时执行计划才写入 `plans/active/`

当前常用入口：

- 架构总览：`docs/architecture/project-structure.md`
- 测试架构：`docs/testing/testing-architecture.md`
- 测试策略：`docs/testing/testing-layered-strategy.md`
- 测试环境：`docs/testing/testing-layered-env.md`
- 命名规范：`docs/reference/sdk-naming-conventions.md`
- 项目速览：`docs/process/project-summary.md`

## Spec-Kit 命令速查

- `/speckit.constitution` - 建立项目原则
- `/speckit.specify` - 明确功能需求
- `/speckit.plan` - 制定技术方案
- `/speckit.tasks` - 生成任务清单
- `/speckit.implement` - 开始实现
- `/speckit.clarify` - 在规划前澄清模糊点
- `/speckit.analyze` - 检查一致性
- `/speckit.checklist` - 生成质量检查清单

## 测试分层命令（023）

- `npm run test:gate:pr`：PR 快速门禁（单元 + mock-only 集成）
- `npm run test:gate:nightly`：定时全量门禁（含 E2E）
- `npm run test:gate:release`：发布前门禁（含最近 E2E 通过记录校验）
- `npm run test:smoke:real-env`：独立执行真实环境 smoke
- `npm run test:e2e`：独立执行浏览器端 E2E

更多说明见：`docs/testing/testing-architecture.md`、`docs/testing/testing-layered-strategy.md`、`docs/testing/testing-layered-env.md`

## 消息会话字段迁移（037）

公开 `Message` 与 `chatManager.createXMessage` 入参不再使用 `channel`。原来的
`channel.channelId` / `channel.type` 迁移为顶层 `conversationId` /
`conversationType`：

```ts
const message = client.chatManager.createTextMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  content: 'hello',
});
```

类型映射关系：`single` -> `singleChat`，`group` -> `groupChat`，`room` ->
`chatRoom`。本次不兼容旧 `channel` 字段，升级方需要同步改造消息创建、
消息事件读取、附件上传和合并消息子项等所有公开消息对象用法。

## 项目级 Skill

仓库内置了 6 个项目级 skill，位置在 `.agent/skills/`：

- `project-onboarding`
  - 适用于完全不了解工程时的快速上手、模块定位、测试入口说明
- `speckit-feature-workflow`
  - 适用于写 spec、出 plan、拆 tasks、按 Speckit 落地
- `test-layer-enforcer`
  - 适用于设计测试方案、补测试、判断单测/集成/契约/E2E/类型测试覆盖范围
- `real-env-test-runner`
  - 适用于判断该跑 mock 还是真实环境、检查 real-env 所需变量、分析真实环境测试失败原因
- `test-command-runner`
  - 适用于按统一命令执行单测、集成测试、覆盖率、门禁，并返回结果摘要
- `release-change-check`
  - 适用于改动收尾、版本号/CHANGELOG/验证/提交前检查

如果当前使用的 AI 工具不自动发现项目级 skill，也可以直接让它读取对应的 `SKILL.md` 文件执行。

建议约定：

- 项目级、跨模型共用的 skill 统一放 `.agent/skills/`
- Codex 专用流程继续放 `.codex/prompts/`
- 为了便于人工确认是否命中，建议命中 skill 后先显式输出一句：`本次命中 skill: <skill-name>`

## 对外 AI Skill 安装

如果你是 `im-sdk-web` 的使用者，而不是本仓库维护者，推荐使用独立 AI kit 包把接入 guidance 和排障 guidance 安装到你的项目：

```bash
npx @easemob/im-sdk-web-ai-kit init
npx @easemob/im-sdk-web-ai-kit update
npx @easemob/im-sdk-web-ai-kit remove
npx @easemob/im-sdk-web-ai-kit doctor
```

当前支持：

- `cursor`：安装到 `.cursor/rules/`
- `codex`：安装到 `.codex/prompts/`
- `agent`：安装到 `.agent/skills/`

如果你是本仓库维护者，AI kit 子包的发布检查命令为：

```bash
npm run release:ai-kit:check
npm run release:ai-kit:pack:dry-run
npm run release:ai-kit:publish:dry-run
```

该包默认显式安装，不会在 `npm install` 时自动改写你的项目目录。

---

## 开发流程说明

### 一、Spec-Kit 规范驱动开发流程

本项目采用 **Spec-Kit（规范驱动开发）** 工作流，通过结构化的文档引导 AI 生成高质量代码。

#### 1.1 工作流程概览

```
需求 → Constitution（原则） → Spec（规格） → Plan（方案） → Tasks（任务） → Implement（实现）
```

**详细流程**：

1. **建立原则** (`/speckit.constitution`)
   - 定义项目的核心原则和约束
   - 文件：`.specify/memory/constitution.md`
   - 示例：性能优先、类型安全、测试驱动等

2. **明确需求** (`/speckit.specify`)
   - 描述功能需求，生成功能规格文档
   - 文件：`specs/[编号]-[功能名]/spec.md`
   - 包含：用户场景、功能需求、成功标准

3. **制定方案** (`/speckit.plan`)
   - 基于规格生成技术实现方案
   - 文件：`specs/[编号]-[功能名]/plan.md`
   - 包含：技术栈、架构设计、数据模型、API 契约

4. **生成任务** (`/speckit.tasks`)
   - 将方案拆解为可执行任务
   - 文件：`specs/[编号]-[功能名]/tasks.md`
   - 按用户故事组织，支持并行执行

5. **开始实现** (`/speckit.implement`)
   - AI 按照任务清单逐步实现代码
   - 遵循 TDD 流程（先写测试，再实现）

#### 1.2 Spec-Kit 使用方式

**方式一：使用命令生成（推荐）**

在 Cursor 聊天窗口输入命令，AI 会自动生成文档：

```bash
# 1. 建立原则
/speckit.constitution
# 然后描述你的项目原则，AI 会生成 constitution.md

# 2. 明确需求
/speckit.specify 我要实现一个消息发送功能，支持文本和图片
# AI 会生成 spec.md

# 3. 制定方案
/speckit.plan
# AI 会基于 spec.md 生成 plan.md

# 4. 生成任务
/speckit.tasks
# AI 会基于 plan.md 和 spec.md 生成 tasks.md

# 5. 开始实现
/speckit.implement
# AI 会按照 tasks.md 逐步实现代码
```

**方式二：手动编写文档**

你也可以直接在 `specs/` 目录下手动创建和编辑文档：

```bash
specs/
└── 001-im-sdk-refactor/
    ├── spec.md          # 手动编写功能需求
    ├── plan.md          # 手动编写技术方案
    └── tasks.md          # 手动编写任务清单
```

**方式三：AI 辅助编写**

1. 手动创建文件框架
2. 在 Cursor 中打开文件
3. 告诉 AI："帮我填充这个文档，基于 constitution.md 的原则"
4. AI 会帮你完善文档内容

#### 1.3 手动编写 specs 文件是否生效？

**答案：完全生效！**

Spec-Kit 的核心是**文档驱动**，而不是命令驱动。无论文档是如何创建的：

- ✅ 使用 `/speckit.specify` 命令生成
- ✅ 手动创建和编写
- ✅ AI 辅助编写
- ✅ 从其他项目复制后修改

只要文档在 `specs/` 目录下，且格式符合模板要求，所有后续命令（`/speckit.plan`、`/speckit.tasks`、`/speckit.implement`）都会读取这些文档并基于它们工作。

**建议**：

- 新功能：使用命令生成，更规范
- 已有功能：可以手动编写或复制修改
- 复杂需求：先手动写框架，再用 AI 完善

---

## 二、MSync Protobuf 收发与消息格式开发指南

### 2.1 收发与握手流程（MSync）

- WebSocket `onopen` 后发送 provision（token 鉴权）
- provision 回包成功后进入 `connected`
- `onmessage` 解码 MSync：`PROVISION` 走鉴权处理，`SYNC` 走消息分发
- `SYNC` payload 解析出 ACK 与消息：ACK 用于 resolve 发送 Promise，消息触发 `onMessage`

### 2.2 已支持消息类型与未实现范围

**已支持发送/接收**（当前阶段）：

- `text`
- `cmd`
- `custom`
- `image` / `file` / `voice` / `video`
- `location`

**附件发送说明（当前实现）**：

- `image` / `file` / `voice` / `video` 发送前自动上传，成功后补齐 `url/secret/fileLength`
- `url` 为远程地址且 `data` 缺失时，跳过上传直接发送
- 仅支持浏览器 `File` 上传（小程序/uniapp 文件对象暂未支持）

**未实现范围（本阶段）**：

- 附件上传的断点续传/暂停/秒传/去重
- 消息去重/本地缓存与回执合并
- 聊天室/群组通过消息实现的内部 API（加入/退出等）
- 离线消息/未读数同步
- 加密/压缩、心跳等增强能力

### 2.3 消息格式与编解码位置

消息格式定义在以下文件中：

```
src/
├── protocol/
│   └── msync/
│       ├── proto.ts            # protobuf 协议定义（从原工程同步）
│       ├── types.ts            # 命令/消息类型常量
│       └── codec.ts            # 编码/解码核心逻辑
├── types/
│   └── index.ts                # Message 接口定义（TypeScript）
└── core/
    ├── connection/
    │   └── connection-manager.ts  # WebSocket + provision
    └── message/
        ├── message-sender.ts   # 消息发送逻辑
        └── message-receiver.ts  # 消息接收逻辑
```

> `proto.ts` 来自原工程 proto 定义，建议先在原工程修改并同步。

### 2.4 场景一：代码未实现时，自定义消息格式

**步骤**：

1. **修改 protobuf 定义** (`src/protocol/msync/proto.ts`)

   ```protobuf
   syntax = "proto3";

   message CustomMessage {
     string id = 1;
     string senderId = 2;
     string receiverId = 3;
     MessageType type = 4;
     bytes content = 5;
     int64 timestamp = 6;
   // 添加你的自定义字段
   string customField = 7;
   map<string, string> customData = 8;
   }
   ```

````

2. **更新 TypeScript 类型** (`src/types/index.ts`)
 ```typescript
 export interface Message {
   id: string;
   senderId: string;
   receiverId?: string;
   type: MessageType;
   content: string | Uint8Array;
   timestamp: number;
// 添加你的自定义字段
   customField?: string;
   customData?: Record<string, string>;
 }
````

3. **更新消息类型枚举** (`src/protocol/msync/types.ts`)

   ```typescript
   export enum MessageType {
     TEXT = 'text',
     IMAGE = 'image',
     // 添加你的自定义类型
     CUSTOM = 'custom',
   }
   ```

4. **更新编解码器** (`src/protocol/msync/codec.ts`)
   - 确保新字段在编码/解码时正确处理

5. **更新相关文档**
   - `specs/001-im-sdk-refactor/data-model.md` - 更新 Message 实体定义
   - `specs/001-im-sdk-refactor/contracts/api.md` - 更新 API 接口定义

### 2.5 场景二：代码已实现，需要修改消息格式

**推荐方式：先改文档，再让 AI 改代码**

#### 步骤 1：更新规格文档

1. **更新数据模型文档** (`specs/001-im-sdk-refactor/data-model.md`)

   ```markdown
   ### 1. Message (消息)

   **属性**:

   - `id: string` - 消息唯一标识符
   - `customField: string` - 你的自定义字段（新增）
   - `customData: Record<string, string>` - 你的自定义数据（新增）
   ```

2. **更新 API 契约** (`specs/001-im-sdk-refactor/contracts/api.md`)

   ```typescript
   interface Message {
     // ... 现有字段
     customField?: string; // 新增
     customData?: Record<string, string>; // 新增
   }
   ```

3. **更新任务清单**（如果需要）(`specs/001-im-sdk-refactor/tasks.md`)
   - 添加新任务：更新消息格式以支持自定义字段

#### 步骤 2：让 AI 基于文档修改代码

在 Cursor 聊天窗口告诉 AI：

```
根据 specs/001-im-sdk-refactor/data-model.md 中的更新，
我需要修改消息格式，添加 customField 和 customData 字段。
请更新以下文件：
1. src/protocol/msync/proto.ts
2. src/types/index.ts
3. src/protocol/msync/codec.ts
4. src/protocol/msync/types.ts
5. 相关的测试文件
```

AI 会：

- 读取文档了解变更
- 修改所有相关代码文件
- 更新测试用例
- 确保类型一致性

**为什么不直接改代码？**

1. **文档是单一数据源**：文档定义了"应该是什么"，代码是"实际实现"
2. **AI 理解上下文**：基于文档，AI 能理解变更的完整影响范围
3. **保持一致性**：文档和代码同步更新，避免不一致
4. **可追溯性**：文档记录了变更原因和设计决策

### 2.6 场景三：快速修改（不推荐，但可行）

如果只是小改动，也可以直接改代码，但**必须同步更新文档**：

1. 直接修改代码文件
2. 立即更新 `data-model.md` 和 `contracts/api.md`
3. 运行测试确保没有破坏性变更

---

## 三、开发最佳实践

### 3.1 文档优先原则

1. **先写文档，再写代码**
   - 需求变更 → 先更新 `spec.md`
   - 设计变更 → 先更新 `plan.md`
   - 实现变更 → 先更新 `tasks.md`

2. **文档是唯一数据源**
   - 代码应该反映文档
   - 文档应该反映实际需求

3. **保持文档同步**
   - 代码变更后，及时更新文档
   - 使用 `/speckit.analyze` 检查一致性

### 3.2 使用 AI 辅助开发

1. **明确上下文**

   ```
   根据 specs/001-im-sdk-refactor/tasks.md 中的任务 T025，
   实现消息发送功能。
   ```

2. **引用文档**

   ```
   参考 specs/001-im-sdk-refactor/data-model.md 中的 Message 定义，
   实现消息存储功能。
   ```

3. **检查一致性**
   ```
   使用 /speckit.analyze 检查代码实现是否与 plan.md 一致。
   ```

### 3.3 版本控制

1. **文档和代码一起提交**

   ```bash
   git add specs/001-im-sdk-refactor/
   git add src/
   git commit -m "feat: 添加自定义消息格式支持"
   ```

2. **文档变更单独提交**（如果先改文档）
   ```bash
   git add specs/001-im-sdk-refactor/data-model.md
   git commit -m "docs: 更新消息格式定义，添加自定义字段"
   ```

---

## 四、常见问题

### Q1: 我可以跳过某些步骤吗？

**可以，但有限制**：

- ✅ 可以手动编写 `spec.md`，然后使用 `/speckit.plan`
- ✅ 可以手动编写 `plan.md`，然后使用 `/speckit.tasks`
- ❌ 不建议跳过 `constitution.md`，它是所有决策的基础

### Q2: 文档格式必须严格遵循模板吗？

**建议遵循，但不是必须**：

- 模板提供了最佳实践
- 只要包含关键信息（用户故事、需求、技术方案），AI 就能理解
- 但遵循模板能让 AI 更好地理解和生成代码

### Q3: 如果我不使用 Spec-Kit 命令，手动写文档可以吗？

**完全可以**：

- Spec-Kit 的核心是文档驱动
- 只要文档在 `specs/` 目录下，格式合理，所有工具都能工作
- 命令只是帮助生成文档的工具，不是必须的

### Q4: 如何添加新功能？

1. 创建新的功能目录：`specs/002-[功能名]/`
2. 使用 `/speckit.specify` 或手动编写 `spec.md`
3. 使用 `/speckit.plan` 生成技术方案
4. 使用 `/speckit.tasks` 生成任务清单
5. 使用 `/speckit.implement` 开始实现

### Q5: 如何修改已有功能？

1. **需求变更**：更新 `spec.md`
2. **设计变更**：更新 `plan.md` 和 `data-model.md`
3. **实现变更**：
   - 小改动：直接改代码，同步更新文档
   - 大改动：更新 `tasks.md`，让 AI 基于任务清单修改代码

---

## 五、快速参考

### 修改消息格式的完整流程

```bash
# 1. 更新数据模型文档
vim specs/001-im-sdk-refactor/data-model.md
# 添加新字段说明

# 2. 更新 API 契约
vim specs/001-im-sdk-refactor/contracts/api.md
# 更新 Message 接口定义

# 3. 在 Cursor 中告诉 AI
"根据 data-model.md 的更新，修改消息格式实现，添加新字段"

# 4. AI 会自动更新：
# - src/protocol/msync/proto.ts
# - src/types/index.ts
# - src/protocol/msync/codec.ts
# - src/protocol/msync/types.ts
# - 相关测试文件

# 5. 运行测试
npm test

# 6. 提交变更
git add .
git commit -m "feat: 添加自定义消息字段"
```

---

## 事件系统（addEventHandler）

使用 `addEventHandler/removeEventHandler` 一次性注册/移除一组事件，适合 React `useEffect` 清理场景。

```ts
import { ChatClient } from 'websdk2';

const client = ChatClient.init({ appKey: 'your-app-key' });

client.addEventHandler('ui', {
  onConnecting: () => console.log('connecting'),
  onConnected: () => console.log('connected'),
  onDisconnected: () => console.log('disconnected'),
  onMessage: msg => console.log('message', msg),
});

// 使用完毕移除
client.removeEventHandler('ui');
```

---

## 六、真实环境 Smoke（可选）

> 需要网络访问与有效账号。该入口不属于集成门禁，只用于独立 smoke / 联调验证。

### 6.1 `.env` 配置

在项目根目录创建 `.env`（已在 `.gitignore` 中忽略），参考 `.env.example`：

```
EASEMOB_APPKEY=你的appkey
EASEMOB_USERID=你的用户id
EASEMOB_TOKEN=你的token
EASEMOB_TARGET_ID=可选，默认发送给自己
EASEMOB_EXPECT_INBOUND=可选，1 表示必须收到 onMessage
```

### 6.2 运行真实环境 smoke

```
npm run test:smoke:real-env
```

### 6.3 获取 token（示例）

```
curl 'https://a1.easemob.com/easemob-demo/chatdemoui/token' \
  -H 'accept: */*' \
  -H 'accept-language: zh,en;q=0.9,zh-CN;q=0.8,ja;q=0.7' \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json' \
  -H 'origin: https://uikit-demo.oss-cn-beijing.aliyuncs.com' \
  -H 'pragma: no-cache' \
  -H 'priority: u=1, i' \
  -H 'referer: https://uikit-demo.oss-cn-beijing.aliyuncs.com/' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: cross-site' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  --data-raw '{"grant_type":"password","username":"zd1","password":"1","timestamp":1769136182183}'
```

---

## 七、总结

1. **Spec-Kit 是文档驱动**：文档是核心，命令只是工具
2. **文档优先**：先改文档，再让 AI 改代码
3. **手动编写完全可行**：不依赖命令，只要文档格式正确
4. **保持同步**：文档和代码必须保持一致
5. **利用 AI**：让 AI 基于文档理解上下文，自动修改代码

---

## 相关文档

- [项目原则](./.specify/memory/constitution.md)
- [功能规格](./specs/001-im-sdk-refactor/spec.md)
- [技术方案](./specs/001-im-sdk-refactor/plan.md)
- [任务清单](./specs/001-im-sdk-refactor/tasks.md)
- [数据模型](./specs/001-im-sdk-refactor/data-model.md)
- [API 契约](./specs/001-im-sdk-refactor/contracts/api.md)
- [快速开始](./specs/001-im-sdk-refactor/quickstart.md)
