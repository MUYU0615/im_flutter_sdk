# 研究与决策记录：日志分级与 DNS 控制上报

> 目标：消除技术不确定性，明确实现策略与接口契约。

## 决策 1：日志上报接口与鉴权方式

- **Decision**: 沿用旧 SDK 的日志上报路径与鉴权方式：  
  - URL: `/{orgName}/{appName}/sdk/users/{userId}/client/logs`  
  - Auth: `Authorization: Bearer {token}`  
  - Payload: `{ resource: clientResource, logContent: string }`  
- **Rationale**: 旧 SDK 已验证可用，且当前项目已有 `restBaseUrl` 与 `parseAppKey` 能解析 `orgName/appName`，不需要新增协议。  
- **Alternatives considered**:  
  - 新增专用日志上报域名或独立 REST 客户端：增加维护成本。  
  - 直接复用 WebSocket 上报：协议复杂度高，不利于落地。  

## 决策 2：DNS 开关解析策略

- **Decision**: `enableReportLogs` 仅在值严格等于 `'true'` 时开启上报；`'false'` 或缺失视为关闭；非法值记录 warn 并当作关闭处理。  
- **Rationale**: 保持后向兼容与安全默认值，避免因异常数据误触发上报。  
- **Alternatives considered**:  
  - 对非法值抛错中断初始化：风险过高。  
  - 接受任何 truthy 字符串：可能导致误上报。  

## 决策 3：日志级别收敛与映射原则

- **Decision**: 移除 INFO 级别，统一映射：  
  - **debug**：过程性与诊断性日志  
  - **warn**：关键链路事件（连接建立/断开/重连失败/鉴权异常/上报失败）  
  - **error**：异常与失败  
- **Rationale**: 减少噪声并强化告警级别。  
- **Alternatives considered**:  
  - 保留 INFO 并新增别名：违背规格要求。  

## 决策 4：上报调度策略

- **Decision**: DNS 成功且开关开启时启用 5 分钟定时上报；登录成功与退出时额外立即上报；DNS 成功前日志先缓存。  
- **Rationale**: 兼顾及时性与性能；登录/退出是高价值节点。  
- **Alternatives considered**:  
  - 按条即时上报：易造成网络抖动与性能问题。  
  - 仅定时上报不即时：登录/退出关键日志可能延迟。  

## 决策 5：日志脱敏与最小必要原则

- **Decision**: 引入统一脱敏处理，采用“字段白名单 + 敏感键掩码”策略：  
  - 敏感键（token、password、Authorization、appKey、userId、deviceId 等）统一掩码  
  - 仅记录排障必要字段（method、endpoint、status、duration、errorCode）  
- **Rationale**: 满足合规要求并降低数据泄露风险，同时保证可排查性。  
- **Alternatives considered**:  
  - 记录全量请求/响应：不符合最小必要原则。  

## 决策 6：API 调用日志覆盖范围

- **Decision**: 所有对外 API 调用必须记录最小必要日志，包括 REST、WebSocket、上传/下载模块；禁止记录 payload 内容。  
- **Rationale**: 满足“可排查问题”要求，同时避免敏感数据泄漏。  
- **Alternatives considered**:  
  - 仅记录 REST：无法覆盖 WS 与上传场景。  
