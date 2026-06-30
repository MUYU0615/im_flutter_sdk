# ProtoAdapter 骨架接入计划（基于静态 protobuf PoC）

## 背景
当前仓库已完成 `protobufjs/minimal` 的静态编解码 PoC（`src/protocol/protobuf/static-poc.ts`），但 SDK 还没有统一的 protobuf 适配抽象。为了后续支持 Web / 小程序 / uni-app / RN / Electron 的 protobuf 差异，需要先把 `ProtoAdapter` 骨架落地。

## 目标
1. 引入平台无关的 `ProtoAdapter` 接口定义。
2. 提供默认实现 `createDefaultProtoAdapter()`，先接入静态 PoC codec。
3. 给 adapter 增加最小单元测试，验证 encode/decode 与错误透传。
4. 在不影响现有业务逻辑的前提下导出该能力，供后续平台适配层接入。

## 范围与非目标
### 范围
- 新增 `src/platform/proto/` 目录（或同等结构）。
- 新增类型、默认实现、导出入口、测试。
- 文档/版本号/changelog 更新。

### 非目标
- 本次不改 `msync` 主链路编解码。
- 本次不做小程序 `weichatPb` 分支切换。
- 本次不引入 `pbjs/pbts` 生成脚本（仅保留接口位与文档说明）。

## 实施步骤
1. **定义接口**
   - 新增 `ProtoAdapter`、`ProtoCodecRegistry`、`ProtoMessageKind` 等类型。
   - 要求接口严格类型化，不使用 `any`。

2. **提供默认实现**
   - 新增 `createDefaultProtoAdapter()`。
   - 内置注册 `static-poc` codec（来自 `src/protocol/protobuf/static-poc.ts`）。
   - 支持后续 `register/getCodec` 扩展点。

3. **导出与文档**
   - 在 `src/index.ts` 增加导出。
   - 新增 `docs/proto-adapter.md`（说明用途、用法、后续扩展路线）。

4. **测试**
   - 新增 `tests/unit/protocol/proto-adapter.test.ts`：
     - 默认 codec 获取成功
     - 编码/解码回环成功
     - 未注册 codec 的错误行为

5. **质量与发布**
   - 运行目标测试与 eslint。
   - 版本号 patch 递增。
   - 更新 `CHANGELOG.md`。
   - 提交 git commit（不 push）。

## 风险与应对
- **风险**：接口命名后续可能调整。
  - **应对**：保持接口最小化，避免过早耦合平台细节。
- **风险**：导出路径影响现有构建。
  - **应对**：仅新增导出，不修改旧导出语义。

## 验证计划
- `npm run test:run -- tests/unit/protocol/protobuf-static-poc.test.ts tests/unit/protocol/proto-adapter.test.ts`
- `npx eslint src/platform/proto src/protocol/protobuf/static-poc.ts tests/unit/protocol/proto-adapter.test.ts`

