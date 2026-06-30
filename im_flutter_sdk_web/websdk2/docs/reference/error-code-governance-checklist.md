# Web SDK2 错误码治理清单

生成时间：2026-05-20

当前状态更新：2026-05-26。Push 公开错误码已收敛到服务端/移动端同号 `1501/1502`；新增 `docs/reference/error-codes.md` 作为按 canonical code 聚合的用户侧入口，并通过 `npm run errors:check` 固化治理约束。

相关输入：

- Web 当前实现：`src/utils/error-codes.ts`、`src/rest/errors.ts`、`src/rest/client.ts`
- Web 对照矩阵：`docs/reference/websdk2-error-code-review-matrix.md`
- 移动端实现：`/Users/zhangdong/code/emclient-linux/include/emerror.h`、`/Users/zhangdong/code/emclient-linux/src/emerror.cpp`
- 移动端连接处理：`/Users/zhangdong/code/emclient-linux/src/emsessionmanager.cpp`

## 目标口径

- 对外公开能力以 `canonical code` 为主，而不是以内部别名为主。
- Web 不要求与移动端所有错误码严格同号，但共享语义需要有稳定兼容策略。
- Web 独有错误码暂时保留。
- 同一 `canonical code` 应对应一种稳定的用户处理建议；若处理建议不同，才考虑拆出新公开错误码。

## 现状结论

- Web 当前 `ERROR_CODES` 导出 133 个别名，但去重后只有 99 个数值。
- Web 运行时错误对象本体只有 `code`，别名不会直接暴露给用户。
- REST 层已经具备 `serverCode` / `canonicalCode` 并存的基础设施，适合继续沿这个方向治理。
- Web 当前不是通过响应体 `code` 字段统一判断成功失败，而是以 HTTP 状态为主；HTTP `2xx` 进入成功分支后，再由各业务解析 `data`。

## 成功态治理

### `EM_NO_ERROR = 0`

- 移动端 `0` 明确定义为成功，见 `EM_NO_ERROR = 0`。
- Web 当前未导出 `0`，也不建议把 `0` 加入 `ERROR_CODES`。
- 原因：Web 成功态通常走 `resolve` 返回业务对象，不走 `SDKError`。

建议：

- 继续保持“成功不依赖公开错误码”。
- 文档上明确说明：若服务端返回 `{ code: 0, data: ... }`，Web 只要 HTTP 为 `2xx` 就按成功流处理。

### `PARTIAL_SUCCESS = 7`

- 移动端 `7` 明确定义为“请求成功，但部分值有错误”。
- 该语义不是所有批量 API 通用，而是只出现在部分支持“部分成功、部分失败”的结果模型中。
- 已确认的典型场景是聊天室属性批量操作：`successKeys > 0 && errorKeys 非空` 时，移动端返回 `PARTIAL_SUCCESS`。
- 批量获取用户资料不属于这个模型。移动端 `fetchUsersPropertyByType` 在拿到合法 `data` 后直接视为 `EM_NO_ERROR`，即使请求的部分用户未返回。

建议：

- 不把 `7` 当成全局通用错误码补进所有 API。
- 若 Web 后续需要对齐移动端，仅在天然支持“部分成功”结果的 API 建模 `PARTIAL_SUCCESS`。
- 当前聊天室属性批量操作可继续使用 `{ appliedKeys, failedKeys }` 结果模型；是否额外暴露 `7`，可作为后续增强项，不必优先处理。

## 治理分组

### A. 已有基础设施，优先收敛文档口径

这些项当前实现可工作，但文档和公开模型需要统一到 `canonical code`：

| 类型       | 现状                                                   | 建议                                                           |
| ---------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| 多别名同码 | `110/300/301/303/500/405/407` 等多个别名共用一个数值   | 对外文档只公开 `canonical code`；别名降级为“内部来源/触发场景” |
| REST 映射  | 已保留 `details.serverCode` 与 `details.canonicalCode` | 文档明确要求用户优先按 `code` 处理，排障时再看 `serverCode`    |
| 成功态     | 成功分支不依赖 `ERROR_CODES`                           | 明确“成功结果模型”和“错误模型”分离                             |

### B. 共享语义已统一编号

| Web 公开码 | 移动端码 | Web 语义              | 移动端常量            | 当前状态                                       |
| ---------: | -------: | --------------------- | --------------------- | ---------------------------------------------- |
|        219 |      219 | `USER_MUTED_BY_ADMIN` | `USER_MUTED_BY_ADMIN` | 已与移动端同号                                 |
|        221 |      221 | `USER_NOT_ON_ROSTER`  | `USER_NOT_ON_ROSTER`  | 已与移动端同号                                 |
|       1501 |     1501 | Push 免打扰设置失败   | `PUSH_BIND_FAILED`    | 已按服务端/移动端编号收敛；保留 Web 语义常量名 |
|       1502 |     1502 | Push 语言设置失败     | `PUSH_UNBIND_FAILED`  | 已按服务端/移动端编号收敛；保留 Web 语义常量名 |

说明：

- Push 这条链路当前直接公开服务端/移动端同号 `1501/1502`，不再使用 Web 独立编号。
- `216/219`、`222/221` 的历史漂移已在本轮修正。
- `216` 现在回到 `USER_KICKED_BY_CHANGE_PASSWORD`，`219` 才表示 `USER_MUTED_BY_ADMIN`。

### C. 本轮已补齐的连接/登录错误码

下列错误码本轮已按旧 Web SDK / 移动端语义补齐：

| 移动端码 | 移动端语义                       | 触发路径            | 当前状态 |
| -------: | -------------------------------- | ------------------- | -------- |
|      206 | `USER_LOGIN_ANOTHER_DEVICE`      | Statistics/连接断开 | 已补齐   |
|      207 | `USER_REMOVED`                   | Statistics/连接断开 | 已补齐   |
|      216 | `USER_KICKED_BY_CHANGE_PASSWORD` | Statistics/连接断开 | 已补齐   |
|      217 | `USER_KICKED_BY_OTHER_DEVICE`    | Statistics/连接断开 | 已补齐   |
|      218 | `USER_ALREADY_LOGIN_ANOTHER`     | 登录阶段返回        | 已补齐   |
|      220 | `USER_DEVICE_CHANGED`            | Provision 资源变更  | 已补齐   |

判断依据：

- `206/207/216/217` 通过 Statistics 消息链路补齐，并在断开事件里附带 `errorCode/errorMessage`。
- `218` 在本地登录冲突时返回。
- `220` 通过 provision `RESOURCE_CHANGED` 映射补齐。
- `LOGOUT` 命令当前仅完成基础解码记录；账号踢下线的主要语义仍由 Statistics / Provision 提供。

建议：

- 下一步如需继续对齐，可补充 `LOGOUT` 命令的更完整语义。
- 若还要继续推进移动端对齐，下一优先级建议放在剩余未覆盖的连接/服务器码上。

### D. 已归并处理，不建议为了对齐而硬补

| 移动端码 | 移动端语义                  | Web 当前策略                                       |
| -------: | --------------------------- | -------------------------------------------------- |
|      104 | `INVALID_TOKEN`             | 统一归并到鉴权过期/失败处理                        |
|      112 | `QUERY_PARAM_REACHES_LIMIT` | 多数场景归并到 `SERVICE_LIMIT_EXCEEDED`            |
|      205 | `USER_ILLEGAL_ARGUMENT`     | 统一归并到 `110` 参数错误类                        |
|      209 | `PUSH_UPDATECONFIGS_FAILED` | 当前由 Web Push 业务错误映射覆盖                   |
|      309 | `SERVER_RESPONSE_ILLEGAL`   | 当前多归并到通用服务端/业务错误                    |
|  512/513 | 流消息超时类                | Web 已有独立流消息错误别名，但尚未公开为移动端同号 |

建议：

- 这类优先保持“归并后的 canonical code”稳定，不为追求编号完整性引入更多公开码。

### E. 范围外或当前产品面未覆盖

| 类别                | 代表错误码                              | 说明                                                           |
| ------------------- | --------------------------------------- | -------------------------------------------------------------- |
| 注册/密码           | `102/103/203/208`                       | Web 当前不做账号注册和密码登录参数校验                         |
| 音视频/Call         | `800+`                                  | 不属于当前 Web SDK 产品面                                      |
| Thread              | `1400-1402`                             | 若当前公开 API 未覆盖，可继续不补                              |
| 文件删除            | `404`                                   | Web 当前无对外文件删除能力                                     |
| Push 设备绑定旧命名 | `PUSH_BIND_FAILED`/`PUSH_UNBIND_FAILED` | Web 保留免打扰/语言设置语义名，但编号与移动端 `1501/1502` 对齐 |

## 推荐落地顺序

1. 先统一文档口径：公开 `canonical code`，把别名改成来源说明。
2. 审计连接层：重点确认 `LOGOUT` / 被踢 / 改密 / 设备变更。
3. 对 `216/219`、`222/221` 这类历史漂移保留显式兼容说明。
4. 仅在确有用户处理差异的场景下，才新增公开错误码。

## 本轮结论

- 当前最需要处理的不是“把移动端所有缺失码补齐”，而是先把 Web 的公开错误模型收敛清楚。
- `0` 应继续视为成功态概念，而不是公开错误码。
- `7` 只适合出现在部分成功的结果型 API，不适合扩散到普通批量查询。
- 连接类断开原因是本轮最值得继续深挖的实现风险点。
