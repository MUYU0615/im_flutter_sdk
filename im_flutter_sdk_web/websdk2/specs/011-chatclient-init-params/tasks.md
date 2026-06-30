---

description: "ChatClient 初始化参数扩展"
---

# 任务清单：ChatClient 初始化参数扩展

**Input**: `/specs/011-chatclient-init-params/`  
**Prerequisites**: plan.md、spec.md  
**Tests**: 需要覆盖参数校验与默认值  
**Organization**: 任务按实现阶段分组

## 格式: `[ID] [P?] [Story] 描述`

---

## 阶段 1：类型与校验

- [x] T001 [P] 扩展 `InitConfig` 类型，新增初始化参数字段
- [x] T002 [P] 更新初始化参数校验规则与默认值，使用 `serviceConfig` 推导 DNS_CONFIG / 固定服务地址模式

---

## 阶段 2：连接上下文注入

- [x] T003 [P] 将新参数注入连接上下文并生效（`serviceConfig.dnsConfigUrls` / `serviceConfig.serverUrls` / 设备标识）
- [x] T004 [P] 更新 msync 侧设备标识生成逻辑（自定义平台与设备名）

---

## 阶段 3：行为与测试

- [x] T005 [P] 覆盖默认值、旧顶层地址字段移除、`serviceConfig` 互斥与边界校验的单元测试
- [ ] T006 [P] 补充参数影响行为的集成测试（可选）

---

## 阶段 4：文档与示例

- [x] T007 [P] 更新文档与示例代码（如 README 或 demo）
