# 代码修改决策指南

## 一、核心原则

**问题**：按照 spec 实现的代码不符合预期，应该修改什么？

**答案**：取决于变更的性质和影响范围。

---

## 二、快速决策树

```
代码不符合预期
    │
    ├─ 是需求理解错误？
    │   └─ 修改 spec.md（需求层）
    │
    ├─ 是设计/架构问题？
    │   └─ 修改 plan.md（方案层）
    │
    ├─ 是实现细节/边界情况？
    │   └─ 直接改代码 + 代码注释
    │
    └─ 是任务拆分问题？
        └─ 修改 tasks.md（任务层）
```

---

## 三、详细场景分析

### 场景 1: 需求理解错误 → 修改 `spec.md`

**判断标准**：
- ❌ 实现的功能不是用户真正需要的
- ❌ 功能行为与业务需求不符
- ❌ 缺少必要的功能点

**操作步骤**：

1. **更新 spec.md**
   ```markdown
   # 修改前
   - 用户需要发送文本消息
   
   # 修改后
   - 用户需要发送文本消息，且支持 @ 提及功能
   ```

2. **让 AI 基于更新后的 spec 修改代码**
   ```
   根据更新后的 specs/001-im-sdk-refactor/spec.md，
   消息发送功能需要支持 @ 提及。
   请更新相关代码：
   1. src/managers/MessageManager.ts
   2. src/types/index.ts（添加 mention 字段）
   3. 相关测试文件
   ```

3. **验证一致性**
   ```
   使用 /speckit.analyze 检查代码是否与更新后的 spec 一致
   ```

**示例**：
```typescript
// 需求变更：消息需要支持 @ 提及

// 1. 更新 spec.md
// User Story 1: 消息发送需要支持 @ 提及功能

// 2. 更新 data-model.md
// Message 接口添加 mentions?: string[] 字段

// 3. 让 AI 修改代码
// "根据更新后的 spec，添加 @ 提及功能支持"
```

---

### 场景 2: 设计/架构问题 → 修改 `plan.md`

**判断标准**：
- ❌ 技术方案不合适（如：应该用 A 方案，但用了 B 方案）
- ❌ 架构设计有问题（如：应该用管理器模式，但用了函数式）
- ❌ 数据结构设计不合理

**操作步骤**：

1. **更新 plan.md**
   ```markdown
   # 修改前
   - 使用函数式 API（纯函数）
   
   # 修改后
   - 使用管理器模式（面向对象）
   - 原因：开发体验更好，IDE 提示更完整
   ```

2. **更新相关设计文档**
   - `data-model.md`（如果数据结构变更）
   - `contracts/api.md`（如果 API 接口变更）

3. **更新 tasks.md**（如果需要）
   ```markdown
   # 添加新任务
   - [ ] TXXX [US6] 重构 API 形式，从函数式改为管理器模式
   ```

4. **让 AI 基于更新后的 plan 重构代码**
   ```
   根据更新后的 specs/001-im-sdk-refactor/plan.md，
   API 形式需要从函数式改为管理器模式。
   请重构相关代码：
   1. 创建 src/managers/MessageManager.ts
   2. 重构 src/index.ts，使用管理器模式
   3. 更新所有调用代码
   ```

**示例**：
```typescript
// 设计变更：API 形式从函数式改为管理器模式

// 1. 更新 plan.md
// 架构重构技术方案：采用管理器模式（面向对象）

// 2. 更新 contracts/api.md
// IMClient 类，包含 message、conversation 等管理器

// 3. 让 AI 重构代码
// "根据更新后的 plan，重构 API 形式为管理器模式"
```

---

### 场景 3: 实现细节/边界情况 → 直接改代码

**判断标准**：
- ✅ 需求理解正确
- ✅ 设计方案正确
- ❌ 只是实现细节不对（如：边界情况处理、错误处理细节）

**操作步骤**：

1. **直接修改代码**
   ```typescript
   // 修改前
   if (message.type === 'text') {
     sendMessage(message);
   }
   
   // 修改后（添加边界情况处理）
   if (message.type === 'text' && message.content?.trim()) {
     sendMessage(message);
   } else {
     throw new Error('消息内容不能为空');
   }
   ```

2. **添加代码注释说明原因**
   ```typescript
   /**
    * 发送文本消息
    * 
    * 边界情况处理：
    * - 消息内容不能为空（trim 后）
    * - 空消息会抛出错误，而不是静默失败
    * 
    * @param message - 消息对象
    * @throws {Error} 当消息内容为空时
    */
   async sendTextMessage(message: TextMessage): Promise<void> {
     if (!message.content?.trim()) {
       throw new Error('消息内容不能为空');
     }
     // ... 实现
   }
   ```

3. **不需要修改 spec/plan/tasks**
   - 这是实现细节，不是需求或设计变更
   - 代码注释已经说明了原因

**示例**：
```typescript
// 实现细节：消息去重逻辑

// 直接改代码，不需要改 spec
if (
  ignoreMyOwnMsg &&
  meta.from &&
  meta.from.name === this.context.userId &&
  meta.from.clientResource === this.clientResource &&
  thirdMessage.type === MsyncMessageType.CHATROOM
) {
  return logger.debug('Discard your own chat room message:', msgId);
}
```

---

### 场景 4: 任务拆分问题 → 修改 `tasks.md`

**判断标准**：
- ❌ 任务拆分不合理（如：一个任务太大，需要拆分）
- ❌ 任务顺序不对（如：B 任务依赖 A 任务，但 A 还没完成）
- ❌ 缺少必要的任务

**操作步骤**：

1. **更新 tasks.md**
   ```markdown
   # 修改前
   - [ ] T025 [US1] 实现消息发送功能
   
   # 修改后（拆分任务）
   - [ ] T025 [US1] 实现消息发送基础功能
   - [ ] T026 [US1] 实现消息发送重试逻辑
   - [ ] T027 [US1] 实现消息发送状态回调
   ```

2. **让 AI 基于更新后的 tasks 继续实现**
   ```
   根据更新后的 specs/001-im-sdk-refactor/tasks.md，
   任务 T025 已完成，现在需要实现任务 T026（消息发送重试逻辑）。
   ```

**示例**：
```markdown
# 任务拆分：消息发送功能太大，需要拆分

# 修改前
- [ ] T025 [US1] 实现消息发送功能

# 修改后
- [ ] T025 [US1] 实现消息发送基础功能（发送消息、等待 ACK）
- [ ] T026 [US1] 实现消息发送重试逻辑（失败重试、指数退避）
- [ ] T027 [US1] 实现消息发送状态回调（onSending、onSent、onFailed）
```

---

## 四、决策矩阵

| 变更类型 | 修改什么 | 是否需要 AI 辅助 | 示例 |
|---------|---------|-----------------|------|
| **需求变更** | `spec.md` | ✅ 是 | 添加 @ 提及功能 |
| **设计变更** | `plan.md` + `data-model.md` + `contracts/api.md` | ✅ 是 | API 形式从函数式改为管理器模式 |
| **架构变更** | `plan.md` | ✅ 是 | 从单体改为微服务 |
| **实现细节** | 代码 + 注释 | ❌ 否 | 边界情况处理、错误处理细节 |
| **任务拆分** | `tasks.md` | ⚠️ 可选 | 拆分大任务为小任务 |
| **Bug 修复** | 代码 + 注释 | ❌ 否 | 修复消息去重逻辑 |

---

## 五、实际操作示例

### 示例 1: 需求变更（修改 spec.md）

**场景**：消息发送功能需要支持消息优先级

**步骤**：

1. **更新 spec.md**
   ```markdown
   ### User Story 1 - 连接建立与消息收发
   
   **Acceptance Scenarios**:
   1. **Given** 用户发送消息, **When** 设置消息优先级为 high, **Then** 消息优先发送
   ```

2. **更新 data-model.md**
   ```markdown
   ### Message (消息)
   - `priority?: MessagePriority` - 消息优先级（high, normal, low）
   ```

3. **让 AI 修改代码**
   ```
   根据更新后的 specs/001-im-sdk-refactor/spec.md 和 data-model.md，
   消息发送功能需要支持优先级。
   请更新：
   1. src/types/index.ts（添加 MessagePriority 类型）
   2. src/managers/MessageManager.ts（添加 priority 参数）
   3. 相关测试文件
   ```

---

### 示例 2: 设计变更（修改 plan.md）

**场景**：API 形式从函数式改为管理器模式

**步骤**：

1. **更新 plan.md**
   ```markdown
   ## 架构重构技术方案
   
   ### 2. 统一使用方式与 API 形式
   
   **技术方案**: 采用**管理器模式（面向对象）**
   ```

2. **更新 contracts/api.md**
   ```typescript
   class IMClient {
     message: MessageManager;
     conversation: ConversationManager;
   }
   ```

3. **更新 tasks.md**
   ```markdown
   - [ ] T039 [US6] 在 src/managers/MessageManager.ts 实现消息管理器
   ```

4. **让 AI 重构代码**
   ```
   根据更新后的 plan.md 和 contracts/api.md，
   需要将 API 形式从函数式改为管理器模式。
   请重构：
   1. 创建 src/managers/MessageManager.ts
   2. 重构 src/index.ts，使用管理器模式
   3. 更新所有调用代码和测试
   ```

---

### 示例 3: 实现细节（直接改代码）

**场景**：消息发送需要添加空内容检查

**步骤**：

1. **直接修改代码**
   ```typescript
   async sendTextMessage(message: TextMessage): Promise<void> {
     // 添加边界情况处理
     if (!message.content?.trim()) {
       throw new ValidationError('消息内容不能为空');
     }
     // ... 原有实现
   }
   ```

2. **添加代码注释**
   ```typescript
   /**
    * 发送文本消息
    * 
    * 边界情况：
    * - 消息内容不能为空（trim 后检查）
    * - 空消息会抛出 ValidationError
    */
   ```

3. **不需要修改 spec/plan/tasks**
   - 这是实现细节，不是需求或设计变更

---

## 六、最佳实践

### ✅ 推荐做法

1. **需求变更 → 改 spec.md**
   - 保持需求文档是唯一数据源
   - 让 AI 基于更新后的 spec 修改代码

2. **设计变更 → 改 plan.md**
   - 记录设计决策和原因
   - 更新相关设计文档（data-model.md, contracts/api.md）

3. **实现细节 → 直接改代码**
   - 不需要改文档
   - 用代码注释说明原因

4. **保持文档同步**
   - 代码变更后，检查是否需要更新文档
   - 使用 `/speckit.analyze` 检查一致性

### ❌ 不推荐做法

1. **不要直接改代码而不更新文档**（如果是需求/设计变更）
   - 会导致文档和代码不一致
   - AI 无法理解变更原因

2. **不要在 spec 中写实现细节**
   - Spec 应该记录"做什么"，不是"怎么做"
   - 实现细节应该在代码注释中

3. **不要跳过文档直接改代码**（如果是大型变更）
   - 大型变更应该先更新文档，再改代码
   - 小改动可以直接改代码

---

## 七、快速参考

### 修改什么？

| 问题 | 修改 |
|------|------|
| "这个功能不是我想要的" | `spec.md` |
| "这个设计不对" | `plan.md` |
| "这个实现细节有问题" | 代码 + 注释 |
| "这个任务太大" | `tasks.md` |
| "这个 Bug 需要修复" | 代码 + 注释 |

### 是否需要 AI 辅助？

| 变更类型 | 需要 AI |
|---------|--------|
| 需求变更 | ✅ 是 |
| 设计变更 | ✅ 是 |
| 实现细节 | ❌ 否 |
| Bug 修复 | ❌ 否 |

### 工作流程

```
需求变更
  ↓
更新 spec.md
  ↓
让 AI 基于 spec 修改代码
  ↓
验证一致性（/speckit.analyze）

设计变更
  ↓
更新 plan.md + data-model.md + contracts/api.md
  ↓
更新 tasks.md（如果需要）
  ↓
让 AI 基于 plan 重构代码
  ↓
验证一致性

实现细节
  ↓
直接改代码
  ↓
添加代码注释
  ↓
不需要更新文档
```

---

## 八、总结

**核心原则**：
1. **需求层变更** → 改 `spec.md`
2. **设计层变更** → 改 `plan.md`
3. **实现层变更** → 改代码 + 注释
4. **任务层变更** → 改 `tasks.md`

**判断标准**：
- 影响需求理解 → 改 spec
- 影响设计方案 → 改 plan
- 只是实现细节 → 改代码
- 影响任务拆分 → 改 tasks

**效率平衡**：
- 大型变更：先改文档，再让 AI 改代码
- 小型变更：直接改代码，同步更新文档（如果需要）
- 实现细节：直接改代码，不需要改文档
