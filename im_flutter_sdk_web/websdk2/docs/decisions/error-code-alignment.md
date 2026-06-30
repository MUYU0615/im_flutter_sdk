# 错误码对齐 EMError 修改计划

## 背景与目标
- 将 SDK 内部错误码与官方 EMError 规范对齐，保证同类错误使用同一官方错误码。
- 允许扩展错误码时，必须集中登记并说明用途，避免与官方码冲突。
- 更新错误码文档与测试，确保生成文档无未提交 diff。

## 影响范围评估
- 错误码数据源：`src/rest/api-errors.json`
- 错误码常量导出：`src/utils/error-codes.ts`
- 错误映射与封装：`src/rest/errors.ts`、`src/utils/errors.ts`
- 业务使用点：`src/chat-client.ts`、`src/core/*`、`src/upload/*`、`src/validators/*` 等
- 文档与脚本：`docs/reference/errors.md`、`scripts/generate-errors-docs.js`
- 测试：`tests/unit/errors/error-handling.test.ts` 及可能涉及错误码断言的用例

## 变更步骤
1. **建立错误码映射策略**
   - 从 EMError 规范提取官方码表，确认当前 SDK 的错误类型对应的官方码。
   - 明确“同类错误同码”规则，例如：参数校验统一 `INVALID_PARAM (110)`。

2. **更新错误码数据源**
   - 重写 `src/rest/api-errors.json` 为 EMError 官方码结构。
   - 区分官方与扩展错误码；扩展错误码建立新文档登记（如 `docs/reference/error-code-extensions.md`）。

3. **更新错误码常量与使用点**
   - 调整 `src/utils/error-codes.ts` 导出的常量名称与值，使其指向 EMError 码。
   - 批量更新调用点，确保错误码一致且语义正确。

4. **同步错误文档**
   - 执行 `npm run docs:errors` 重新生成 `docs/reference/errors.md`。
   - 如有扩展错误码，同步更新扩展文档并说明用途。

5. **测试与验证**
   - 更新测试断言（如错误码数值变化）。
   - 运行 `npm test -- --run`（默认联网权限）。

6. **版本与变更记录**
   - 版本号按 SemVer 迭代（预计为 patch）。
   - 更新 `CHANGELOG.md`：修改时间/修改人/版本/内容。
   - 提交 Git 变更（不 push）。

## 风险与回滚
- 错误码变更可能影响依赖方行为，需确保文档与测试覆盖关键错误场景。
- 如出现映射冲突，优先以官方 EMError 为准，扩展码记录在扩展文档中。

## 测试计划
- `npm test -- --run`
- 重点关注错误处理相关单元测试与 REST 失败场景
