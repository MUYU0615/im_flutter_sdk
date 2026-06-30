---
id: generated/api-reference/src-types-connection-ts
title: websdk2 API Reference - 连接类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/connection.ts API Reference 分段。
---

## src/types/connection.ts

### ConnectionEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| state | `ConnectionStatus` | - |
| reason | `ConnectionEventReason` | - |
| attempt | `number` | - |
| maxAttempts | `number` | - |
| isLoginPhase | `boolean` | - |
| isOnline | `boolean` | - |
| errorCode | `number` | - |
| errorMessage | `string` | - |
| timestamp | `number` | - |

### SendTimeoutEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reason | `typeof ConnectionEventReason.SEND_TIMEOUT` | - |
| timestamp | `number` | - |
