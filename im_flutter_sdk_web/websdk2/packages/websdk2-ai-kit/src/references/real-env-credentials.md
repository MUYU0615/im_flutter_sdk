---
id: real-env-credentials
title: websdk2 Real Env Credentials
description: 说明 appKey、userId、token、targetId 与固定服务地址之间的关系，以及 CI secrets 的基本约束。
---
# websdk2 Real Env Credentials

说明 appKey、userId、token、targetId 与固定服务地址之间的关系，以及 CI secrets 的基本约束。

## 基本关系

- `appKey` 标识应用，格式通常为 `org#app`
- `userId` 必须与 token 所属用户一致
- `targetId` 是测试时的对端用户、群组或聊天室标识
- token、服务地址、应用环境必须来自同一套环境

## 环境匹配原则

- 公有云 token 不应拿去连专属固定地址
- 专属集群 token 不应拿去连公有云自动解析地址
- 用户名区分大小写，复制环境变量时不要引入空格或换行

## CI 建议

- 真实凭证只放 GitHub Secrets / Environment Secrets
- 日志中只输出“是否存在”和长度，不输出真实值
- 凭证更新后，Nightly/Release 门禁应重新跑一次真实环境 E2E

## 待补结构

- token 获取与刷新流程示例
- 多套测试环境的命名规范
- demo、本地、CI 的变量注入矩阵
