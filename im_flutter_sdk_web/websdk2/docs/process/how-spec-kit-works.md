# Spec-Kit 工作原理详解

## 一、核心问题回答

### Q1: Spec 是像 MCP 一样的标准协议吗？

**答案：不是。**

**区别对比**：

| 特性 | MCP (Model Context Protocol) | Spec-Kit |
|------|------------------------------|----------|
| **性质** | 标准协议（由 Anthropic 定义） | Cursor 自定义命令系统 |
| **作用** | AI 与外部工具/数据源的通信协议 | 项目内的文档驱动开发工作流 |
| **范围** | 跨项目、跨工具的标准接口 | 项目特定的开发流程 |
| **实现** | 需要实现 MCP 服务器 | Cursor 命令文件（`.cursor/commands/`） |
| **使用** | 通过 MCP 服务器提供资源 | 通过斜杠命令（`/speckit.xxx`） |

**Spec-Kit 的本质**：
- 是 **Cursor 的自定义命令系统**
- 通过 `.cursor/commands/speckit.*.md` 文件定义命令行为
- 不是标准协议，是项目特定的工作流工具

---

### Q2: AI 会自动读这些文件吗？

**答案：不会自动读取，需要明确调用命令。**

**工作原理**：

```
用户输入命令 → Cursor 执行命令文件 → AI 读取指定文件 → AI 执行操作
```

**示例**：

```bash
# 用户输入
/speckit.implement

# Cursor 执行流程：
1. 读取 .cursor/commands/speckit.implement.md（命令定义）
2. 执行命令中的 Outline（步骤）
3. AI 按照 Outline 读取指定文件：
   - tasks.md（必需）
   - plan.md（必需）
   - data-model.md（如果存在）
   - contracts/（如果存在）
   - research.md（如果存在）
   - quickstart.md（如果存在）
4. AI 基于读取的文件执行实现任务
```

**关键点**：
- ❌ AI **不会**自动读取 spec 文件
- ✅ 需要**明确调用命令**（`/speckit.implement`）
- ✅ 命令会**按照 Outline 读取指定文件**

---

### Q3: 怎么知道或控制读哪些不读哪些？

**答案：通过命令文件的 Outline 控制。**

**控制机制**：

#### 1. **命令文件定义读取规则**

每个命令文件（如 `.cursor/commands/speckit.implement.md`）都有一个 `Outline` 部分，定义了：
- 哪些文件是**必需的**（REQUIRED）
- 哪些文件是**可选的**（IF EXISTS）
- 读取的顺序和条件

**示例**（来自 `speckit.implement.md`）：

```markdown
## Outline

3. Load and analyze the implementation context:
   - **REQUIRED**: Read tasks.md for the complete task list and execution plan
   - **REQUIRED**: Read plan.md for tech stack, architecture, and file structure
   - **IF EXISTS**: Read data-model.md for entities and relationships
   - **IF EXISTS**: Read contracts/ for API specifications and test requirements
   - **IF EXISTS**: Read research.md for technical decisions and constraints
   - **IF EXISTS**: Read quickstart.md for integration scenarios
```

#### 2. **脚本检测可用文件**

命令会运行脚本检测哪些文件存在：

```bash
# 执行脚本
.specify/scripts/bash/check-prerequisites.sh --json --include-tasks

# 返回结果
{
  "FEATURE_DIR": "/path/to/specs/001-im-sdk-refactor",
  "AVAILABLE_DOCS": [
    "spec.md",
    "plan.md",
    "tasks.md",
    "data-model.md",
    "contracts/",
    "research.md",
    "quickstart.md"
  ]
}
```

#### 3. **AI 根据规则读取**

AI 会：
- ✅ 读取所有 **REQUIRED** 文件（如果不存在会报错）
- ✅ 读取所有 **IF EXISTS** 文件（如果存在）
- ❌ 不读取不在列表中的文件

**如何控制**：

1. **修改命令文件**（不推荐）
   - 编辑 `.cursor/commands/speckit.implement.md`
   - 修改 Outline 中的文件列表

2. **创建/删除文件**（推荐）
   - 创建文件 → AI 会读取（如果是 IF EXISTS）
   - 删除文件 → AI 不会读取
   - 文件不存在 → AI 跳过（如果是 IF EXISTS）

3. **使用不同的命令**
   - `/speckit.plan` → 读取 `spec.md` 和 `constitution.md`
   - `/speckit.tasks` → 读取 `spec.md` 和 `plan.md`
   - `/speckit.implement` → 读取 `tasks.md`、`plan.md` 等

---

### Q4: 需要明确告诉 AI 根据 spec 或 task 去实现代码吗？

**答案：是的，需要明确调用命令。**

**两种方式**：

#### 方式 1: 使用命令（推荐）⭐

```bash
# 明确调用命令
/speckit.implement

# AI 会自动：
# 1. 读取 tasks.md
# 2. 读取 plan.md
# 3. 读取其他相关文件
# 4. 按照 tasks.md 执行任务
```

**优点**：
- ✅ 标准化流程
- ✅ AI 知道读取哪些文件
- ✅ 自动按照任务顺序执行

#### 方式 2: 手动告诉 AI（也可以）

```bash
# 手动告诉 AI
根据 specs/001-im-sdk-refactor/tasks.md 中的任务 T025，
实现消息发送功能。

参考：
- specs/001-im-sdk-refactor/plan.md（技术方案）
- specs/001-im-sdk-refactor/data-model.md（数据模型）
```

**优点**：
- ✅ 更灵活
- ✅ 可以指定特定任务
- ⚠️ 需要手动指定文件

**推荐**：
- 大型实现：使用 `/speckit.implement` 命令
- 单个任务：手动告诉 AI 参考特定文件

---

### Q5: spec-kit 的 implement 命令就是告诉 AI 按照 task 去执行吗？

**答案：是的，但不仅仅是。**

**`/speckit.implement` 命令的完整流程**：

```
1. 检查前置条件
   ↓
2. 检查 checklist 状态（如果有）
   ↓
3. 读取实现上下文：
   - tasks.md（任务清单）⭐
   - plan.md（技术方案）
   - data-model.md（数据模型）
   - contracts/（API 契约）
   - research.md（技术决策）
   - quickstart.md（集成场景）
   ↓
4. 解析 tasks.md：
   - 提取任务阶段（Setup, Tests, Core, Integration, Polish）
   - 提取任务依赖关系
   - 提取任务详情（ID、描述、文件路径）
   ↓
5. 按照任务计划执行实现：
   - 按阶段执行（完成一个阶段再进入下一个）
   - 遵循依赖关系（顺序任务按顺序，并行任务[P]可以并行）
   - 遵循 TDD（先写测试，再实现）
   - 文件协调（同一文件的任务必须顺序执行）
   ↓
6. 进度跟踪和错误处理
   ↓
7. 完成验证
```

**关键点**：

1. **主要依据**：`tasks.md`（任务清单）
2. **参考文档**：`plan.md`、`data-model.md` 等（提供上下文）
3. **执行方式**：按照 tasks.md 中的任务顺序和依赖关系执行
4. **完成标记**：完成后会在 tasks.md 中标记 `[X]`

---

## 二、工作原理详解

### 2.1 命令系统架构

```
┌─────────────────────────────────────┐
│  用户输入命令                        │
│  /speckit.implement                 │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Cursor 命令系统                     │
│  .cursor/commands/speckit.*.md      │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  执行脚本                            │
│  .specify/scripts/bash/*.sh         │
│  - 检测文件存在性                    │
│  - 返回文件路径                      │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  AI 读取文件                         │
│  - tasks.md（必需）                  │
│  - plan.md（必需）                   │
│  - data-model.md（可选）             │
│  - contracts/（可选）                │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  AI 执行实现                         │
│  - 按照 tasks.md 执行任务             │
│  - 参考 plan.md 等技术方案            │
│  - 生成代码                          │
└─────────────────────────────────────┘
```

### 2.2 文件读取规则

**命令文件中的定义**：

```markdown
## Outline

3. Load and analyze the implementation context:
   - **REQUIRED**: Read tasks.md
   - **REQUIRED**: Read plan.md
   - **IF EXISTS**: Read data-model.md
   - **IF EXISTS**: Read contracts/
   - **IF EXISTS**: Read research.md
   - **IF EXISTS**: Read quickstart.md
```

**实际执行**：

```typescript
// AI 执行逻辑（伪代码）
const filesToRead = [];

// 必需文件
filesToRead.push('tasks.md');  // 如果不存在会报错
filesToRead.push('plan.md');   // 如果不存在会报错

// 可选文件（如果存在）
if (exists('data-model.md')) {
  filesToRead.push('data-model.md');
}
if (exists('contracts/')) {
  filesToRead.push('contracts/');
}
if (exists('research.md')) {
  filesToRead.push('research.md');
}
if (exists('quickstart.md')) {
  filesToRead.push('quickstart.md');
}

// 读取所有文件
for (const file of filesToRead) {
  const content = readFile(file);
  context.add(file, content);
}

// 基于上下文执行实现
executeImplementation(context);
```

### 2.3 任务执行流程

**tasks.md 结构**：

```markdown
## Phase 3: User Story 1

- [ ] T025 [US1] 在 src/core/message/message-sender.ts 实现消息发送器
- [ ] T026 [US1] 在 src/core/message/message-receiver.ts 实现消息接收器
```

**AI 执行流程**：

```
1. 解析 tasks.md
   ↓
2. 提取任务列表：
   - T025: 实现消息发送器
   - T026: 实现消息接收器
   ↓
3. 检查任务依赖：
   - T025 和 T026 都是 [P]（可以并行）
   ↓
4. 执行任务：
   - 读取 plan.md 了解技术方案
   - 读取 data-model.md 了解数据模型
   - 实现消息发送器（T025）
   - 实现消息接收器（T026）
   ↓
5. 标记完成：
   - [X] T025 [US1] 在 src/core/message/message-sender.ts 实现消息发送器
   - [X] T026 [US1] 在 src/core/message/message-receiver.ts 实现消息接收器
```

---

## 三、如何控制 AI 读取哪些文件

### 方法 1: 创建/删除文件（最简单）

```bash
# 想让 AI 读取某个文件
touch specs/001-im-sdk-refactor/reference-code.md

# 不想让 AI 读取某个文件
rm specs/001-im-sdk-refactor/research.md
```

### 方法 2: 修改命令文件（高级）

编辑 `.cursor/commands/speckit.implement.md`：

```markdown
## Outline

3. Load and analyze the implementation context:
   - **REQUIRED**: Read tasks.md
   - **REQUIRED**: Read plan.md
   - **IF EXISTS**: Read data-model.md
   - **IF EXISTS**: Read reference-code.md  # 添加新文件
   - **IF EXISTS**: Read contracts/
```

### 方法 3: 使用不同的命令

```bash
# 只读取 spec.md
/speckit.plan

# 读取 spec.md 和 plan.md
/speckit.tasks

# 读取 tasks.md、plan.md 等
/speckit.implement
```

### 方法 4: 手动指定文件（灵活）

```bash
# 手动告诉 AI 读取哪些文件
根据以下文件实现代码：
- specs/001-im-sdk-refactor/tasks.md（任务 T025）
- specs/001-im-sdk-refactor/plan.md（技术方案）
- specs/001-im-sdk-refactor/reference-code.md（参考代码）

实现消息发送功能。
```

---

## 四、实际使用示例

### 示例 1: 使用命令实现

```bash
# 1. 用户输入命令
/speckit.implement

# 2. Cursor 执行流程：
#    - 读取 .cursor/commands/speckit.implement.md
#    - 执行脚本检测文件
#    - AI 读取 tasks.md、plan.md 等
#    - AI 按照 tasks.md 执行任务

# 3. AI 输出：
#    "开始实现任务 T025：消息发送器..."
#    "已完成任务 T025"
#    "开始实现任务 T026：消息接收器..."
```

### 示例 2: 手动指定文件

```bash
# 用户输入
根据 specs/001-im-sdk-refactor/tasks.md 中的任务 T025，
参考 specs/001-im-sdk-refactor/plan.md 的技术方案，
实现消息发送功能。

# AI 会：
# 1. 读取 tasks.md（找到任务 T025）
# 2. 读取 plan.md（了解技术方案）
# 3. 实现消息发送功能
```

### 示例 3: 控制读取文件

```bash
# 场景：想让 AI 参考现有代码

# 方法 1: 创建参考代码文档
echo "# 参考代码" > specs/001-im-sdk-refactor/reference-code.md

# 方法 2: 修改命令文件（添加 reference-code.md 到读取列表）
# 编辑 .cursor/commands/speckit.implement.md

# 方法 3: 手动告诉 AI
根据 specs/001-im-sdk-refactor/tasks.md，
参考 @src/legacy/message-sender.ts（现有代码），
实现新的消息发送功能。
```

---

## 五、总结

### 核心要点

1. **Spec-Kit 不是标准协议**
   - 是 Cursor 的自定义命令系统
   - 通过 `.cursor/commands/` 文件定义

2. **AI 不会自动读取文件**
   - 需要明确调用命令（`/speckit.implement`）
   - 或手动告诉 AI 读取哪些文件

3. **读取哪些文件由命令文件控制**
   - 命令文件的 `Outline` 定义了读取规则
   - `REQUIRED`：必需文件
   - `IF EXISTS`：可选文件

4. **需要明确告诉 AI**
   - 使用命令：`/speckit.implement`
   - 或手动指定：根据 `tasks.md` 实现

5. **implement 命令的作用**
   - 主要依据：`tasks.md`（任务清单）
   - 参考文档：`plan.md`、`data-model.md` 等
   - 执行方式：按照 tasks.md 中的任务顺序执行

### 最佳实践

1. **大型实现**：使用 `/speckit.implement` 命令
2. **单个任务**：手动告诉 AI 参考特定文件
3. **控制读取**：创建/删除文件，或修改命令文件
4. **参考现有代码**：创建 `reference-code.md` 或在实现时明确引用
