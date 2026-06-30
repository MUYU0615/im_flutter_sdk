"""为 Web 覆盖文档生成中文测试摘要。"""
from __future__ import annotations


def summarize_reason_zh(reason: str, status: str) -> str:
    text = (reason or "").strip()
    lower = text.lower()

    if not text:
        return "未填写说明。"

    if status == "supported":
        if "verified" in lower or "after" in lower or "real web" in lower:
            return "该 API 已通过真实 Web SDK 与真实服务链路验证。"
        return "该 API 已完成真实 E2E 验证。"

    if status == "not_applicable":
        if "native" in lower:
            return "该 API 属于原生 SDK 配置或能力，当前浏览器 Web 场景不适用。"
        if "does not expose" in lower:
            return "当前 Web SDK 未暴露对应能力，浏览器侧不适用。"
        return "该 API 当前不适用于 Web 真实 E2E 范围。"

    if status == "blocked":
        if "does not satisfy the flutter contract" in lower:
            return "真实调用已发生，但 Web 行为不满足 Flutter / iOS / Android 同名 API 契约。"
        if "does not expose" in lower or "no public" in lower:
            return "当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。"
        if "undefined (reading 'apply')" in lower:
            return "真实调用时找不到可执行方法，属于 API 未对齐或 Web SDK 缺口。"
        if "no real sdk callback" in lower or "callback" in lower and "not hook" in lower:
            return "真实回调链路未接通，当前无法按移动端同等方式验证。"
        if "local bridge" in lower or "locally synthesizing" in lower:
            return "当前只有本地 bridge 合成事件，未接到真实 SDK 事件流。"
        if "local in-memory" in lower or "hard-coded" in lower or "constant" in lower:
            return "当前实现仅作用于本地内存或常量返回，未进入真实 Web SDK / 服务链路。"
        if "timeout" in lower or "failed" in lower or "error" in lower:
            return "真实 E2E 已发起调用，但执行失败、超时或返回异常，当前未通过。"
        if "permission" in lower or "group_authorization" in lower:
            return "真实调用受服务端权限或环境限制影响，当前执行未通过。"
        if "no /chatfiles upload request is emitted" in lower:
            return "真实调用已进入发送链路，但未完成上传阶段，当前执行未通过。"
        return "该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。"

    if status == "pending":
        return "该 API 尚未完成最终定性。"

    return "该项说明尚未完全中文化，但不影响当前测试结论。"


def resolve_reason_zh(info: dict, status_key: str) -> str:
    reason_zh = str(info.get("reason_zh") or "").strip()
    if reason_zh:
        return reason_zh
    return summarize_reason_zh(str(info.get("reason") or ""), str(info.get(status_key) or ""))
