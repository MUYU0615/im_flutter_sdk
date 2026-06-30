# 项目总结

## 项目概述

本项目是 IM SDK Web 的重构项目，目标是构建高性能、类型安全、可扩展的即时通讯 SDK。项目采用 Spec-Kit 规范驱动开发流程，通过文档驱动需求、方案和实现。

## 技术栈

- TypeScript 5.0+（strict 模式）
- Vite 构建
- Vitest 测试
- ESLint + Prettier 规范化
- protobufjs + zod 作为核心依赖

## 项目结构

- `.cursor/`：Cursor 命令与规则配置
- `.specify/`：Spec-Kit 记忆、模板与脚本
- `specs/`：功能规格文档（含 spec/plan/tasks/data-model/contracts）
- `src/`：核心源码目录
- `tests/`：测试目录

## 主要功能模块（按文档）

- 消息协议与类型：`src/protocol/protobuf`、`src/types`
- 消息类型枚举：`src/protocol/message-types.ts`
- 消息收发逻辑：`src/core/message/message-sender.ts`、`src/core/message/message-receiver.ts`

## 开发规范

- 文档优先：先更新 specs 文档，再实现代码
- 严格类型：TypeScript strict，禁止 any，函数显式返回类型
- 导入导出：优先命名导出，类型使用 `import type`
- 代码质量：遵循 ESLint/Prettier，测试用 Vitest

## TODO:

- [X]lite 版本，分出lite版 manager?
- [X]日志上传
- [X]重连
- [X]SDK 初始化控制参数： appid, delivery apiUrl 等
- [X]缓存模块
- [X]PresenceManager
- [X]统一小程序 uniapp rn，上传， 构造附件消息， protobufjs, 平台判断
- [X]消息控制参数
- [X]合并消息,流式消息
- 数据上报
- [x] api 文档

- ChatManager 替换 ChannelManager，收敛消息发送与消息事件入口
- UserInfoManager 用户信息缓存，消息里带上用户信息

## 本周进展 1.28-2.4

- 确定 API 风格
- 增加 Manager 管理器，注入需要的 Manager，每个 Manager 监听本模块事件
- 增加 ChatManager，负责消息发送与消息事件监听
- 统一 Error结构， 去掉 opration, 保留details(可选), 和移动端对齐 error code
- 增加初始化参数：enableHttpDns， deviceId， restApiUrl， wsUrl，useReplacedMessageContents， customDeviceName，autoLogin 等
- 增加日志上传，日志分级：debug warn error
- 总结 constitution error

## 本周进展 2.5-2.11

- 增加重连逻辑
- 完善 constitution：覆盖度，错误处理，事件处理，日志，技术栈，API 命名规范
- 缓存模块
- lite 版本 - 每个模块分文件单独导出
- PresenceManager

## 本周进展 2.12 - 2.25

- 消息控制参数
- 更新缓存模块方案，用老接口实现, 数据加密
- 统一小程序 uniapp rn，上传， 构造附件消息， protobufjs, 平台判断
- 合并消息
- 流式消息

## 本周进展

- api 文档
- pushManager 功能测试, api review
- presenceManager 功能测试, api review
  - api名称
  - api返回数据和移动端不统一
  - 测试case 基于mock数据，和真实数据结构有区别
  - 功能理解出错，设置的 api参数分类型，返回的数据也分类型了， 实际 api返回内容合并在一起 （原因 api本身太复杂，好几个功能在一起）

TODO:
增加覆盖率，确定测试程度
无头浏览器跑demo 真实环境
api 返回数据 整理成md文档
换模型 review test case, 意见

## 本周进展 3.4 - 3.11

- 增加覆盖率, 函数级达到 90%
- 补充集成测试mock server, E2E测试
  标准测试分层
  ├── Unit
  ├── Integration 本地
  └── E2E

专项测试
├── Contract
└── Type

执行门禁
├── PR Gate
├── Nightly Gate
└── Release Gate

TODO:
skill
cache 真实测试
联系人
Integration 本地,

## 本周进展 3.12

- 添加 skill 6 个
- 测试 localStorage 存满情况
- 集成测试改成全部使用mock server
- 联系人同步

补全 contact manager
user info manager

## 本周进展 3.25

增加同步联系人功能
补全 contact manager api
整理 contact 相关 rest api 请求结果

TODO:
review 代码
user info manager
错误码补全
老 sdk 加 websocket 通道 （等语音转文字方案确定后再执行）

## 本周进展 4.1

- review 代码
- user info manager

TODO:
错误码补全
wayang case 转换

## 本周进展 4.8 - 4.15

群组 api
聊天室 api
发送大图

TODO:

1. 错误码补全
2. 面向对象

## 本周进展 4.16 - 4.22

1. 补群组的错误码
2. 删除 channelManager, 增加 chatManager
3. 消息携带用户信息
4. groupManager 改造

TODO:
websocket 同步群组
chatManager + 会话
其他 manager 改造

## 本周进展 4.23 - 4.29

1. userInfoManager 订阅用户资料
2. chatManager 消息相关 api
3. 和移动端对齐错误码
4. 发消息 bug 修复：沙箱环境发消息服务端没回ack导致无限重连，原逻辑：发送超时就重新连接，连接成功后重新发未成功的消息，再超时，再重连。修改成：超时重试一次，失败后回调失败，不重连。

websocket 同步群组
收益：
1 发送消息带上name card更新时间
2 api 形式变成同步？

缺点：
1 数据量大，成员列表不能一起同步下来
2 很多群可能是不活跃的群，不需要同步的数据

推荐单独同步 myNamecardUpdateTime

//TODO
覆盖度
mock 同步群组
本地缓存性能指标

npm 包里加skill

uikit
怎样定制化 skill 几种常见的风格
查错误

sdk
查错误
集成

## 本周进展 4.30 - 5.7

1. 覆盖度
2. 修复ci
3. 加skill

TODO:
知识变成 md文件
mock 同步群组

## 本周进展 5.8 - 5.13

1. 知识变成 md文件
2. review 完 chatClient message 两部分的 api
3. 去掉消息里的 channel

TODO:

同步群组数据，目前在方案阶段
同步会话列表
消息搜索

review 完全部 api之后，wayang case 转成e2e
集成/迁移文档，完善 skill knowledge

## 本周进展 5.14 - 5.21

1. 完成api review 及修改
  问题根源：
    a. api及参数 命名修改
    b. 消息部分，创建消息的参数有些是不必要的，ai根据消息体内容来写的参数，有些字段应该是 sdk内部设置，不用传参
    c. 有些 api 支持分页，老sdk也没有分页，属于原来就没有对齐
    d. 初始化的一些参数设计变更
    e. 遗漏的功能

2. 增加 wayang case 登录部分
3. 同步会话列表, 消息搜索 在联调

TODO:

回扫，对比功能
同步群组数据
集成/迁移文档，完善 skill knowledge


## 本周进展 5.22 - 5.27

1. 完成 wayang case 迁移
2. api reference 补充注释，调整结构
3. 回扫，对比功能

TODO:
同步群组数据 - 方案大体已确定
集成/迁移文档，完善 skill knowledge

## 本周进展 5.28 - 6.3

1. 集成/迁移文档，完善 skill knowledge
2. 和移动端对比功能发现问题修改
3. review api返回值，调整字段
4. 测试, 主要修改会话部分

## 本周进展 6.4 - 6.10

1. 增加 thread manager
2. 完成第二通道同步群组
3. 修改消息/会话已读
4. 测试问题修复 替换 sdk过程中遇到的问题

TODO:
1. 本地缓存访问权限 -- 登录后可调用