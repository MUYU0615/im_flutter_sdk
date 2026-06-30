# 034 Conversation REST Contracts

本目录用于存放 `034-conversation-rest-api` 的上游契约与样例基线。

## 目的

`034` 涉及三类上游能力：

1. conversation 主线 REST
2. conversation silent mode REST
3. chat thread REST 与 notify

根据仓库 Constitution，本 feature 的字段映射、fixture 与契约测试必须基于真实请求 / 响应样例，不能仅凭旧工程代码推测。

## 本阶段要求

在进入实现或固化 OpenAPI / fixture 前，至少补齐以下内容之一：

1. 旧工程真实请求 `curl` 与成功 / 失败响应样例
2. 已脱敏的抓包结果
3. 与真实结构等价的内部 fixture，并在备注中标明来源

## 建议拆分

- `conversation-list.*`
- `conversation-pinned.*`
- `conversation-mark.*`
- `conversation-pin-message.*`
- `conversation-silent-mode.*`
- `chat-thread-list.*`
- `chat-thread-detail.*`
- `chat-thread-members.*`
- `chat-thread-notify.*`

## 输出约束

- 对外公开 DTO 可以先在 spec 中固定命名与字段语义。
- 上游原始字段名、成功 envelope、错误体结构，必须在样例确认后再固化到正式 contract 文件。
- 若样例尚未拿到，不得在 contract 中伪造“已确认”的上游字段细节。
