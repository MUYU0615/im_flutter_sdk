# 测试覆盖率提升计划（第一轮）

## 背景与目标
- 当前全局覆盖率：Statements 71.81%、Branches 66.74%、Functions 74.93%、Lines 71.81%。
- 关键短板在函数覆盖率与部分核心模块分支覆盖率。
- 第一轮目标：在不改生产逻辑的前提下，通过补充单元测试把 Functions 提升到 80%+，并显著提升核心模块覆盖。

## 优先级与范围
1. `src/managers/presence-manager.ts`
- 新增用例覆盖未测公开方法：`addEventHandler`、`removeEventHandler`、`publishPresence`、`unsubscribePresence`。
- 覆盖关键异常分支：参数校验错误、未绑定上下文错误、REST 异常回调路径。

2. `src/core/message/message-queue.ts`
- 新增完整单测，覆盖全部公开方法与边界场景（空队列、时间范围过滤、channel 过滤、排序）。

3. `src/upload/multipart-upload.ts`
- 新增针对真实实现的单测文件（不依赖 `AttachmentUploader` 中的 mock）。
- 覆盖核心流程：初始化分片、分片上传、完成上传、中断上传、异常映射。

## 实施步骤
1. 读取并梳理目标模块当前实现与依赖。
2. 新增对应测试文件（保持现有 vitest 风格）。
3. 运行目标测试并修正失败用例。
4. 运行 `npm run test:run`、`npm run lint`、`npm run test:coverage` 验证覆盖率提升结果。
5. 更新 `CHANGELOG.md` 与版本号（patch）。
6. 提交 git commit（不 push）。

## 风险与应对
- 风险：`multipart-upload` 依赖较多，测试不稳定。
- 应对：优先 mock 网络与时间相关依赖，避免脆弱断言；必要时分阶段提交。

## 验收标准
- 新增测试全部通过。
- 全局 Functions 覆盖率 >= 80%。
- 关键模块覆盖率有可见提升，并在报告中给出对比结果。
