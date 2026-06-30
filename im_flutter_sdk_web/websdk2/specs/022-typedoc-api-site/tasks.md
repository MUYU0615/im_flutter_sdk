# Tasks: TypeDoc API 文档站点

**Input**: `/specs/022-typedoc-api-site/spec.md`、`/specs/022-typedoc-api-site/plan.md`  
**Prerequisites**: plan.md、spec.md

## Phase 1: 注释与类型补齐

- [x] T001 在 `src/managers/push-manager.ts` 补齐公开方法双语 JSDoc（示例/参数/错误/返回）
- [x] T002 在 `src/types/push.ts` 补齐对外参数与返回类型字段双语注释

## Phase 2: 文档脚本实现

- [x] T003 在 `scripts/generate-typedoc-html.js` 实现 TypeDoc HTML 生成（支持 zh/en）
- [x] T004 在 `package.json` 增加 `docs:api:html:*` 与主入口脚本
- [x] T005 保留并整理 Markdown 生成脚本入口（`docs:api:md:*`）

## Phase 3: 质量门禁与产物

- [x] T006 在 `scripts/check-api-doc-comments.js` 校验双语注释完整性
- [x] T007 生成 `docs/reference/api-reference.zh-CN.md` 与 `docs/reference/api-reference.en-US.md`
- [x] T008 生成 `docs-site/api/zh-CN` 与 `docs-site/api/en-US` HTML 站点

## Phase 4: 验证与发布信息

- [x] T009 执行 `npm run docs:api:check`
- [x] T010 执行 `npm run test:run -- tests/unit/managers/push-manager.test.ts tests/types/push-manager-types.test.ts tests/contract/push-manager.contract.test.ts`
- [x] T011 更新 `CHANGELOG.md` 与版本号
