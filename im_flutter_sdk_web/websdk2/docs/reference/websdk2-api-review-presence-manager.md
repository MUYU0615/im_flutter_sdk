# PresenceManager 在线状态 API Review Matrix

生成时间：2026-05-12

来源：[Web SDK2 对外 API Review Matrix](./websdk2-api-review-matrix.md)

移动端对照来源：Android EMPresenceManager API 文档（hyphenate_SDK4.0 4.21.0）：https://doc.easemob.com/apidoc/android/chat3.0/classcom_1_1hyphenate_1_1chat_1_1_e_m_presence_manager.html。

## PresenceManager 在线状态

| Web API | Web 参数 | Web 参数字段展开 | Web 返回值 | 移动端 API | 移动端参数 | 移动端返回值 | 差异/Review 结论 | 来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PresenceManager.addEventHandler | id: EventHandlerId, handlers: PresenceEventHandlerMap | handlers: onPresenceStatusChange: ((payload: readonly PresenceState[]) => EventHandlerResult) \| undefined | void | EMPresenceManager.addListener | listener: EMPresenceListener | void | Android 按 listener 实例注册；Web 按 id 注册 PresenceEventHandlerMap，事件回调为 onPresenceStatusChange。 | src/managers/presence-manager.ts:154 |  |
| PresenceManager.removeEventHandler | id: EventHandlerId | - | void | EMPresenceManager.removeListener | listener: EMPresenceListener | void | Android 按 listener 实例移除，另有 clearListeners() 可清空全部监听；Web 按 id 移除单个 handler。 | src/managers/presence-manager.ts:172 |  |
| PresenceManager.publishPresence | params: PublishPresenceParams | params: description: string; success?: (() => void) \| undefined; error?: ((error: SDKError) => void) \| undefined | Promise<void> | EMPresenceManager.publishPresence | customStatus: String, callBack: EMCallBack | void；通过 EMCallBack 返回成功/失败 | Android 参数名为 customStatus；Web 参数名为 description 且返回 Promise<void>，同时兼容 success/error 回调。 | src/managers/presence-manager.ts:193 |  |
| PresenceManager.subscribePresence | params: SubscribePresenceParams | params: usernames: readonly string[]; expiry: number; success?: ((response: SubscribePresenceResponse) => void) \| undefined; error?: ((error: SDKError) => void) \| undefined | Promise<SubscribePresenceResponse> | EMPresenceManager.subscribePresences | members: List<String>, expiry: long, callBack: EMValueCallBack<List<EMPresence>> | void；callback 返回 List<EMPresence> | Android 命名为复数 subscribePresences，members 对应 Web usernames；Android 直接回调 EMPresence 列表，Web 包装为 SubscribePresenceResponse。 | src/managers/presence-manager.ts:234 |  |
| PresenceManager.unsubscribePresence | params: UnsubscribePresenceParams | params: usernames: readonly string[]; success?: (() => void) \| undefined; error?: ((error: SDKError) => void) \| undefined | Promise<void> | EMPresenceManager.unsubscribePresences | members: List<String>, callBack: EMCallBack | void；通过 EMCallBack 返回成功/失败 | Android 命名为复数 unsubscribePresences，members 对应 Web usernames；Web 返回 Promise<void>。 | src/managers/presence-manager.ts:278 |  |
| PresenceManager.getSubscribedPresenceList | params: GetSubscribedPresenceListParams | params: pageNum: number; pageSize: number; success?: ((response: SubscribedPresenceListResponse) => void) \| undefined; error?: ((error: SDKError) => void) \| undefined | Promise<SubscribedPresenceListResponse> | EMPresenceManager.fetchSubscribedMembers | pageNum: int, pageSize: int, callBack: EMValueCallBack<List<String>> | void；callback 返回 List<String> | Android 返回订阅成员 username 列表；Web 返回 SubscribedPresenceListResponse 包装结构。 | src/managers/presence-manager.ts:318 |  |
| PresenceManager.getPresenceStatus | params: GetPresenceStatusParams | params: usernames: readonly string[]; success?: ((response: SubscribePresenceResponse) => void) \| undefined; error?: ((error: SDKError) => void) \| undefined | Promise<SubscribePresenceResponse> | EMPresenceManager.fetchPresenceStatus | members: List<String>, callBack: EMValueCallBack<List<EMPresence>> | void；callback 返回 List<EMPresence> | Android members 对应 Web usernames；Android 直接回调 EMPresence 列表，Web 包装为 SubscribePresenceResponse。 | src/managers/presence-manager.ts:363 |  |
