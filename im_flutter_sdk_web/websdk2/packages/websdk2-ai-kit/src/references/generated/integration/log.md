---
id: generated/integration/log
title: websdk2 Integration - 日志
description: 来自 SDK 集成文档 docs/integration/log.md，用于回答 日志 相关接入问题。
---

# 日志

## 日志级别

SDK 提供结构化日志，支持以下级别：

| 级别 | 值 | 说明 |
|------|-----|------|
| TRACE | 0 | 最详细 |
| DEBUG | 1 | 调试信息 |
| INFO | 2 | 一般信息 |
| WARN | 3 | 警告 |
| ERROR | 4 | 错误 |
| SILENT | 5 | 关闭日志 |

## 配置日志

```typescript
import { logger } from 'easemob-websdk';

// 设置日志级别
logger.setLevel(2); // INFO

// 开启/关闭所有日志
logger.enableAll();
logger.disableAll();

// 隐藏控制台输出（仍可通过 onLog 监听）
logger.setConsoleLogVisibility(false);
```

## 监听日志事件

```typescript
logger.onLog = (logEntry) => {
  // 可用于上报到自定义日志服务
  console.log(logEntry.level, logEntry.message);
};
```

## 日志缓存与下载

```typescript
// 配置日志缓存
logger.setConfig({
  useCache: true,
  maxCache: 3 * 1024 * 1024, // 3MB
});

// 下载缓存的日志
logger.download();
```

## 注意事项

- 日志上报到环信服务器需要商业版支持，默认关闭。
- 生产环境建议设置为 WARN 或 ERROR 级别。
