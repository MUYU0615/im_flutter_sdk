# Web 真实 E2E 基线

该文档记录当前 `tests/web_real` 全量真实 Web SDK / 真实服务 E2E 基线执行结果。

## 当前基线

- 日期：`2026-06-23 22:06:01 +0800`
- Run id：`web-real-full-baseline-20260623-r2`
- 执行命令：

```bash
python3 -m src.tools.web_e2e_runner \
  --run-id web-real-full-baseline-20260623-r2 \
  --web-sdk-mode real_sdk \
  --headless-startup-wait 150 \
  --startup-timeout 240 \
  --flutter-timeout 300 \
  -- tests/web_real --target-platform web -q
```

- 结果：
  - `63 passed`
  - `1 warning`
  - 耗时：`205.51s`

## 说明

- 当前 coverage 文档状态：
  - `supported: 178`
  - `blocked: 88`
  - `not_applicable: 46`
  - `pending: 0`
- 本基线的意义是：
  - `tests/web_real` 当前可作为长期回归入口直接执行；
  - matrix/report/audit 已经收口，不再有悬空 `pending`；
  - 后续如果新增 Web real case，应该同时更新本基线记录。

## 推荐入口

```bash
make web-real-full-baseline
```
