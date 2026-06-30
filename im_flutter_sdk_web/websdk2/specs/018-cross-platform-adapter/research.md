# 018 研究记录（Phase 0）

## Decision 1: 平台识别采用“显式优先 + 运行时探测”双轨策略

- **Decision**: 优先使用业务显式传入的平台偏好（如 `prefer`），未传时按运行时能力探测；当探测冲突时按固定优先级落到唯一平台。
- **Rationale**: 降低误判风险，同时保留业务侧在复杂壳环境（如 Electron、uni-app H5）中的强制控制能力。
- **Alternatives considered**:
  - 仅自动探测：在混合环境下误判概率高。
  - 仅手动指定：接入成本高，且默认体验较差。

## Decision 2: 关键能力缺失采用 fail-fast（初始化失败）

- **Decision**: 对连接、请求、上传、编解码这类关键能力缺失场景，初始化阶段直接失败并返回结构化错误。
- **Rationale**: 避免“初始化成功但运行中失败”的不可预测行为，便于业务快速发现环境问题。
- **Alternatives considered**:
  - 运行时延迟报错：定位成本高，容易在生产暴露。
  - 自动降级到子能力：与规格“统一语义”目标冲突。

## Decision 3: 同版本只保留单一静态 protobuf 方案

- **Decision**: 采用单一静态 protobuf 方案（基于 `protobufjs/minimal` + 静态生成产物），同版本不并存回退实现。
- **Rationale**: 保持跨平台行为一致性，降低双实现维护与协议漂移风险。
- **Alternatives considered**:
  - 小程序单独 `weichatPb`：维护成本高，跨端一致性校验复杂。
  - 运行时双轨回退：增加代码分支与测试矩阵复杂度。

## Decision 4: 附件上传源对象采用统一规范化模型

- **Decision**: 适配层先将 `File | MiniAppFile(path) | RNFile(uri)` 规范化为统一上传源，再映射到具体平台上传 API。
- **Rationale**: 把输入差异收敛到边界层，业务与核心模块仅面对统一语义。
- **Alternatives considered**:
  - 在业务层区分平台对象：违背“统一 API”目标。
  - 在每个上传实现内部各自解析：重复逻辑多且一致性难保障。

## Decision 5: `uni-app H5` 独立验收但可复用 Web 用例

- **Decision**: 将 `uni-app H5` 作为独立验收维度，允许复用部分 Web 测试步骤与断言模板。
- **Rationale**: 虽然底层能力相近，但框架封装差异可能导致行为差别，需独立记录结果。
- **Alternatives considered**:
  - 并入 Web 不单测：无法发现 uni 包装层差异问题。
  - 完全独立重写用例：重复工作较多，不必要。

## Decision 6: Electron 默认仅内置 Renderer 支持

- **Decision**: 内置能力覆盖 Electron Renderer；Main 进程通过自定义适配器注入接入。
- **Rationale**: Renderer 与 Web 能力模型接近，落地成本低；Main 环境差异大，强行内置会扩大首期范围。
- **Alternatives considered**:
  - 首期同时内置 Main：范围过大，影响交付节奏。
  - 完全不支持 Electron：不满足当前业务目标。
