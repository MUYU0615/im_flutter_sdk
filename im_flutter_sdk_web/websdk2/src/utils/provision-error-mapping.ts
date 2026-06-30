/**
 * Provision 错误码到 EMError 的映射
 */

import { ProvisionErrorCode } from '../protocol/msync/types'; // Provision 错误码常量
import { ERROR_CODES, type ErrorCode } from './error-codes'; // 错误码常量

/**
 * Provision 错误解析结果
 */
export interface ProvisionErrorResolution { // Provision 错误解析结果
  readonly code: ErrorCode; // 解析后的错误码
  readonly retryable: boolean; // 是否可重试
} // Provision 错误解析结果结束

const ProvisionFailReason = { // FAIL 错误原因常量
  USER_REGISTER_LIMIT: 'Sorry, user register limit', // 用户注册上限
  USER_REGISTER_RATE_LIMIT: 'Sorry, user register rate limit', // 用户注册频率限制
  TOKEN_EXPIRED: 'Sorry, token expired', // token 过期
  TOKEN_MISMATCH: 'Sorry, token or password does not match login info', // token 不匹配
  USER_NOT_FOUND: 'Sorry, user not found', // 用户不存在
} as const; // 常量断言

const PermissionDeniedReason = { // PERMISSION_DENIED 错误原因常量
  APP_MONTH_LIMIT: 'Sorry, the app month live count limit', // 月活上限
  APP_DAY_LIMIT: 'Sorry, the app day live count limit', // 日活上限
  APP_ONLINE_LIMIT: 'Sorry, the app online count limit', // 在线人数上限
} as const; // 常量断言

const PROVISION_ERROR_CODE_MAP: Record<number, ErrorCode> = { // Provision 状态码映射
  [ProvisionErrorCode.FAIL]: ERROR_CODES.AUTH_UNAUTHORIZED, // FAIL 默认视为鉴权失败
  [ProvisionErrorCode.UNAUTHORIZED]: ERROR_CODES.AUTH_UNAUTHORIZED, // 未授权
  [ProvisionErrorCode.MISSING_PARAMETER]: ERROR_CODES.VALIDATION_REQUIRED, // 缺少参数
  [ProvisionErrorCode.WRONG_PARAMETER]: ERROR_CODES.VALIDATION_INVALID_FORMAT, // 参数错误
  [ProvisionErrorCode.REDIRECT]: ERROR_CODES.CONNECTION_WEBSOCKET_ERROR, // 重定向视为连接错误
  [ProvisionErrorCode.TOKEN_EXPIRED]: ERROR_CODES.AUTH_TOKEN_EXPIRED, // token 过期
  [ProvisionErrorCode.PERMISSION_DENIED]: ERROR_CODES.AUTH_FORBIDDEN, // 权限不足
  [ProvisionErrorCode.PERMISSION_DENIED_EXTERNAL]: ERROR_CODES.AUTH_FORBIDDEN, // 外部权限不足
  [ProvisionErrorCode.NO_ROUTE]: ERROR_CODES.CONNECTION_WEBSOCKET_ERROR, // 无路由视为连接错误
  [ProvisionErrorCode.UNKNOWN_COMMAND]: ERROR_CODES.UNKNOWN, // 未知命令
  [ProvisionErrorCode.PB_PARSER_ERROR]: ERROR_CODES.UNKNOWN, // 协议解析错误
  [ProvisionErrorCode.BIND_ANOTHER_DEVICE]: ERROR_CODES.AUTH_BIND_ANOTHER_DEVICE, // 绑定其他设备
  [ProvisionErrorCode.IM_FORBIDDEN]: ERROR_CODES.AUTH_FORBIDDEN, // 服务禁用
  [ProvisionErrorCode.TOO_MANY_DEVICES]: ERROR_CODES.AUTH_LOGIN_TOO_MANY_DEVICES, // 设备数超限
  [ProvisionErrorCode.PLATFORM_LIMIT]: ERROR_CODES.SERVICE_LIMIT_EXCEEDED, // 平台限制
  [ProvisionErrorCode.USER_MUTED]: ERROR_CODES.AUTH_USER_MUTED, // 用户被禁言
  [ProvisionErrorCode.ENCRYPT_DISABLE]: ERROR_CODES.UNKNOWN, // 加密禁用
  [ProvisionErrorCode.ENCRYPT_ENABLE]: ERROR_CODES.UNKNOWN, // 加密启用
  [ProvisionErrorCode.DECRYPT_FAILURE]: ERROR_CODES.MESSAGE_DECODE_FAILED, // 解密失败
  [ProvisionErrorCode.RESOURCE_CHANGED]: ERROR_CODES.USER_DEVICE_CHANGED, // 设备资源变化
} as const; // 映射常量

const NON_RETRYABLE_STATUS_CODES = new Set<number>([ // 不可重试状态码
  ProvisionErrorCode.FAIL, // FAIL 视为业务失败
  ProvisionErrorCode.UNAUTHORIZED, // 未授权
  ProvisionErrorCode.MISSING_PARAMETER, // 缺少参数
  ProvisionErrorCode.WRONG_PARAMETER, // 参数错误
  ProvisionErrorCode.TOKEN_EXPIRED, // token 过期
  ProvisionErrorCode.PERMISSION_DENIED, // 权限不足
  ProvisionErrorCode.PERMISSION_DENIED_EXTERNAL, // 外部权限不足
  ProvisionErrorCode.UNKNOWN_COMMAND, // 未知命令
  ProvisionErrorCode.PB_PARSER_ERROR, // 解析错误
  ProvisionErrorCode.BIND_ANOTHER_DEVICE, // 绑定其他设备
  ProvisionErrorCode.IM_FORBIDDEN, // 服务禁用
  ProvisionErrorCode.TOO_MANY_DEVICES, // 设备数超限
  ProvisionErrorCode.PLATFORM_LIMIT, // 平台限制
  ProvisionErrorCode.USER_MUTED, // 用户被禁言
  ProvisionErrorCode.ENCRYPT_DISABLE, // 加密禁用
  ProvisionErrorCode.ENCRYPT_ENABLE, // 加密启用
  ProvisionErrorCode.DECRYPT_FAILURE, // 解密失败
  ProvisionErrorCode.RESOURCE_CHANGED, // 资源变更
]); // 不可重试状态码结束

const FAIL_REASON_CODE_MAP: Record<string, ErrorCode> = { // FAIL reason 映射
  [ProvisionFailReason.USER_REGISTER_LIMIT]: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
  [ProvisionFailReason.USER_REGISTER_RATE_LIMIT]: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
  [ProvisionFailReason.TOKEN_EXPIRED]: ERROR_CODES.AUTH_TOKEN_EXPIRED,
  [ProvisionFailReason.TOKEN_MISMATCH]: ERROR_CODES.AUTH_UNAUTHORIZED,
  [ProvisionFailReason.USER_NOT_FOUND]: ERROR_CODES.AUTH_UNAUTHORIZED,
  // 消息域 handleSync 映射（对齐移动端 emchatmanager.cpp）
  'blocked': ERROR_CODES.AUTH_FORBIDDEN,
  'group not found': ERROR_CODES.GROUP_NOT_EXIST,
  'illegal chatroom tag': ERROR_CODES.VALIDATION_REQUIRED,
  'not in group or chatroom': ERROR_CODES.GROUP_NOT_JOINED,
  'exceed recall time limit': ERROR_CODES.MESSAGE_RECALL_TIME_LIMIT,
  'message recall disabled': ERROR_CODES.SERVICE_NOT_ENABLED,
  'group ack not open': ERROR_CODES.SERVICE_NOT_ENABLED,
  'group ack msg permission denied': ERROR_CODES.GROUP_PERMISSION_DENIED,
  'the message has expired': ERROR_CODES.MESSAGE_EXPIRED,
  'limit send group ack msg': ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
  'not in group or chatroom white list': ERROR_CODES.MESSAGE_ILLEGAL_WHITELIST,
  'nonroster': ERROR_CODES.USER_NOT_ON_ROSTER,
  'group is disabled': ERROR_CODES.GROUP_DISABLED,
  'roaming is not open': ERROR_CODES.SERVICE_NOT_ENABLED,
  'Sorry, message does not exist': ERROR_CODES.VALIDATION_REQUIRED,
  'Sorry, edit limit reached': ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
  'Sorry, You do not have permission': ERROR_CODES.AUTH_FORBIDDEN,
  'Sorry, format is incorrect': ERROR_CODES.VALIDATION_REQUIRED,
  'Sorry, edit is not available': ERROR_CODES.SERVER_SERVING_DISABLED,
  'Sorry, edit fail': ERROR_CODES.MESSAGE_EDIT_FAILED,
}; // FAIL reason 映射结束

/** FAIL reason 子串匹配（精确匹配未命中时使用） */
const FAIL_REASON_SUBSTRING_MAP: ReadonlyArray<readonly [string, ErrorCode]> = [
  ['limit directed users', ERROR_CODES.SERVICE_LIMIT_EXCEEDED],
  ['no permission to recall message', ERROR_CODES.AUTH_FORBIDDEN],
];

const PERMISSION_DENIED_REASON_CODE_MAP: Record<string, ErrorCode> = {
  [PermissionDeniedReason.APP_MONTH_LIMIT]: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
  [PermissionDeniedReason.APP_DAY_LIMIT]: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
  [PermissionDeniedReason.APP_ONLINE_LIMIT]: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
  // 消息域 handleSync 映射（对齐移动端 emchatmanager.cpp）
  'sensitive words': ERROR_CODES.MESSAGE_INCLUDE_ILLEGAL_CONTENT,
  'blocked by mod_antispam': ERROR_CODES.MESSAGE_INCLUDE_ILLEGAL_CONTENT,
  'user is mute': ERROR_CODES.USER_MUTED_BY_ADMIN,
  'traffic limit': ERROR_CODES.MESSAGE_CURRENT_LIMITING,
  'Sorry, data is too large': ERROR_CODES.MESSAGE_SIZE_LIMIT,
};

const resolveProvisionReasonCode = (statusCode: number, reason?: string): ErrorCode | undefined => {
  if (!reason) {
    return undefined;
  }
  if (statusCode === ProvisionErrorCode.FAIL) {
    const exact = FAIL_REASON_CODE_MAP[reason];
    if (exact !== undefined) return exact;
    // 子串匹配
    for (const [pattern, code] of FAIL_REASON_SUBSTRING_MAP) {
      if (reason.includes(pattern)) return code;
    }
    // JSON reason（第三方审核）
    try {
      const parsed = JSON.parse(reason) as Record<string, unknown>;
      if (parsed.error_type === 'moderation') return ERROR_CODES.THIRD_MODERATION_FAILED;
      if (typeof parsed.error_type === 'string') return ERROR_CODES.THIRD_DEFAULT_FAILED;
    } catch {
      // not JSON, ignore
    }
    return undefined;
  }
  if (statusCode === ProvisionErrorCode.PERMISSION_DENIED) {
    return PERMISSION_DENIED_REASON_CODE_MAP[reason];
  }
  if (statusCode === ProvisionErrorCode.PERMISSION_DENIED_EXTERNAL) {
    return ERROR_CODES.MESSAGE_EXTERNAL_LOGIC_BLOCKED;
  }
  if (statusCode === ProvisionErrorCode.USER_MUTED) {
    return ERROR_CODES.AUTH_USER_MUTED;
  }
  return undefined;
};

export const resolveProvisionError = (statusCode: number | undefined, reason?: string): ProvisionErrorResolution => { // Provision 错误解析
  if (typeof statusCode !== 'number') { // 无状态码时使用未知错误
    return { code: ERROR_CODES.UNKNOWN, retryable: true }; // 默认可重试
  } // 状态码为空结束

  const reasonCode = resolveProvisionReasonCode(statusCode, reason); // 解析 reason 对应错误码
  const baseCode = PROVISION_ERROR_CODE_MAP[statusCode] ?? ERROR_CODES.UNKNOWN; // 基础错误码
  const code = reasonCode ?? baseCode; // 使用 reason 映射优先
  const retryable = !NON_RETRYABLE_STATUS_CODES.has(statusCode); // 判断是否可重试

  return { code, retryable }; // 返回解析结果
}; // resolveProvisionError 结束

export const resolveProvisionErrorCode = (statusCode: number | undefined, reason?: string): ErrorCode => { // 兼容旧调用
  return resolveProvisionError(statusCode, reason).code; // 返回错误码
}; // resolveProvisionErrorCode 结束
