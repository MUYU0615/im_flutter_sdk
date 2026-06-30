# 数据模型：日志分级与 DNS 控制上报

## 实体 1：DnsConfig

**说明**: DNS 配置响应，新增日志上报开关。  

**字段**:
- `rest.hosts: DnsHost[]`（必填）
- `msync-wx.hosts: DnsHost[]`（必填）
- `enableReportLogs?: 'true' | 'false'`（可选，严格字符串）

**校验规则**:
- `enableReportLogs` 缺失或非法值 → 视为关闭上报

## 实体 2：LogEntry

**说明**: 单条日志记录，供本地缓存与上报使用。  

**字段**:
- `timestamp: string`（ISO 时间）
- `level: 'DEBUG' | 'WARN' | 'ERROR'`
- `message: string`
- `args: ReadonlyArray<unknown>`（已脱敏）
- `context?: Record<string, unknown>`（最小必要字段）

## 实体 3：ReportState

**说明**: 日志上报运行时状态。  

**字段**:
- `enabled: boolean`（DNS 决定）
- `buffer: string[]`（缓存日志内容）
- `timerId?: ReturnType<typeof setInterval>`（定时器句柄）
- `reportIntervalMs: number`（固定 5 分钟）

**状态流转**:
- `pending`（DNS 未完成） → `enabled` / `disabled`
- `enabled`：允许定时上报与即时上报  
- `disabled`：仅缓存，不触发上报
