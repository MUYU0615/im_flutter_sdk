---
id: upgrade-and-compatibility
title: websdk2 Upgrade And Compatibility
description: 梳理 SDK 升级、AI kit 更新、兼容性回归和推荐验证顺序，作为后续扩充的结构骨架。
---
# websdk2 Upgrade And Compatibility

梳理 SDK 升级、AI kit 更新、兼容性回归和推荐验证顺序，作为后续扩充的结构骨架。

## 升级建议顺序

1. 先看 `CHANGELOG.md` 与公开 API 变化
2. 再更新业务代码和 AI kit skill
3. 跑定向单测、coverage、分层门禁
4. 最后验证真实环境链路

## AI kit 联动

- skill 内容与 SDK 版本存在绑定关系
- SDK 升级后，建议重新执行 `npx @easemob/im-sdk-web-ai-kit update`
- 如果本地已安装旧 skill，更新时应覆盖主 skill 并清理废弃文件

## 兼容性重点

- manager 导出名与入口路径变化
- 类型签名变化
- demo / E2E 所依赖的环境变量与服务地址策略
- 平台适配器与上传链路

## 待补结构

- 分版本迁移指南
- breaking changes 清单
- 每类升级的最小验证矩阵
