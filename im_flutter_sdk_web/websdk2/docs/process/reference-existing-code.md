# 让 AI 参考现有代码实现 Tasks

## 一、问题场景

**场景**：重构项目，已有旧版本代码，希望 AI 在实现 tasks 时参考现有代码的实现方式。

**挑战**：
- AI 默认只读取 spec 文档（spec.md, plan.md, tasks.md）
- 现有代码的实现细节和模式不在 spec 中
- 需要让 AI 理解现有代码的风格和实现方式

---

## 二、解决方案

### 方案 1: 在 Plan 中引用现有代码（推荐）⭐

**适用场景**：重构时，需要保持某些实现模式

**操作步骤**：

1. **在 plan.md 中添加"现有代码参考"章节**
   ```markdown
   ## 现有代码参考
   
   ### 代码风格和模式
   
   重构时需要参考现有代码的以下实现模式：
   
   - **消息发送逻辑**：参考 `src/legacy/message-sender.ts` 中的实现
     - 使用指数退避重试策略
     - 消息状态管理方式
     - 错误处理模式
   
   - **连接管理**：参考 `src/legacy/connection.ts` 中的实现
     - 心跳机制实现
     - 重连逻辑
     - 状态转换处理
   
   - **事件系统**：参考 `src/core/events/event-hub.ts` 中的实现
     - 事件命名规范（onX）
     - 事件参数格式
     - addEventHandler/removeEventHandler 使用方式
   ```

2. **在实现时明确引用**
   ```
   根据 specs/001-im-sdk-refactor/plan.md 中的"现有代码参考"章节，
   参考 src/legacy/message-sender.ts 的实现方式，
   实现新的消息发送功能。
   ```

**优点**：
- ✅ 文档化，可追溯
- ✅ AI 可以读取 plan.md 了解参考代码
- ✅ 团队其他成员也能理解

**缺点**：
- ⚠️ 需要手动维护引用关系

---

### 方案 2: 创建参考代码文档（最佳实践）⭐⭐⭐

**适用场景**：需要详细记录现有代码的实现模式

**操作步骤**：

1. **创建参考代码文档**
   ```bash
   specs/001-im-sdk-refactor/reference-code.md
   ```

2. **在文档中记录关键实现模式**
   ```markdown
   # 现有代码参考
   
   ## 消息发送实现参考
   
   ### 文件位置
   - 旧代码：`src/legacy/message-sender.ts`
   - 新代码：`src/core/message/message-sender.ts`
   
   ### 关键实现模式
   
   #### 1. 消息重试逻辑
   ```typescript
   // 旧代码实现（参考）
   async sendMessage(message: Message): Promise<void> {
     let retryCount = 0;
     const maxRetries = 3;
     
     while (retryCount < maxRetries) {
       try {
         await this.websocket.send(message);
         return;
       } catch (error) {
         retryCount++;
         if (retryCount >= maxRetries) {
           throw error;
         }
         await this.delay(Math.pow(2, retryCount) * 1000); // 指数退避
       }
     }
   }
   ```
   
   **重构要求**：
   - 保持指数退避策略
   - 最大重试次数：3 次
   - 错误处理方式保持一致
   
   #### 2. 消息状态管理
   ```typescript
   // 旧代码实现（参考）
   enum MessageStatus {
     SENDING = 'sending',
     SENT = 'sent',
     FAILED = 'failed',
     DELIVERED = 'delivered',
     READ = 'read'
   }
   ```
   
   **重构要求**：
   - 使用联合类型而非枚举（符合新规范）
   - 状态值保持一致
   - 状态转换逻辑保持一致
   ```

3. **在 plan.md 中引用**
   ```markdown
   ## 现有代码参考
   
   详细参考：`specs/001-im-sdk-refactor/reference-code.md`
   
   重构时需要保持以下实现模式：
   - 消息重试逻辑（指数退避，最多 3 次）
   - 消息状态管理（SENDING → SENT → DELIVERED → READ）
   - 错误处理方式（统一错误码和错误信息）
   ```

4. **在实现时引用**
   ```
   根据 specs/001-im-sdk-refactor/reference-code.md 中的消息发送实现参考，
   实现新的消息发送功能，保持以下模式：
   1. 指数退避重试策略
   2. 消息状态管理方式
   3. 错误处理模式
   ```

**优点**：
- ✅ 详细记录实现模式
- ✅ 可以包含代码示例
- ✅ AI 可以完整理解参考代码
- ✅ 便于后续维护

**缺点**：
- ⚠️ 需要手动维护文档

---

### 方案 3: 在实现时直接引用文件（快速）⭐⭐

**适用场景**：临时需要参考某个文件的实现

**操作步骤**：

1. **在实现任务时明确引用**
   ```
   根据 specs/001-im-sdk-refactor/tasks.md 中的任务 T025，
   实现消息发送功能。
   
   请参考现有代码：
   - src/legacy/message-sender.ts（消息发送逻辑）
   - src/legacy/connection.ts（连接管理）
   
   要求：
   1. 保持现有的重试逻辑（指数退避，最多 3 次）
   2. 保持现有的错误处理方式
   3. 使用新的架构（管理器模式）
   ```

2. **使用 Cursor 的文件引用功能**
   ```
   @src/legacy/message-sender.ts 请参考这个文件的实现方式，
   实现新的消息发送功能。
   ```

**优点**：
- ✅ 快速，不需要维护文档
- ✅ 直接引用代码文件
- ✅ AI 可以读取文件内容

**缺点**：
- ⚠️ 每次都需要手动引用
- ⚠️ 如果文件很多，引用会很长

---

### 方案 4: 在 Tasks 中添加参考说明（结构化）⭐⭐

**适用场景**：需要在任务级别指定参考代码

**操作步骤**：

1. **在 tasks.md 中添加参考说明**
   ```markdown
   ## Phase 3: User Story 1 - 连接建立与消息收发
   
   **参考代码**：
   - 消息发送：`src/legacy/message-sender.ts`
   - 连接管理：`src/legacy/connection.ts`
   - 事件系统：`src/core/events/event-hub.ts`
   
   **重构要求**：
   - 保持现有的重试逻辑和错误处理方式
   - 使用新的架构（管理器模式）
   - 保持 API 行为一致
   
   ### Implementation for User Story 1
   
   - [ ] T025 [US1] 在 src/core/message/message-sender.ts 实现消息发送器
     - 参考：`src/legacy/message-sender.ts` 的重试逻辑和错误处理
     - 要求：保持指数退避策略，最多重试 3 次
   ```

2. **AI 会自动读取 tasks.md 中的参考说明**
   ```
   执行 /speckit.implement
   AI 会读取 tasks.md，看到参考说明，然后参考现有代码实现
   ```

**优点**：
- ✅ 结构化，每个任务都有明确的参考
- ✅ AI 可以自动读取
- ✅ 便于维护和追踪

**缺点**：
- ⚠️ 如果参考代码很多，tasks.md 会很长

---

## 三、最佳实践组合

### 推荐方案：方案 2 + 方案 4

**操作步骤**：

1. **创建参考代码文档**（方案 2）
   ```bash
   specs/001-im-sdk-refactor/reference-code.md
   ```
   - 记录关键实现模式
   - 包含代码示例
   - 说明重构要求

2. **在 plan.md 中引用**（方案 2）
   ```markdown
   ## 现有代码参考
   
   详细参考：`specs/001-im-sdk-refactor/reference-code.md`
   ```

3. **在 tasks.md 中添加简要说明**（方案 4）
   ```markdown
   ## Phase 3: User Story 1
   
   **参考代码**：见 `reference-code.md`
   ```

4. **实现时明确引用**（方案 3）
   ```
   根据 specs/001-im-sdk-refactor/reference-code.md，
   实现消息发送功能。
   ```

---

## 四、实际操作示例

### 示例 1: 重构消息发送功能

**步骤 1: 创建参考代码文档**

```markdown
# specs/001-im-sdk-refactor/reference-code.md

## 消息发送实现参考

### 旧代码位置
`src/legacy/message-sender.ts`

### 关键实现模式

#### 1. 消息重试逻辑
```typescript
// 旧代码（参考）
async sendMessage(message: Message): Promise<void> {
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      await this.websocket.send(message);
      return;
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        throw error;
      }
      await this.delay(Math.pow(2, retryCount) * 1000);
    }
  }
}
```

**重构要求**：
- 保持指数退避策略
- 最大重试次数：3 次
- 错误处理方式保持一致
```

**步骤 2: 在 plan.md 中引用**

```markdown
## 现有代码参考

详细参考：`specs/001-im-sdk-refactor/reference-code.md`

重构时需要保持以下实现模式：
- 消息重试逻辑（指数退避，最多 3 次）
- 消息状态管理
- 错误处理方式
```

**步骤 3: 实现时引用**

```
根据 specs/001-im-sdk-refactor/reference-code.md 中的消息发送实现参考，
实现新的消息发送功能（src/core/message/message-sender.ts）。

要求：
1. 保持现有的重试逻辑（指数退避，最多 3 次）
2. 使用新的架构（管理器模式）
3. 保持 API 行为一致
```

---

### 示例 2: 重构连接管理功能

**步骤 1: 在 reference-code.md 中添加**

```markdown
## 连接管理实现参考

### 旧代码位置
`src/legacy/connection.ts`

### 关键实现模式

#### 1. 心跳机制
```typescript
// 旧代码（参考）
class ConnectionManager {
  private heartbeatInterval: number = 30000; // 30 秒
  
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.websocket.send(JSON.stringify({ type: 'ping' }));
    }, this.heartbeatInterval);
  }
}
```

**重构要求**：
- 保持 30 秒心跳间隔
- 使用 ping/pong 机制
- 心跳超时处理保持一致
```

**步骤 2: 实现时引用**

```
根据 specs/001-im-sdk-refactor/reference-code.md 中的连接管理实现参考，
实现新的连接管理功能（src/core/connection/connection-manager.ts）。

要求：
1. 保持现有的心跳机制（30 秒间隔）
2. 使用新的架构
3. 保持连接状态管理方式一致
```

---

## 五、注意事项

### ✅ 应该做的

1. **记录关键实现模式**
   - 重试逻辑
   - 错误处理方式
   - 状态管理方式
   - 性能优化技巧

2. **说明重构要求**
   - 哪些需要保持
   - 哪些需要改进
   - 哪些需要替换

3. **包含代码示例**
   - 关键代码片段
   - 实现模式示例
   - 边界情况处理

### ❌ 不应该做的

1. **不要复制整个文件**
   - 只记录关键模式
   - 保持文档简洁

2. **不要记录实现细节**
   - 只记录设计模式
   - 实现细节在代码注释中

3. **不要忘记更新**
   - 代码变更后，及时更新参考文档
   - 保持参考文档的准确性

---

## 六、快速参考

### 方案选择

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 大型重构 | 方案 2（参考代码文档） | 需要详细记录多个实现模式 |
| 小型重构 | 方案 3（直接引用文件） | 快速，不需要维护文档 |
| 结构化任务 | 方案 4（Tasks 中添加说明） | 每个任务都有明确参考 |
| 最佳实践 | 方案 2 + 方案 4 | 详细文档 + 任务级引用 |

### 工作流程

```
1. 创建参考代码文档（reference-code.md）
   ↓
2. 在 plan.md 中引用
   ↓
3. 在 tasks.md 中添加简要说明
   ↓
4. 实现时明确引用
   ↓
5. AI 读取文档和代码，参考实现
```

---

## 七、总结

**核心方法**：
1. **创建参考代码文档**（`reference-code.md`）- 记录关键实现模式
2. **在 plan.md 中引用** - 让 AI 知道有参考文档
3. **在实现时明确引用** - 告诉 AI 参考哪些代码
4. **使用文件引用** - `@文件名` 让 AI 直接读取代码

**最佳实践**：
- 大型重构：创建详细的参考代码文档
- 小型重构：直接引用文件
- 结构化任务：在 tasks.md 中添加参考说明

**关键点**：
- ✅ 记录"为什么这样实现"（设计模式）
- ✅ 说明"需要保持什么"（重构要求）
- ✅ 包含代码示例（关键实现）
- ❌ 不要复制整个文件（保持简洁）
