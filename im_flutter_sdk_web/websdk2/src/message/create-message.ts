/**
 * 消息创建方法
 */

import { Validator } from '../validators/validator'; // 校验工具
import {
  // 引入校验规则
  createCmdMessageSchema, // 命令消息校验
  createCombineMessageSchema, // 合并消息校验
  createCustomMessageSchema, // 自定义消息校验
  createFileMessageSchema, // 文件消息校验
  createImageMessageSchema, // 图片消息校验
  createLocationMessageSchema, // 位置消息校验
  createTextMessageSchema, // 文本消息校验
  createVideoMessageSchema, // 视频消息校验
  createVoiceMessageSchema, // 语音消息校验
} from '../validators/message-create'; // 校验规则来源
import { ValidationError } from '../utils/errors'; // 错误类型
import { ERROR_CODES } from '../utils/error-codes';
import { createLocalFileUrl, generateMsgLocalId } from '../utils/message-id'; // 工具方法
import { attachmentFileStore } from '../upload/attachment-file-store';
import { deriveImageUrls } from '../upload/utils';
import type {
  // 引入类型
  CmdMessageBody, // 命令消息体
  CombineMessageBody, // 合并消息体
  CompatibleFile, // 跨端文件类型
  CreateCmdMessageParams, // 命令消息入参
  CreateCombineMessageParams, // 合并消息入参
  CreateCustomMessageParams, // 自定义消息入参
  CreateFileMessageParams, // 文件消息入参
  CreateImageMessageParams, // 图片消息入参
  CreateLocationMessageParams, // 位置消息入参
  CreateMessageBaseParams, // 创建消息基础入参
  CreateTextMessageParams, // 文本消息入参
  CreateVideoMessageParams, // 视频消息入参
  CreateVoiceMessageParams, // 语音消息入参
  CustomMessageBody, // 自定义消息体
  FileMessageBody, // 文件消息体
  ImageMessageBody, // 图片消息体
  LocationMessageBody, // 位置消息体
  Message, // 消息类型
  MessageBody, // 消息体联合类型
  MessageType, // 消息类型联合
  Sender, // 发送者类型
  TextMessageBody, // 文本消息体
  VideoMessageBody, // 视频消息体
  VoiceMessageBody, // 语音消息体
} from '../types'; // 类型来源
import {
  calculateCombineLevel,
  ensureCombineLevel,
  validateCombineMessageList,
} from './combine-message-constraints';

const ensureSender = (sender?: Sender): Sender => {
  // 校验并规范化发送者
  const userId = sender?.userId?.trim(); // 读取并裁剪 userId
  if (!userId) {
    // 缺少 userId
    throw new ValidationError('sender.userId is required', {
      code: ERROR_CODES.VALIDATION_REQUIRED,
      details: {
        fields: [
          {
            path: 'sender.userId',
            message: 'sender.userId is required',
            rule: 'required',
          },
        ],
      },
    }); // 抛出校验错误
  }
  return {
    // 返回规范化发送者
    userId, // 发送者用户 ID
    nickname: sender?.nickname, // 发送者昵称
    avatarUrl: sender?.avatarUrl, // 发送者头像
  };
};

const resolveMsgLocalId = (): string => {
  return generateMsgLocalId();
};

const resolveMediaUrl = (url: string | undefined, data?: CompatibleFile): string => {
  // 解析媒体 URL
  if (url) {
    // 已提供 URL
    return url; // 直接返回
  }
  if (!data) {
    // URL 与 data 都缺失
    throw new ValidationError('url or data is required', {
      code: ERROR_CODES.VALIDATION_REQUIRED,
      details: {
        fields: [
          {
            path: 'url',
            message: 'url or data is required',
            rule: 'required',
          },
        ],
      },
    }); // 抛出校验错误
  }
  const localUrl = createLocalFileUrl(data); // 生成本地 URL
  if (!localUrl) {
    // 生成失败
    throw new ValidationError('Failed to resolve local url', {
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
      details: {
        fields: [
          {
            path: 'url',
            message: 'Failed to resolve local url',
            rule: 'invalid_format',
          },
        ],
      },
    }); // 抛出校验错误
  }
  return localUrl; // 返回本地 URL
};

const resolveIsOriginalImage = (params: { isGif: boolean; isOriginalImage?: boolean }): boolean => {
  if (params.isGif) {
    return true;
  }
  return params.isOriginalImage ?? false;
};

interface CreateImageMessageOptions {
  useCustomAttachmentUpload?: boolean;
}

const buildMessage = (
  // 构建通用消息对象
  params: CreateMessageBaseParams, // 通用入参
  sender: Sender, // 发送者信息
  type: MessageType, // 消息类型
  body: MessageBody, // 消息体
  msgLocalId?: string // 本地消息 ID
): Message => {
  // 返回消息对象
  const finalMsgLocalId = msgLocalId ?? generateMsgLocalId();
  return {
    // 构建消息
    msgServerId: '', // 默认服务端 ID
    msgLocalId: finalMsgLocalId, // 本地 ID
    from: sender.userId, // 发送方 userId
    to: params.conversationId, // 接收方标识（发送时等于 conversationId）
    sender, // 发送者
    conversationId: params.conversationId, // 会话 ID
    conversationType: params.conversationType, // 会话类型
    type, // 消息类型
    status: 'sending', // 初始状态
    ext: params.ext ?? {}, // 扩展字段
    timestamp: params.timestamp ?? Date.now(), // 创建时间戳
    body, // 消息体
    direct: 'SEND', // 创建侧对外消息方向固定为 SEND
    isOnline: true, // 创建侧默认视为在线消息
    receiverList: params.receiverList, // 透传定向接收列表
    deliverOnlineOnly: params.deliverOnlineOnly, // 透传仅在线投递标记
    webhookEnv: params.webhookEnv, // 透传 webhookEnv
    priority: params.priority, // 透传优先级
    needGroupReadReceipt: params.needGroupReadReceipt, // 透传群已读回执标记
  };
};

/**
 * 创建文本消息
 */
export const createTextMessage = (
  // 创建文本消息
  params: CreateTextMessageParams, // 文本消息入参
  sender?: Sender // 发送者信息
): Message => {
  // 返回消息对象
  const validated = Validator.validateOrThrow(createTextMessageSchema, params); // 参数校验
  const normalizedSender = ensureSender(sender); // 规范化发送者
  const msgLocalId = resolveMsgLocalId();

  const body: TextMessageBody = {
    // 构造文本消息体
    content: validated.content, // 消息内容
  };

  if (validated.targetLanguages) {
    // 处理目标语言
    body.targetLanguages = validated.targetLanguages; // 设置目标语言
  }

  return buildMessage(validated, normalizedSender, 'text', body, msgLocalId); // 返回消息对象
};

/**
 * 创建图片消息
 */
export const createImageMessage = (
  // 创建图片消息
  params: CreateImageMessageParams, // 图片消息入参
  sender?: Sender, // 发送者信息
  options?: CreateImageMessageOptions
): Message => {
  // 返回消息对象
  // 创建阶段只记录图片发送语义和本地文件引用；压缩、大图生成、预检与上传都延后到 sendMessage 前执行。
  const validated = Validator.validateOrThrow(createImageMessageSchema, params); // 参数校验
  const normalizedSender = ensureSender(sender); // 规范化发送者
  const msgLocalId = resolveMsgLocalId();
  const localUrl = validated.data ? resolveMediaUrl(undefined, validated.data) : '';
  const derivedImageUrls = validated.originalUrl
    ? deriveImageUrls(validated.originalUrl, {
        deriveVariants: !options?.useCustomAttachmentUpload,
      })
    : undefined;

  if (validated.data) {
    attachmentFileStore.set(msgLocalId, validated.data);
  }

  const isGif = validated.isGif ?? false;

  const body: ImageMessageBody = {
    // 构造图片消息体
    localUrl, // 本地地址
    filename: validated.filename, // 文件名（可能 undefined，发送前从 data 补全）
    filetype: validated.filetype, // 文件类型（可能 undefined，发送前从 data 补全）
    width: validated.width, // 图片宽度（可能 undefined，发送前自动获取）
    height: validated.height, // 图片高度（可能 undefined，发送前自动获取）
    isGif, // GIF 标记
    isOriginalImage: resolveIsOriginalImage({
      isGif,
      isOriginalImage: validated.isOriginalImage,
    }), // 图片发送语义
  };

  if (derivedImageUrls?.originalImageUrl) {
    body.originalImageUrl = derivedImageUrls.originalImageUrl;
    body.bigImageUrl = derivedImageUrls.bigImageUrl;
    body.thumbnailUrl = derivedImageUrls.thumbnailUrl;
  }

  if (validated.fileLength !== undefined) {
    // 有文件大小
    body.fileLength = validated.fileLength; // 设置文件大小
  }

  if (validated.thumbnailUrl) {
    // 有缩略图
    body.thumbnailUrl = validated.thumbnailUrl; // 设置缩略图地址
  }

  return buildMessage(validated, normalizedSender, 'image', body, msgLocalId); // 返回消息对象
};

/**
 * 创建文件消息
 */
export const createFileMessage = (
  // 创建文件消息
  params: CreateFileMessageParams, // 文件消息入参
  sender?: Sender // 发送者信息
): Message => {
  // 返回消息对象
  const validated = Validator.validateOrThrow(createFileMessageSchema, params); // 参数校验
  const normalizedSender = ensureSender(sender); // 规范化发送者
  const msgLocalId = resolveMsgLocalId();
  const url = resolveMediaUrl(validated.originalUrl, validated.data); // 解析 URL

  if (validated.data) {
    attachmentFileStore.set(msgLocalId, validated.data);
  }

  const body: FileMessageBody = {
    // 构造文件消息体
    url, // 文件地址
    filename: validated.filename, // 文件名（可能 undefined，发送前补全）
    filetype: validated.filetype, // 文件类型（可能 undefined，发送前补全）
  };

  if (validated.fileSize !== undefined) {
    // 有文件大小
    body.fileSize = validated.fileSize; // 设置文件大小
  }

  if (validated.fileLength !== undefined) {
    // 有文件大小
    body.fileLength = validated.fileLength; // 设置文件大小
  }

  return buildMessage(validated, normalizedSender, 'file', body, msgLocalId); // 返回消息对象
};

/**
 * 创建语音消息
 */
export const createVoiceMessage = (
  // 创建语音消息
  params: CreateVoiceMessageParams, // 语音消息入参
  sender?: Sender // 发送者信息
): Message => {
  // 返回消息对象
  const validated = Validator.validateOrThrow(createVoiceMessageSchema, params); // 参数校验
  const normalizedSender = ensureSender(sender); // 规范化发送者
  const msgLocalId = resolveMsgLocalId();
  const url = resolveMediaUrl(validated.originalUrl, validated.data); // 解析 URL

  if (validated.data) {
    attachmentFileStore.set(msgLocalId, validated.data);
  }

  const body: VoiceMessageBody = {
    // 构造语音消息体
    url, // 语音地址
    filename: validated.filename, // 文件名（可能 undefined，发送前补全）
    filetype: validated.filetype, // 文件类型（可能 undefined，发送前补全）
    duration: validated.duration, // 语音时长
  };

  if (validated.fileLength !== undefined) {
    // 有文件大小
    body.fileLength = validated.fileLength; // 设置文件大小
  }

  return buildMessage(validated, normalizedSender, 'voice', body, msgLocalId); // 返回消息对象
};

/**
 * 创建视频消息
 */
export const createVideoMessage = (
  // 创建视频消息
  params: CreateVideoMessageParams, // 视频消息入参
  sender?: Sender // 发送者信息
): Message => {
  // 返回消息对象
  const validated = Validator.validateOrThrow(createVideoMessageSchema, params); // 参数校验
  const normalizedSender = ensureSender(sender); // 规范化发送者
  const msgLocalId = resolveMsgLocalId();
  const url = resolveMediaUrl(validated.originalUrl, validated.data); // 解析 URL

  if (validated.data) {
    attachmentFileStore.set(msgLocalId, validated.data);
  }

  const body: VideoMessageBody = {
    // 构造视频消息体
    url, // 视频地址
    filename: validated.filename, // 文件名（可能 undefined，发送前补全）
    filetype: validated.filetype, // 文件类型（可能 undefined，发送前补全）
    duration: validated.duration, // 视频时长
  };

  if (validated.width !== undefined) {
    // 有宽度
    body.width = validated.width; // 设置宽度
  }

  if (validated.height !== undefined) {
    // 有高度
    body.height = validated.height; // 设置高度
  }

  if (validated.fileLength !== undefined) {
    // 有文件大小
    body.fileLength = validated.fileLength; // 设置文件大小
  }

  if (validated.thumbnailUrl) {
    // 有缩略图
    body.thumbnailUrl = validated.thumbnailUrl; // 设置缩略图
  }

  return buildMessage(validated, normalizedSender, 'video', body, msgLocalId); // 返回消息对象
};

/**
 * 创建位置消息
 */
export const createLocationMessage = (
  // 创建位置消息
  params: CreateLocationMessageParams, // 位置消息入参
  sender?: Sender // 发送者信息
): Message => {
  // 返回消息对象
  const validated = Validator.validateOrThrow(createLocationMessageSchema, params); // 参数校验
  const normalizedSender = ensureSender(sender); // 规范化发送者

  const body: LocationMessageBody = {
    // 构造位置消息体
    latitude: validated.latitude, // 纬度
    longitude: validated.longitude, // 经度
  };

  if (validated.address) {
    // 有地址信息
    body.address = validated.address; // 设置地址
  }

  if (validated.buildingName) {
    // 有建筑名称
    body.buildingName = validated.buildingName; // 设置建筑名称
  }

  return buildMessage(validated, normalizedSender, 'location', body); // 返回消息对象
};

/**
 * 创建命令消息
 */
export const createCmdMessage = (
  // 创建命令消息
  params: CreateCmdMessageParams, // 命令消息入参
  sender?: Sender // 发送者信息
): Message => {
  // 返回消息对象
  const validated = Validator.validateOrThrow(createCmdMessageSchema, params); // 参数校验
  const normalizedSender = ensureSender(sender); // 规范化发送者

  const body: CmdMessageBody = {
    // 构造命令消息体
    action: validated.action, // 命令动作
  };

  if (validated.deliverOnlineOnly !== undefined) {
    // 有在线投递标记
    body.deliverOnlineOnly = validated.deliverOnlineOnly; // 设置标记
  }

  return buildMessage(validated, normalizedSender, 'cmd', body); // 返回消息对象
};

/**
 * 创建自定义消息
 */
export const createCustomMessage = (
  // 创建自定义消息
  params: CreateCustomMessageParams, // 自定义消息入参
  sender?: Sender // 发送者信息
): Message => {
  // 返回消息对象
  const validated = Validator.validateOrThrow(createCustomMessageSchema, params); // 参数校验
  const normalizedSender = ensureSender(sender); // 规范化发送者

  const body: CustomMessageBody = {
    // 构造自定义消息体
    event: validated.event, // 自定义事件
  };

  if (validated.params) {
    // 有自定义参数
    body.params = validated.params; // 设置自定义参数
  }

  return buildMessage(validated, normalizedSender, 'custom', body); // 返回消息对象
};

/**
 * 创建合并消息
 */
export const createCombineMessage = (
  params: CreateCombineMessageParams,
  sender?: Sender
): Message => {
  const validated = Validator.validateOrThrow(createCombineMessageSchema, params);
  const messageList = validated.messageList as unknown as ReadonlyArray<Message>;
  const normalizedSender = ensureSender(sender);
  validateCombineMessageList(messageList);
  const combineLevel = calculateCombineLevel(messageList);
  ensureCombineLevel(combineLevel);

  const body: CombineMessageBody = {
    title: validated.title,
    summary: validated.summary,
    compatibleText: validated.compatibleText ?? '[聊天记录]',
    messageList,
    filename: 'combine',
    filetype: 'application/octet-stream',
    combineLevel,
  };

  const message = buildMessage(validated, normalizedSender, 'combine', body);
  return {
    ...message,
    combineLevel,
  };
};
