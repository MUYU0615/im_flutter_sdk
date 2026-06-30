# 技术调研文档

**创建日期**: 2025-01-27  
**功能**: IM SDK Web 重构

## 技术选型决策

### 1. TypeScript 严格模式

**决策**: 使用 TypeScript 5.0+，启用 strict mode

**理由**:
- Constitution 要求类型安全，strict mode 提供最强的类型检查
- 现代 Web SDK 的标准实践，提供完整的类型定义
- 编译时错误检查，减少运行时错误
- 优秀的 IDE 支持和自动补全

**替代方案考虑**:
- JavaScript: 缺乏类型安全，不符合 Constitution 要求
- Flow: 社区支持较少，TypeScript 生态更完善

---

### 2. WebSocket 通信协议

**决策**: 使用原生 WebSocket API，不依赖第三方库

**理由**:
- 浏览器原生支持，无需额外依赖
- 性能最优，无中间层开销
- 符合 Constitution 性能优先原则
- 支持 TLS/SSL 加密（wss://）

**替代方案考虑**:
- Socket.io: 功能过于复杂，包含轮询降级等不需要的功能
- SockJS: 主要用于兼容旧浏览器，本项目目标现代浏览器
- 长轮询: 性能差，延迟高，不符合性能要求

**实现要点**:
- 使用 `new WebSocket(url)` 创建连接
- 监听 `onopen`, `onmessage`, `onerror`, `onclose` 事件
- 支持二进制消息（ArrayBuffer）和文本消息
- 实现心跳机制保持连接活跃

---

### 3. IndexedDB 本地存储

**决策**: 使用 IndexedDB 进行消息持久化和离线缓存

**理由**:
- 浏览器原生 API，无需额外依赖
- 支持大量数据存储（远超 LocalStorage 的 5-10MB 限制）
- 异步 API，不阻塞主线程
- 支持索引查询，适合消息按时间排序
- 支持事务，保证数据一致性

**替代方案考虑**:
- LocalStorage: 容量限制（5-10MB），同步 API 会阻塞
- SessionStorage: 会话级存储，页面关闭后丢失
- WebSQL: 已废弃，不再推荐使用

**实现要点**:
- 创建数据库存储消息、会话、群组等数据
- 使用索引优化查询（按时间戳、会话ID等）
- 实现数据迁移机制，支持版本升级
- 处理存储配额限制（QuotaExceededError）

---

### 4. protobuf 消息协议

**决策**: 使用 protobufjs 进行消息序列化/反序列化

**理由**:
- Constitution 要求支持 protobuf 扩展
- 二进制协议，体积小，性能高
- 支持向后兼容的协议演进
- 类型安全，有完整的类型定义

**替代方案考虑**:
- JSON: 体积大，性能较差，但易于调试
- MessagePack: 性能好，但扩展性不如 protobuf
- 纯二进制: 需要手动编解码，维护成本高

**实现要点**:
- 定义 .proto 文件描述消息结构
- 使用 protobufjs 生成 TypeScript 类型
- 支持自定义消息类型扩展
- 提供消息编解码工具函数

---

### 5. 事件系统设计

**决策**: 实现基于 EventEmitter 模式的事件系统

**理由**:
- 解耦组件，支持插件化扩展
- 符合 Constitution 可扩展性原则
- 提供清晰的事件回调机制
- 支持多个监听器

**实现要点**:
- 实现 `on`, `off`, `once`, `emit` 方法
- 支持事件命名空间（如 `message:received`, `connection:connected`）
- 提供类型安全的事件类型定义
- 支持异步事件处理（Promise）

---

### 6. 断线重连策略

**决策**: 指数退避重连，最大重试间隔 60 秒

**理由**:
- Constitution 要求指数退避策略
- 避免频繁重连造成服务器压力
- 网络恢复后快速重连

**实现要点**:
- 初始重连间隔：1 秒
- 最大重连间隔：60 秒
- 重连次数：无限制（直到手动停止或连接成功）
- 检测网络状态变化（online/offline 事件）

---

### 7. 消息重试机制

**决策**: 最多重试 3 次，指数退避

**理由**:
- Constitution 要求消息重试
- 3 次重试平衡了可靠性和性能
- 指数退避避免服务器压力

**实现要点**:
- 失败消息存储在 IndexedDB
- 重连成功后自动重发失败消息
- 重试间隔：1s, 2s, 4s
- 超过重试次数后通知应用层

---

### 8. 消息顺序和去重

**决策**: 基于时间戳和消息ID保证顺序和去重

**理由**:
- 保证消息按时间顺序处理
- 避免重复消息被处理
- 处理网络乱序问题

**实现要点**:
- 消息包含时间戳和唯一ID
- 维护已处理消息ID集合（使用 Set）
- 消息队列按时间戳排序
- 处理时间戳相同的情况（使用消息ID作为次要排序键）

---

### 9. 多标签页支持

**决策**: 使用 BroadcastChannel API 实现标签页间通信

**理由**:
- 避免多个标签页重复连接
- 共享连接状态和消息
- 符合现代浏览器最佳实践

**实现要点**:
- 主标签页负责 WebSocket 连接
- 其他标签页通过 BroadcastChannel 接收消息
- 检测标签页关闭，转移主标签页角色
- 使用 SharedWorker（可选，更复杂但更稳定）

---

### 10. 测试框架选型

**决策**: 使用 Vitest 进行单元测试

**理由**:
- 与 Vite 构建工具集成良好
- 支持 TypeScript 原生
- 性能优秀，运行速度快
- API 与 Jest 兼容，学习成本低

**替代方案考虑**:
- Jest: 配置复杂，性能较差
- Mocha: 需要额外配置，功能不如 Vitest 完整

**实现要点**:
- 使用 @testing-library 进行组件测试
- Mock WebSocket 和 IndexedDB
- 使用 Playwright 进行集成测试
- 配置覆盖率报告（≥80%）

---

## 最佳实践参考

### WebSocket 连接管理
- 实现心跳机制（ping/pong）保持连接活跃
- 处理网络切换场景（WiFi ↔ 移动网络）
- 优雅关闭连接（发送关闭帧）

### IndexedDB 使用
- 使用事务保证数据一致性
- 实现数据库版本迁移
- 处理存储配额限制
- 定期清理过期数据

### 错误处理
- 提供清晰的错误码和错误信息
- 区分网络错误、服务器错误、业务错误
- 提供错误恢复建议

### 性能优化
- 消息批量处理，减少事件触发频率
- 使用 Web Workers 处理大量消息（可选）
- 实现消息分页加载
- 优化 IndexedDB 查询性能

---

## 风险评估

### 高风险项
1. **IndexedDB 兼容性**: 某些旧浏览器可能不支持，需要降级方案
   - 缓解措施: 明确目标浏览器版本，提供降级提示

2. **存储配额限制**: 用户设备存储空间不足
   - 缓解措施: 实现数据清理策略，限制存储大小

3. **消息顺序保证**: 网络乱序可能导致消息顺序错误
   - 缓解措施: 实现消息排序队列，基于时间戳和消息ID

### 中风险项
1. **WebSocket 连接稳定性**: 某些网络环境可能频繁断线
   - 缓解措施: 实现完善的重连机制，提供连接质量监控

2. **protobuf 协议演进**: 协议变更可能导致兼容性问题
   - 缓解措施: 遵循 protobuf 向后兼容规则，提供版本管理

---

## 参考资料

- [WebSocket API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [IndexedDB API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [protobufjs 文档](https://protobufjs.github.io/protobuf.js/)
- [TypeScript 严格模式](https://www.typescriptlang.org/tsconfig#strict)
- [Web Workers API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
