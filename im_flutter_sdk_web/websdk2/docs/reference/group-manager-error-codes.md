# GroupManager 错误码对照文档

> 基于移动端 C++ SDK（emclient-linux）`emgroupmanager.cpp` + `emmucmanager.cpp` 源码分析，对比 Web SDK 现有实现。
>
> 生成时间：2026-04-28

---

## 一、群组域错误码总表

| 移动端错误码 | 数值 | 含义 | Web SDK `ERROR_CODES` | 对齐状态 |
|---|---|---|---|---|
| `EM_NO_ERROR` | 0 | 无错误 | — | ✅ |
| `GENERAL_ERROR` | 1 | 通用错误 | `UNKNOWN`(1) | ✅ |
| `NETWORK_ERROR` | 2 | 网络不可用 | `REST_NETWORK_ERROR`(2) | ✅ |
| `EXCEED_SERVICE_LIMIT` | 4 | 超出服务限制 | `SERVICE_LIMIT_EXCEEDED`(4) | ✅ |
| `INVALID_PARAM` | 110 | 参数无效 | `VALIDATION_REQUIRED`(110) | ✅ |
| `INVALID_USER_NAME` | 101 | 用户名非法 | `VALIDATION_INVALID_FORMAT`(110) | ⚠️ 数值不同 |
| `USER_NOT_LOGIN` | 201 | 未登录 | `AUTH_NOT_LOGIN`(201) | ✅ |
| `USER_AUTHENTICATION_FAILED` | 202 | 鉴权失败 | `AUTH_UNAUTHORIZED`(202) | ✅ |
| `USER_ILLEGAL_ARGUMENT` | 205 | 非法参数 | `VALIDATION_INVALID_FORMAT`(110) | ⚠️ 数值不同 |
| `USER_PERMISSION_DENIED` | 210 | 无权限 | `AUTH_FORBIDDEN`(210) | ✅ |
| `SERVER_NOT_REACHABLE` | 300 | 服务器不可达 | `CONNECTION_WEBSOCKET_ERROR`(300) | ✅ |
| `SERVER_BUSY` | 302 | 服务器繁忙 | 未定义 | ❌ 缺失 |
| `SERVER_UNKNOWN_ERROR` | 303 | 服务器未知错误 | `REST_BUSINESS_UNKNOWN`(303) | ✅ |
| `SERVER_SERVING_DISABLED` | 305 | 服务已禁用 | 未定义 | ❌ 缺失 |
| `FILE_TOO_LARGE` | 405 | 文件过大 | 未定义 | ❌ 缺失 |
| `GROUP_INVALID_ID` | 600 | 群组 ID 无效 | `GROUP_INVALID_ID`(600) | ✅ |
| `GROUP_ALREADY_JOINED` | 601 | 已加入群组 | `GROUP_ALREADY_JOINED`(601) | ✅ |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 | `GROUP_NOT_JOINED`(602) | ✅ |
| `GROUP_PERMISSION_DENIED` | 603 | 群组无权限 | `GROUP_PERMISSION_DENIED`(603) | ✅ |
| `GROUP_MEMBERS_FULL` | 604 | 群组成员已满 | `GROUP_MEMBERS_FULL`(604) | ✅ |
| `GROUP_SHARED_FILE_INVALIDID` | 605 | 共享文件 ID 无效 | `GROUP_SHARED_FILE_INVALID_ID`(605) | ✅ |
| `GROUP_NOT_EXIST` | 606 | 群组不存在 | `GROUP_NOT_EXIST`(606) | ✅ |
| `GROUP_DISABLED` | 607 | 群组已禁用 | `GROUP_DISABLED`(607) | ✅ |
| `GROUP_NAME_VIOLATION` | 608 | 群名违规 | `GROUP_NAME_VIOLATION`(608) | ✅ |
| `GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT` | 609 | 成员属性数量超限 | `GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT`(609) | ✅ |
| `GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED` | 610 | 成员属性更新失败 | `GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED`(610) | ✅ |
| `GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT` | 611 | 成员属性 key 超限 | `GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT`(611) | ✅ |
| `GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT` | 612 | 成员属性 value 超限 | `GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT`(612) | ✅ |
| `GROUP_USER_IN_BLOCKLIST` | 613 | 用户在群黑名单中 | `GROUP_USER_IN_BLOCKLIST`(613) | ✅ |

---

## 二、通用错误处理函数

### 2.1 EMMucManager::processGeneralRESTResponseError（mIsChatroom=false）

所有群组 REST API 共用此函数。判断逻辑：

**优先匹配 error_description（任何 HTTP 状态码）：**
```
包含 "you have no permission to do this" → GROUP_PERMISSION_DENIED (603)
包含 "group_authorization" → GROUP_PERMISSION_DENIED (603)
包含 "owner can not quit group" → GROUP_PERMISSION_DENIED (603)
```

**按 HTTP 状态码分支：**
```
404 → GROUP_INVALID_ID (600)

401:
  首次 → 刷新 token 重试
  重试后仍 401 → USER_AUTHENTICATION_FAILED (202)

403:
  error == "announce info length exceeds limit!" → USER_ILLEGAL_ARGUMENT (205)
  error_description 包含 "already in group" → GROUP_ALREADY_JOINED (601)
  error_description 包含 "group is disabled" → GROUP_DISABLED (607)
  error_description 包含 "group_name_violation" → GROUP_NAME_VIOLATION (608)
  error_description 包含 "member list is full" → GROUP_MEMBERS_FULL (604)
  error_description 包含 "is in the blacklist" → GROUP_USER_IN_BLOCKLIST (613)
  其他 → GROUP_PERMISSION_DENIED (603)

413 → FILE_TOO_LARGE (405)
429 → EXCEED_SERVICE_LIMIT (4)
503 → SERVER_BUSY (302)

400:
  error == "illegal_argument" → GROUP_INVALID_ID (600)
  error == "invalid_parameter":
    error_description 包含 "are not members of this group" → GROUP_NOT_JOINED (602)
    其他 → INVALID_PARAM (110)

其他 → SERVER_NOT_REACHABLE (300)，切换备用地址重试
```

### 2.2 parserGeneralRESTResponse（成员属性专用）

仅用于 `setMemberAttributes` / `fetchMemberAttributes`，按 `error_code` 整数字段映射：

```
HTTP 400:
  error_code 60005 → GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED (610)
  error_code 60006 → GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT (609)
  error_code 60007 → EXCEED_SERVICE_LIMIT (4)
  error_code 60009 → GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT (611)
  error_code 600010 → GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT (612)

HTTP 401:
  error_code 60001 → USER_PERMISSION_DENIED (210)

HTTP 403:
  error_code 60002 → USER_PERMISSION_DENIED (210)
  error_code 60004 → SERVER_SERVING_DISABLED (305)

HTTP 404:
  error_code 60003 或 20004 → GROUP_NOT_JOINED (602)

HTTP 503 → SERVER_BUSY (302)
```

### 2.3 getValidJoinedGroupById（前置校验）

大多数群组操作 API 的前置校验：
```
1. groupId 为空 → GROUP_INVALID_ID (600)
2. 本地未找到 → 远程拉取详情；拉取成功但不是成员 → GROUP_NOT_JOINED (602)
3. 本地已找到 → checkSessionStatusValid:
   未登录 → USER_NOT_LOGIN (201)
   无网络 → NETWORK_ERROR (2)
```

### 2.4 getValidNotJoinedGroupById（加入/申请前校验）

用于 joinPublicGroup / applyJoinPublicGroup / acceptInvitation / declineInvitation：
```
1. groupId 为空 → GROUP_INVALID_ID (600)
2. 已加入群组 → GROUP_ALREADY_JOINED (601)
3. checkSessionStatusValid → USER_NOT_LOGIN (201) / NETWORK_ERROR (2)
```

---

## 三、各 API 错误码详情


### createGroup

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### destroyGroup

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### joinPublicGroup

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_ALREADY_JOINED` | 601 | 已加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| `GROUP_MEMBERS_FULL` | 604 | 成员数已达上限（本地校验） |
| `GROUP_PERMISSION_DENIED` | 603 | 群组不是公开群 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### leaveGroup

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| `GROUP_PERMISSION_DENIED` | 603 | error_description 包含 "owner can not quit group" |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### fetchGroupSpecification（getGroupInfo）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### changeGroupSubject / changeGroupDescription / changeGroupExtension（updateGroupInfo）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| `USER_ILLEGAL_ARGUMENT` | 205 | 不支持的属性类型 |
| + 通用 REST 错误 | — | 见 2.1 节（含 "announce info length exceeds limit!" → 205） |

---

### fetchGroupMembers（getMemberList）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### addGroupMembers / removeGroupMembers / blockGroupMembers / unblockGroupMembers

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节（含 "member list is full" → 604、"is in the blacklist" → 613） |

---

### transferGroupOwner / addGroupAdmin / removeGroupAdmin

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

**移动端行为**：如果目标用户与当前登录用户相同，静默跳过不发请求。

---

### muteGroupMembers / unmuteGroupMembers / muteAllGroupMembers / unmuteAllGroupMembers

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### fetchGroupMutes / fetchGroupBans / fetchGroupWhiteList（getMuteList / getBlocklist / getAllowlist）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

**移动端行为**：如果 getValidJoinedGroupById 失败但本地有群组对象，返回本地缓存列表。

---

### addWhiteListMembers / removeWhiteListMembers（addUsersToAllowlist / removeUsersFromAllowlist）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### fetchIsMemberInWhiteList / fetchIsMemberInMuteList（checkIfInAllowList / isCurrentUserMuted）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### fetchGroupAnnouncement / updateGroupAnnouncement（getAnnouncement / updateAnnouncement）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节（updateAnnouncement 含 "announce info length exceeds limit!" → 205） |

---

### fetchGroupSharedFiles / deleteGroupSharedFile（getSharedFileList / deleteSharedFile）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### fetchJoinedGroups / fetchPublicGroups（getJoinedGroupList / getPublicGroupList）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### inviteGroupMembers / acceptGroupInvitation / declineGroupInvitation

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_ALREADY_JOINED` | 601 | 已加入群组（accept/decline） |
| `GROUP_NOT_JOINED` | 602 | 未加入群组（invite） |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### applyJoinPublicGroup（applyJoinGroup）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_ALREADY_JOINED` | 601 | 已加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| `GROUP_PERMISSION_DENIED` | 603 | 群组不是公开群 |
| `GROUP_MEMBERS_FULL` | 604 | 成员数已达上限 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### acceptJoinGroupApplication / declineJoinGroupApplication

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `INVALID_USER_NAME` | 101 | user 参数为空 |
| `GROUP_INVALID_ID` | 600 | groupId 为空 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + 通用 REST 错误 | — | 见 2.1 节 |

---

### setMemberAttributes / fetchMemberAttributes

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_ILLEGAL_ARGUMENT` | 205 | attributes 为空、groupId 为空、userName 为空 |
| `GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED` | 610 | error_code 60005 |
| `GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT` | 609 | error_code 60006 |
| `EXCEED_SERVICE_LIMIT` | 4 | error_code 60007 |
| `GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT` | 611 | error_code 60009 |
| `GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT` | 612 | error_code 600010 |
| `USER_PERMISSION_DENIED` | 210 | error_code 60001 或 60002 |
| `SERVER_SERVING_DISABLED` | 305 | error_code 60004 |
| `GROUP_NOT_JOINED` | 602 | error_code 60003 或 20004 |
| `USER_AUTHENTICATION_FAILED` | 202 | HTTP 401（刷新 token 后仍失败） |
| `SERVER_BUSY` | 302 | HTTP 503 |

---

## 四、Web SDK 对比分析

### 4.1 已对齐的错误码（14 个 GROUP_* 常量）

Web SDK 的 `ERROR_CODES` 中 600-613 全部与移动端数值一致：

`GROUP_INVALID_ID`(600)、`GROUP_ALREADY_JOINED`(601)、`GROUP_NOT_JOINED`(602)、`GROUP_PERMISSION_DENIED`(603)、`GROUP_MEMBERS_FULL`(604)、`GROUP_SHARED_FILE_INVALID_ID`(605)、`GROUP_NOT_EXIST`(606)、`GROUP_DISABLED`(607)、`GROUP_NAME_VIOLATION`(608)、`GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT`(609)、`GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED`(610)、`GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT`(611)、`GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT`(612)、`GROUP_USER_IN_BLOCKLIST`(613)

### 4.2 api-errors.json 中已覆盖的 REST 错误映射

Web SDK 的 `api-errors.json` 已为 17 个群组 API 定义了错误映射，覆盖了移动端 `processGeneralRESTResponseError` 中的主要分支：

- `joinGroup`：覆盖最全（600/601/602/603/604/606/607/613），含 aliases
- `updateGroupInfo`：覆盖 603/606/607/608/110
- `createGroup`：覆盖 110/4/608/204
- `setGroupMemberAttributes`：覆盖 609/610/611/612，含 error_code 映射
- 其余 API：主要覆盖 `resource_not_found`(606) 和 `group_authorization`(603)

### 4.3 移动端有但 Web SDK 缺失的错误场景

| 缺失项 | 移动端错误码 | 涉及 API | 建议 |
|---|---|---|---|
| `SERVER_BUSY` | 302 | 所有 REST API（HTTP 503） | 在 `common` 段新增，或在通用 REST 层处理 |
| `SERVER_SERVING_DISABLED` | 305 | setMemberAttributes（error_code 60004） | 在 `setGroupMemberAttributes` 中补充 |
| `FILE_TOO_LARGE` | 405 | uploadGroupSharedFile（HTTP 413） | 在共享文件上传 API 中补充 |
| `USER_ILLEGAL_ARGUMENT`(205) 用于公告超限 | 205 | updateGroupAnnouncement | 当前 Web SDK 用 `forbidden_op`(603) 映射 HTTP 403 公告超限，移动端用 205。建议保持 Web SDK 现有映射（603 更合理） |
| `GROUP_NOT_JOINED`(602) 用于成员属性 | 602 | setMemberAttributes（error_code 60003/20004） | 在 `setGroupMemberAttributes` 中补充 `matchField: "error_code"` 映射 |
| `USER_PERMISSION_DENIED`(210) 用于成员属性 | 210 | setMemberAttributes（error_code 60001/60002） | 在 `setGroupMemberAttributes` 中补充 |
| `EXCEED_SERVICE_LIMIT`(4) 用于成员属性 | 4 | setMemberAttributes（error_code 60007） | 在 `setGroupMemberAttributes` 中补充 |
| `joinGroup` 的 `"member list is full"` 子串匹配 | 604 | joinGroup | 当前 Web SDK 的 `group_full` 只做 key 匹配，未做 error_description 子串匹配。如果服务端返回的 error key 不是 `group_full` 而是通用 403，可能漏匹配。建议补充 `matchPattern` |
| `joinGroup` 的 `"is in the blacklist"` 子串匹配 | 613 | joinGroup | 同上，建议补充 `matchPattern` |
| `leaveGroup` 的 `"owner can not quit group"` | 603 | leaveGroup | 当前 Web SDK 的 `leaveGroup` 只有 `not_joined`(602) 和 `resource_not_found`(606)，缺少 owner 不能退出的映射 |

### 4.4 Web SDK 有但移动端没有的错误码

| Web SDK 错误码 | 数值 | 说明 |
|---|---|---|
| `GROUP_NOT_EXIST` | 606 | Web SDK 用 606 表示"群组不存在"，移动端 HTTP 404 映射为 `GROUP_INVALID_ID`(600) 而非 606。两者语义略有差异但不影响使用 |

### 4.5 建议补充的 api-errors.json 条目

**优先级高（影响错误码准确性）：**

1. `setGroupMemberAttributes` 补充 error_code 映射：
   - `60003`/`20004` → `GROUP_NOT_JOINED`(602)
   - `60001`/`60002` → `AUTH_FORBIDDEN`(210)
   - `60007` → `SERVICE_LIMIT_EXCEEDED`(4)
   - `60004` → 需新增 `SERVER_SERVING_DISABLED`(305) 或映射到现有码

2. `leaveGroup` 补充：
   - `matchField: "error_description"`, `matchPattern: "owner can not quit group"` → `GROUP_PERMISSION_DENIED`(603)

3. `joinGroup` 补充 `matchPattern` 兜底：
   - `matchField: "error_description"`, `matchPattern: "member list is full"` → `GROUP_MEMBERS_FULL`(604)
   - `matchField: "error_description"`, `matchPattern: "is in the blacklist"` → `GROUP_USER_IN_BLOCKLIST`(613)

**优先级中（通用层面）：**

4. `common` 段新增 `SERVER_BUSY`(302)，HTTP 503 统一映射

**优先级低（边界场景）：**

5. `FILE_TOO_LARGE`(405) — 仅影响共享文件上传，当前 Web SDK 可能未实现此 API
6. `SERVER_SERVING_DISABLED`(305) — 仅影响成员属性，场景较少
