# 019 研究记录（Phase 0）

## Decision 1: 接收链路采用“元信息回调 + 按需详情解码”双阶段模型

- **Decision**: 下行 `combine` 消息默认仅回调元信息（标题、摘要、URL、层级等），并提供公开 API 按需下载并解码 `messageList` 详情。
- **Rationale**: 与旧工程 `generateMessage case 8` 的行为一致，避免把下载与解码强耦合到所有接收场景，降低默认接收开销。
- **Alternatives considered**:
  - 自动下载并展开详情：会增加接收链路时延与失败面。
  - 仅回调元信息且不提供 SDK 解码能力：业务需自行实现协议解码，成本高且易不一致。

## Decision 2: `messageList` 顺序严格保留输入顺序

- **Decision**: 发送编码、上传、按需解码全链路保持 `messageList` 原始顺序，不做 SDK 重排。
- **Rationale**: 用户感知顺序通常由业务显式构造，重排会导致预期偏差并增加跨端差异风险。
- **Alternatives considered**:
  - 按时间排序：不同消息来源时间戳不统一，可能改变业务语义。
  - SDK 自定义排序策略：规则复杂且不可预测。

## Decision 3: `messageList` 仅允许业务消息类型，系统消息必须拒绝

- **Decision**: 允许 `txt/img/video/audio/file/loc/custom/combine`，拒绝 ACK/回执/撤回等系统消息。
- **Rationale**: 系统消息不面向业务回调，进入合并包会导致可解释性差与协议兼容风险。
- **Alternatives considered**:
  - 放行全部类型：高风险，易出现不可消费数据。
  - 静默过滤系统消息：会造成输入输出不一致，不利于问题排查。

## Decision 4: 详情解码采用“全量成功或整体失败”

- **Decision**: 按需下载并解码时，任一子消息解析失败即整体失败，不返回部分结果。
- **Rationale**: 合并消息本质是一个完整快照，部分返回会破坏顺序与上下文完整性。
- **Alternatives considered**:
  - 部分成功 + 错误列表：业务处理复杂且存在误展示风险。
  - 忽略失败项：可能造成静默数据丢失。

## Decision 5: 条数上限 300 同时作用于发送与按需解码

- **Decision**: 发送阶段与按需详情解码阶段均执行 300 条上限校验，超限直接失败。
- **Rationale**: 保证约束一致，防止异常大包引发内存与性能风险。
- **Alternatives considered**:
  - 仅发送侧限制：历史或异常数据仍可能在接收侧触发大包风险。
  - 取消上限：不可控，不符合稳定性目标。

## Decision 6: 跨平台下载与二进制处理复用 018 适配层语义

- **Decision**: 下载、读取、上传输入差异统一经平台适配层处理，保持多端错误语义一致。
- **Rationale**: 018 已建立能力注入与 fail-fast 机制，复用可减少平台特化分支。
- **Alternatives considered**:
  - 各平台单独实现：重复逻辑多，维护成本高。
  - 仅 Web 先行：会与本期跨平台目标冲突。
