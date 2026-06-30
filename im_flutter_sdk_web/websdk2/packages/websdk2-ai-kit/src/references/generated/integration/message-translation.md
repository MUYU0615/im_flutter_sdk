---
id: generated/integration/message-translation
title: websdk2 Integration - 消息翻译
description: 来自 SDK 集成文档 docs/integration/message_translation.md，用于回答 消息翻译 相关接入问题。
---

# 消息翻译

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。
- 需要在控制台开通翻译功能。

## 获取支持的翻译语言

```typescript
const languages = await client.chatManager.getSupportedTranslationLanguages();
console.log('支持的语言:', languages);
// [{ code: 'zh-Hans', name: '中文(简体)' }, { code: 'en', name: 'English' }, ...]
```

## 按需翻译

对已有消息进行翻译：

```typescript
const result = await client.chatManager.translateMessage({
  messageId: 'msg-id-123',
  languages: ['zh-Hans', 'ja'],
});

console.log('翻译结果:', result.translations);
// { 'zh-Hans': '你好', 'ja': 'こんにちは' }
```

## 注意事项

- 翻译基于 Microsoft Azure 翻译服务。
- 需要在控制台开通翻译功能。
