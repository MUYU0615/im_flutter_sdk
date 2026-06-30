# UserInfoManager 用户资料 API Review Matrix

生成时间：2026-05-12（移动端对照补充：2026-05-15）

来源：[Web SDK2 对外 API Review Matrix](./websdk2-api-review-matrix.md)

移动端对照来源：[Android EMUserInfoManager](https://doc.easemob.com/apidoc/android/chat3.0/classcom_1_1hyphenate_1_1chat_1_1_e_m_user_info_manager.html)

## UserInfoManager 用户资料

| Web API | Web 参数 | Web 参数字段展开 | Web 返回值 | 移动端 API | 移动端参数 | 移动端返回值 | 差异/Review 结论 | 来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UserInfoManager.addEventHandler | id: EventHandlerId, handlers: UserInfoEventHandlerMap | handlers: onOwnInfoUpdated: ((payload: UserInfo) => EventHandlerResult) \| undefined; onUserInfoUpdated: ((payload: readonly UserInfo[]) => EventHandlerResult) \| undefined | void | EMUserInfoManager.addUserInfoManagerListener | listener: EMUserInfoManagerListener | void | Web 使用 id+handlers map 模式，移动端使用 listener 接口模式；语义一致 | src/managers/user-info-manager.ts:92 |  |
| UserInfoManager.removeEventHandler | id: EventHandlerId | - | void | EMUserInfoManager.removeUserInfoManagerListener | listener: EMUserInfoManagerListener | void | Web 按 id 移除，移动端按 listener 引用移除 | src/managers/user-info-manager.ts:100 |  |
| UserInfoManager.fetchUserInfoByUserId | params: FetchUserInfoByUserIdParams | params: userIds: readonly string[]; success?; error? | Promise<readonly UserInfo[]> | EMUserInfoManager.fetchUserInfoByUserId | userIds: String[], callBack: EMValueCallBack<Map<String, EMUserInfo>> | void (回调返回 Map<String, EMUserInfo>) | Web 返回 UserInfo[]；移动端回调返回 Map<userId, EMUserInfo>。Web 使用 Promise，移动端使用回调 | src/managers/user-info-manager.ts:121 |  |
| UserInfoManager.fetchUserInfoByAttribute | params: FetchUserInfoByAttributeParams | params: userIds: readonly string[]; attributes: readonly UserInfoAttribute[]; success?; error? | Promise<readonly UserInfo[]> | EMUserInfoManager.fetchUserInfoByAttribute | userIds: String[], attributes: EMUserInfoType[], callBack: EMValueCallBack<Map<String, EMUserInfo>> | void (回调返回 Map<String, EMUserInfo>) | 语义一致；Web attributes 为字符串枚举，移动端为 EMUserInfoType 枚举 | src/managers/user-info-manager.ts:169 |  |
| UserInfoManager.subscribeUsersInfo | params: SubscribeUsersInfoParams | params: userIds: readonly string[]; success?; error? | Promise<void> | — | — | — | Web 独有，移动端无对应 API | src/managers/user-info-manager.ts:208 | 用户资料变更订阅 |
| UserInfoManager.unsubscribeUsersInfo | params: UnsubscribeUsersInfoParams | params: userIds: readonly string[]; success?; error? | Promise<void> | — | — | — | Web 独有，移动端无对应 API | src/managers/user-info-manager.ts:234 | 用户资料变更取消订阅 |
| UserInfoManager.getSubscribedUsers | - | - | Promise<readonly UserInfo[]> | — | — | — | Web 独有，移动端无对应 API | src/managers/user-info-manager.ts:257 | 获取已订阅用户列表 |
| UserInfoManager.updateOwnInfo | params: UpdateOwnInfoParams | params: nickname?; avatarUrl?; mail?; phone?; gender?; sign?; birth?; ext?; success?; error? | Promise<UserInfo> | EMUserInfoManager.updateOwnInfo | userInfo: EMUserInfo, callBack: EMValueCallBack<String> | void (回调返回 String) | Web 按字段传入，移动端传完整 EMUserInfo 对象；Web 返回更新后的 UserInfo，移动端回调返回 String | src/managers/user-info-manager.ts:302 |  |
| UserInfoManager.updateOwnInfoByAttribute | attribute: UserInfoAttribute, value: string \| number \| boolean, callbacks? | - | Promise<UserInfo> | EMUserInfoManager.updateOwnInfoByAttribute | attribute: EMUserInfoType, value: String, callBack: EMValueCallBack<String> | void (回调返回 String) | 语义一致；Web value 支持多类型，移动端仅 String；Web 返回 UserInfo，移动端回调返回 String | src/managers/user-info-manager.ts:353 |  |
| — | — | — | — | EMUserInfoManager.getUserInfoWithUserIds | userIds: String[], callback: EMValueCallBack<Map<String, EMUserInfo>> | void (回调返回 Map<String, EMUserInfo>) | 移动端独有，从本地内存批量获取用户信息，不发起网络请求。Web 暂无对应本地缓存读取 API | — | 本地缓存读取 |
