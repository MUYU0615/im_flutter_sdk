# 035 Session List Sync Follow-ups

日期：2026-05-06

目标：
- 补齐 `T025`、`T026`、`T038`、`T041`、`T042`、`T043`、`T046`
- 让 `tasks.md` 的未完成项与实际实现状态重新一致

实施顺序：
1. 补 `session-list-sync-merge.ts`，承接完整快照覆盖、删除与实时 patch 收敛。
2. 收紧 `session-list-sync-controller.ts` 的错误分类与回退策略。
3. 补 unit / integration / e2e 缺失测试。
4. 跑 035 相关测试，更新 `tasks.md` / `quickstart.md`。

风险点：
- 当前登录后 `refreshSessionList()` 是异步 fire-and-forget，和 spec 的“先 session-list，再 contact sync”存在偏差；需要在不破坏现有登录流程的前提下调整顺序。
- 当前 session-list 主链路实际走的是 REST conversations 快照映射，不是独立 WSS；测试与实现需以仓库现状为准补足 spec 中要求的行为语义。
