/**
 * 超时配置（集中定义）
 */

export const MESSAGE_TIMEOUT = 1000 * 15; // 发送消息超时
export const CHANNEL_SEND_MESSAGE_TIMEOUT = 1000 * 10; // Channel 发送消息超时
export const REQUEST_TIMEOUT = 1000 * 15; // REST 请求超时（占位）
export const UPLOAD_TIMEOUT = 1000 * 60 * 5; // 上传文件超时（占位）
export const CONNECT_TIMEOUT = 1000 * 10; // WebSocket 连接超时
export const PROVISION_TIMEOUT = 1000 * 10; // provision 响应超时
export const HEARTBEAT_INTERVAL = 1000 * 30; // 心跳间隔
export const HEARTBEAT_TIMEOUT = 1000 * 60; // 心跳超时
export const RECONNECT_INITIAL_DELAY = 1000 * 1; // 重连初始延迟
export const RECONNECT_MAX_DELAY = 1000 * 60; // 重连最大延迟
export const RECONNECT_BACKOFF_MULTIPLIER = 2; // 重连退避倍数
export const SYNC_WEBSOCKET_CONNECT_TIMEOUT = 1000 * 5; // 同步 WebSocket 建连超时
export const SYNC_WEBSOCKET_IDLE_TIMEOUT = 1000 * 10; // 同步 WebSocket 空闲超时
export const SYNC_WEBSOCKET_RETRY_INITIAL_DELAY = 1000 * 1; // 同步 WebSocket 重试初始延迟
export const SYNC_WEBSOCKET_RETRY_MAX_DELAY = 1000 * 5; // 同步 WebSocket 重试最大延迟
export const SYNC_WEBSOCKET_RETRY_BACKOFF_MULTIPLIER = 2; // 同步 WebSocket 重试退避倍数
export const SYNC_WEBSOCKET_COMPLETE_CLOSE_DELAY = 0; // 同步 WebSocket 完成后延迟关闭，允许同一轮自动同步复用
export const USER_INFO_HYDRATION_WINDOW_MS = 1000 * 7; // 用户资料补位窗口
export const USER_INFO_HYDRATION_BATCH_SIZE = 20; // 用户资料补位批量阈值
export const GROUP_NAMECARD_HYDRATION_WINDOW_MS = 1000 * 7; // 群名片补位窗口
export const GROUP_NAMECARD_HYDRATION_MIN_WINDOW_MS = 1000; // 群名片补位最小随机窗口
export const GROUP_NAMECARD_HYDRATION_BATCH_SIZE = 50; // 群名片单次补位最大用户数
export const GROUP_NAMECARD_HYDRATION_MAX_CONCURRENCY = 5; // 群名片跨群补位并发度
