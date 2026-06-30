# 项目自定义规则

## 代码规范

### TypeScript 类型规范

1. **严格模式**：必须启用 TypeScript strict mode，禁止使用 `any` 类型

**示例**：

```typescript
// ✅ 正确：使用具体类型
function sendMessage(message: Message): Promise<Message> {}

// ✅ 正确：特殊情况使用 unknown + 类型守卫
function parseData(data: unknown): Message {
  if (isMessage(data)) {
    return data;
  }
  throw new Error('Invalid message format');
}

// ❌ 错误：使用 any
function sendMessage(message: any): any {}

// ❌ 错误：禁用类型检查
// @ts-ignore
const result = someFunction();
```

2. **接口优先于类型别名**：公共 API 使用 `interface`，内部类型使用 `type`

**示例**：

```typescript
// ✅ 正确：公共 API 使用 interface
export interface Message {
  id: string;
  content: string;
}

// ✅ 正确：内部类型使用 type
type InternalState = 'connecting' | 'connected' | 'disconnected';

// ❌ 错误：公共 API 使用 type（不利于扩展）
export type Message = { id: string; content: string };
```

3. **函数必须显式声明返回类型**：所有函数和方法必须明确返回类型

**示例**：

```typescript
// ✅ 正确：显式返回类型
function getUser(id: string): User | null {
  return users.get(id) || null;
}

async function connect(): Promise<void> {
  await this.websocket.connect();
}

// ❌ 错误：隐式返回类型
function getUser(id: string) {
  return users.get(id);
}
```

4. **使用 readonly 保护不可变数据**：对象属性如果不应被修改，使用 `readonly`

**示例**：

```typescript
// ✅ 正确：使用 readonly
interface Config {
  readonly serverUrl: string;
  readonly maxRetries: number;
}

// ✅ 正确：数组使用 ReadonlyArray
function processMessages(messages: ReadonlyArray<Message>): void {
  // messages 不能被修改
}
```

5. **使用联合类型而非枚举**：优先使用联合类型，枚举仅用于需要反向映射的场景

**为什么优先使用联合类型？**

1. **更轻量**：联合类型是纯类型，编译后不生成 JavaScript 代码；枚举会生成额外的 JavaScript 对象
2. **类型更精确**：联合类型是字面量类型，类型检查更严格
3. **更好的类型推断**：TypeScript 能更好地推断联合类型
4. **更灵活**：可以轻松扩展和组合
5. **避免意外行为**：枚举有反向映射，可能导致意外的运行时行为

**示例**：

```typescript
// ✅ 正确：使用联合类型（推荐）
type MessageStatus = 'sending' | 'sent' | 'failed' | 'delivered';

function updateStatus(status: MessageStatus): void {
  // status 只能是这四个值之一，类型安全
  console.log(status);
}

// 编译后：没有任何 JavaScript 代码生成，只是类型检查

// ❌ 错误：简单场景使用枚举（不推荐）
enum MessageStatus {
  Sending = 'sending',
  Sent = 'sent',
  Failed = 'failed',
  Delivered = 'delivered',
}

// 编译后会生成：
// var MessageStatus;
// (function (MessageStatus) {
//     MessageStatus["Sending"] = "sending";
//     MessageStatus["Sent"] = "sent";
//     // ... 额外的 JavaScript 代码
// })(MessageStatus || (MessageStatus = {}));

// ⚠️ 枚举的反向映射问题
enum Status {
  Active, // 值为 0
  Inactive, // 值为 1
}

console.log(Status[0]); // 'Active' - 反向映射，可能不是期望的行为
console.log(Status['Active']); // 0 - 也可能不是期望的

// ✅ 正确：需要反向映射时使用枚举（字符串枚举没有反向映射）
enum ErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTH_FAILED = 'AUTH_FAILED',
  // 字符串枚举不会生成反向映射
}

// 或者使用 const 对象 + 联合类型（更好的方式）
const ErrorCode = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  AUTH_FAILED: 'AUTH_FAILED',
} as const;

type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]; // 'CONNECTION_FAILED' | 'AUTH_FAILED'
```

**最佳实践**：

```typescript
// ✅ 推荐方式：const 对象 + 联合类型（既有值又有类型）
export const MessageStatus = {
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
  DELIVERED: 'delivered',
} as const;

export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];
// 类型：'sending' | 'sent' | 'failed' | 'delivered'

// 使用：
function updateStatus(status: MessageStatus): void {
  if (status === MessageStatus.SENDING) {
    // 类型安全，且有值可用
  }
}
```

6. **泛型约束**：使用泛型时添加适当的约束

**示例**：

```typescript
// ✅ 正确：添加泛型约束
function getById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

// ❌ 错误：无约束的泛型
function getById<T>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id); // 类型错误
}
```

### 异步编程规范

1. **优先使用 async/await**：避免使用 `.then()` 链式调用

**示例**：

```typescript
// ✅ 正确：使用 async/await
async function sendMessage(message: Message): Promise<Message> {
  const response = await this.websocket.send(message);
  await this.storage.save(message);
  return response;
}

// ❌ 错误：使用 .then() 链
function sendMessage(message: Message): Promise<Message> {
  return this.websocket.send(message).then(response => {
    return this.storage.save(message).then(() => response);
  });
}
```

2. **错误处理**：所有异步操作必须使用 try-catch 处理错误

**示例**：

```typescript
// ✅ 正确：完整的错误处理
async function connect(): Promise<void> {
  try {
    await this.websocket.connect();
    this.status = 'connected';
  } catch (error) {
    this.status = 'error';
    this.logger.error('连接失败', error);
    throw new SDKError(ErrorCode.CONNECTION_FAILED, '连接失败', error);
  }
}

// ❌ 错误：未处理错误
async function connect(): Promise<void> {
  await this.websocket.connect(); // 错误未处理
}
```

3. **Promise 超时**：所有异步操作必须设置超时

**示例**：

```typescript
// ✅ 正确：设置超时
async function sendWithTimeout(message: Message, timeout: number = 5000): Promise<Message> {
  return Promise.race([
    this.websocket.send(message),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('超时')), timeout)),
  ]);
}
```

### 导入导出规范

1. **使用命名导出**：优先使用命名导出，避免默认导出

**示例**：

```typescript
// ✅ 正确：命名导出
export class ConnectionManager {}
export function sendMessage(message: Message): Promise<Message> {}
export type { Message, ConnectionStatus };

// ❌ 错误：默认导出（不利于重构和自动补全）
export default class ConnectionManager {}
```

2. **导入顺序**：按照外部库 → 内部模块 → 类型导入的顺序

**示例**：

```typescript
// ✅ 正确：导入顺序
// 1. 外部库
import { EventEmitter } from 'events';
import * as protobuf from 'protobufjs';

// 2. 内部模块
import { Logger } from '../utils/logger';
import { MessageStorage } from '../storage/message-storage';

// 3. 类型导入
import type { Message, ConnectionStatus } from '../types';
```

3. **类型导入使用 `import type`**：类型导入使用 `import type` 避免运行时导入

**示例**：

```typescript
// ✅ 正确：类型导入
import type { Message, ConnectionStatus } from '../types';
import type { SDKConfig } from './config';

// ✅ 正确：值和类型混合导入
import { SDKError, type ErrorCode } from '../utils/errors';

// ❌ 错误：类型使用普通导入
import { Message, ConnectionStatus } from '../types';
```

### 类设计规范

1. **访问修饰符**：明确使用 `public`、`private`、`protected`

**示例**：

```typescript
// ✅ 正确：明确访问修饰符
class ConnectionManager {
  public connect(): Promise<void> {}
  private handleReconnect(): void {}
  protected onMessage(message: Message): void {}
}

// ❌ 错误：省略访问修饰符（默认 public，但不明确）
class ConnectionManager {
  connect(): Promise<void> {}
  handleReconnect(): void {}
}
```

2. **只读属性**：类属性如果不应被外部修改，使用 `readonly`

**示例**：

```typescript
// ✅ 正确：使用 readonly
class SDK {
  public readonly version: string = '1.0.0';
  private readonly config: SDKConfig;
}

// ❌ 错误：可修改的常量属性
class SDK {
  public version: string = '1.0.0'; // 可能被意外修改
}
```

3. **避免可选链滥用**：只在真正可能为 undefined/null 时使用可选链

**示例**：

```typescript
// ✅ 正确：合理使用可选链
const userName = user?.profile?.name ?? 'Unknown';

// ❌ 错误：过度使用可选链（类型应该保证非空）
if (this.connection?.status === 'connected') {
} // 如果 connection 不应该为 null
```

### 注释和文档规范

1. **JSDoc 注释**：所有公共 API 必须包含完整的 JSDoc 注释

**示例**：

````typescript
/**
 * 发送消息到服务器
 *
 * @param message - 要发送的消息对象，必须包含 id、content 等字段
 * @param options - 发送选项，包括重试次数、超时时间等
 * @returns Promise<Message> 返回发送成功的消息对象，包含服务器返回的消息 ID
 * @throws {SDKError} 当消息格式无效、网络错误或超时时抛出错误
 *
 * @example
 * ```typescript
 * const message = { id: '1', content: 'Hello', type: 'text' };
 * const sent = await sdk.sendMessage(message);
 * console.log('消息已发送:', sent.id);
 * ```
 */
async function sendMessage(message: Message, options?: SendOptions): Promise<Message> {
  // 实现...
}
````

2. **复杂逻辑注释**：复杂算法和业务逻辑必须添加注释说明

**示例**：

```typescript
// 使用指数退避策略计算重连延迟
// 公式：delay = min(baseDelay * 2^attempt, maxDelay)
// 第一次重试：1秒，第二次：2秒，第三次：4秒，最多60秒
function calculateRetryDelay(attempt: number): number {
  const baseDelay = 1000; // 基础延迟 1 秒
  const maxDelay = 60000; // 最大延迟 60 秒
  return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
}
```

### 性能优化规范

1. **避免不必要的类型断言**：优先使用类型守卫而非类型断言

**示例**：

```typescript
// ✅ 正确：使用类型守卫
function isMessage(data: unknown): data is Message {
  return typeof data === 'object' && data !== null && 'id' in data && 'content' in data;
}

if (isMessage(data)) {
  // data 类型已缩小为 Message
  console.log(data.id);
}

// ❌ 错误：使用类型断言（不安全）
const message = data as Message; // 可能运行时错误
```

2. **使用 const 断言**：字面量类型使用 `as const`

**示例**：

```typescript
// ✅ 正确：使用 as const
const statuses = ['connecting', 'connected', 'disconnected'] as const;
type Status = (typeof statuses)[number]; // 'connecting' | 'connected' | 'disconnected'

// ❌ 错误：不使用 as const
const statuses = ['connecting', 'connected', 'disconnected'];
type Status = (typeof statuses)[number]; // string
```

## 命名约定

1. 函数名使用驼峰命名，常量使用大写

**示例**：

```typescript
// ✅ 正确：函数使用驼峰命名
function sendMessage() {}
function getUserInfo() {}
async function connectToServer() {}

// ✅ 正确：常量使用大写
const MAX_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT = 5000;
const API_BASE_URL = 'https://api.example.com';

// ❌ 错误：函数使用下划线
function send_message() {}

// ❌ 错误：常量使用驼峰
const maxRetryCount = 3;
```

## 代码风格

1. 使用 prettier 默认代码风格, 如果有 .prettierrc 文件，使用 .prettierrc 定义的风格

**示例**：

- 优先检查项目根目录是否有 `.prettierrc`、`.prettierrc.json` 或 `prettier.config.js`
- 如果存在，严格按照配置文件格式化代码
- 如果不存在，使用 Prettier 默认配置（2 空格缩进、单引号、尾随逗号等）

## 其他规则

1. 需要使用中文回复所以内容和think，plan等的内容，你产出的所有文档都应该使用中文

**示例**：

- ✅ 正确：所有对话回复、代码注释、文档说明都使用中文
- ✅ 正确：README.md、CHANGELOG.md、plan.md 等文档使用中文
- ❌ 错误：使用英文回复或生成英文文档
- 注意：代码中的变量名、函数名、API 名称等技术术语可以使用英文

2. 修改项目需要每次修改验证正确后都提交git commit，并且写清楚修改内容，不需要帮我push。如果当前目录不是git管理并且不是一个git管理的子目录则先git init

**示例**：

```bash
# ✅ 正确的提交流程
# 1. 修改代码
# 2. 验证功能正确（运行测试、检查语法等）
# 3. 提交变更
git add .
git commit -m "feat: 添加消息重试机制

- 实现指数退避重试策略
- 添加最大重试次数限制
- 更新相关测试用例"

# ❌ 错误：修改后不验证就提交
# ❌ 错误：提交信息不清晰（如 "fix bug"）
# ❌ 错误：自动执行 git push（不要执行）
```

3. 如果我没打开任何项目，你不需要为我做任何git相关操作

**示例**：

- ✅ 正确：用户在项目目录中 → 可以执行 git 操作
- ❌ 错误：用户只是聊天，没有打开项目 → 不执行任何 git 操作
- 判断方式：检查当前工作目录是否是有效的项目目录

3. 项目需要有版本号，每次修改并且验证正确后都需要对版本号进行迭代

**示例**：

```json
// package.json
{
  "version": "1.0.0" // 初始版本
}

// 修复 bug → 1.0.1 (patch)
// 添加新功能 → 1.1.0 (minor)
// 破坏性变更 → 2.0.0 (major)
```

**版本号规则**（遵循 SemVer）：

- **MAJOR**：破坏性变更（API 不兼容）
- **MINOR**：新功能（向后兼容）
- **PATCH**：bug 修复（向后兼容）

4. 可能的提供完整的changelog.md文件，changelog.md文件需要写明修改内容，修改时间，修改人，修改版本，修改内容等信息，使用中文

**代码注释示例**：

```typescript
/**
 * 发送消息到服务器
 * @param message - 要发送的消息对象
 * @param retryCount - 当前重试次数，默认为 0
 * @returns Promise<Message> 返回发送成功的消息对象
 * @throws {SDKError} 当发送失败时抛出错误
 */
async function sendMessage(
  message: Message, // 消息对象，包含 id、content 等字段
  retryCount: number = 0 // 重试次数，用于控制重试逻辑
): Promise<Message> {
  // 检查消息是否有效
  if (!message || !message.content) {
    throw new SDKError(ErrorCode.MESSAGE_INVALID, '消息内容不能为空');
  }

  // 发送消息到服务器
  const response = await this.websocket.send(message);

  return response;
}
```

**CHANGELOG.md 示例**：

```markdown
# 更新日志

## [1.1.0] - 2025-01-27

### 新增

- 添加消息重试机制，支持指数退避策略
- 实现离线消息同步功能

**修改人**: AI Assistant  
**修改版本**: 1.1.0  
**修改时间**: 2025-01-27 14:30:00

### 修改

- 优化连接管理器性能，减少内存占用
- 更新错误处理逻辑，提供更详细的错误信息

**修改人**: AI Assistant  
**修改版本**: 1.1.0  
**修改时间**: 2025-01-27 15:00:00

### 修复

- 修复消息乱序问题
- 修复重连时消息重复发送的 bug

**修改人**: AI Assistant  
**修改版本**: 1.1.0  
**修改时间**: 2025-01-27 16:00:00
```

5. 如果我是疑问句，你需要先对我的问题进行解答，之后再询问我如何操作

**示例**：

- 用户："消息格式怎么定义？"
- ✅ 正确流程：
  1. 先回答：消息格式定义在 `src/protocol/protobuf/messages.proto` 和 `src/types/index.ts`
  2. 然后询问："需要我帮你修改消息格式吗？"
- ❌ 错误：直接开始修改代码，不回答问题

6. 当我要进行新功能开发时，你需要先询问我是否要新建一个分支

**示例**：

- 用户："我要添加群组功能"
- ✅ 正确流程：
  1. 先询问："需要我创建一个新的功能分支吗？比如 `feature/group-functionality`"
  2. 等待用户确认后再创建分支和开始开发
- ❌ 错误：直接开始开发，不询问分支问题

7. 同一个问题两次修改都没有解决，你需要重头思考问题，确保不会一直用同一种方式处理

**示例**：

- 场景：消息发送失败，第一次尝试修复连接问题，第二次尝试修复消息格式，都失败了
- ✅ 正确流程：
  1. 停止当前修复尝试
  2. 重新分析问题：检查错误日志、网络状态、服务器响应等
  3. 提出新的解决方案："我注意到可能是认证问题，让我检查一下 token 是否有效"
  4. 尝试完全不同的解决方向
- ❌ 错误：继续用同样的方法修复（如继续调整连接参数）

8. 如果是一个新的项目，你需要先对项目进行学习和总结，之后输出到docs/process/project-summary.md中，以便我对你了解项目有一个大概的认知

**示例**：

- 场景：用户打开了一个新项目
- ✅ 正确流程：
  1. 读取项目关键文件：README.md、package.json、主要源代码文件
  2. 分析项目结构、技术栈、主要功能
  3. 生成 `docs/process/project-summary.md` 文件，包含：
     - 项目概述
     - 技术栈
     - 项目结构
     - 主要功能模块
     - 开发规范
  4. 向用户展示总结："我已经分析了项目，总结已保存到 docs/process/project-summary.md"
- ❌ 错误：直接开始修改代码，不了解项目结构

9. 每次大的修改，你需要先写plan，之后打开让我确认，然后才能进行编码

**示例**：

- 场景：用户要求"重构消息发送模块"
- ✅ 正确流程：
  1. 创建 `plan-refactor-message-sender.md` 文件
  2. 写入详细计划：
     - 当前问题分析
     - 重构目标
     - 实施步骤
     - 风险评估
     - 测试计划
  3. 打开文件让用户查看
  4. 询问："计划已写好，请确认是否按此执行？"
  5. 等待用户确认后再开始编码
- ❌ 错误：直接开始重构，不写计划
- 注意："大的修改"指影响多个文件、改变架构、可能引入风险的修改

11. 如果我的要求和常理或者规则相悖，你需要先不执行，想和我详细说明问题，之后再和我确认是否执行

**示例**：

- 场景1：用户要求"删除所有测试文件"
- ✅ 正确流程：
  1. 停止执行
  2. 说明问题："删除测试文件会违反 Constitution 中的测试驱动开发原则，也会影响代码质量保障"
  3. 提供替代方案："是否考虑只删除特定测试，或者重构测试而不是删除？"
  4. 等待用户明确确认后再执行

- 场景2：用户要求"使用 any 类型"
- ✅ 正确流程：
  1. 停止执行
  2. 说明问题："使用 any 类型违反了 Constitution 中的类型安全原则，会失去 TypeScript 的类型检查优势"
  3. 提供替代方案："可以使用 unknown 类型配合类型守卫，或者定义更具体的类型"
  4. 等待用户明确确认后再执行

- ❌ 错误：直接执行可能有问题的要求
