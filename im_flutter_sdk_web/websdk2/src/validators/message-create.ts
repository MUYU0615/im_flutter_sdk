/**
 * 创建消息方法参数校验
 */

import { z } from './validator'; // 引入统一校验工具

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  // 判断是否为普通对象
  return typeof value === 'object' && value !== null && !Array.isArray(value); // 校验对象类型
};

const isJsonSerializable = (value: Record<string, unknown>): boolean => {
  // 判断是否可 JSON 序列化
  try {
    JSON.stringify(value); // 尝试序列化
    return true; // 序列化成功
  } catch {
    return false; // 序列化失败
  }
};

const conversationTypeSchema = z.enum(['singleChat', 'groupChat', 'chatRoom']);

const extSchema = z // 扩展字段校验
  .record(z.unknown()) // 允许任意值的对象
  .refine(value => isPlainRecord(value), 'ext must be an object') // 必须为普通对象
  .refine(value => isJsonSerializable(value), 'ext must be JSON serializable'); // 必须可序列化

const miniAppFileSchema = z.object({
  // 小程序/uniapp 文件对象校验
  path: z.string().min(1, 'data.path is required'), // 本地路径必填
  size: z.number().optional(), // 文件大小可选
  name: z.string().optional(), // 文件名称可选
  type: z.string().optional(), // 文件类型可选
});

const browserFileSchema = typeof File !== 'undefined' ? z.instanceof(File) : z.never(); // H5 File 校验

const compatibleFileSchema = z.union([browserFileSchema, miniAppFileSchema]); // 跨端文件对象校验

const createMessageBaseSchema = z.object({
  // 创建消息基础参数校验
  conversationId: z.string().min(1, 'conversationId is required'), // 会话 ID
  conversationType: conversationTypeSchema, // 会话类型
  ext: extSchema.optional(), // 扩展字段可选
  timestamp: z.number().int().positive('timestamp must be a positive integer').optional(), // 时间戳可选
  receiverList: z
    .array(z.string().min(1, 'receiverList item is required'))
    .nonempty('receiverList must not be empty')
    .optional(), // 定向接收者列表可选
  deliverOnlineOnly: z.boolean().optional(), // 在线投递开关可选
  webhookEnv: z.string().optional(), // webhookEnv 可选，可为空串
  priority: z.enum(['high', 'normal', 'low']).optional(), // 优先级可选
  needGroupReadReceipt: z.boolean().optional(), // 群已读回执可选
});

const combineMessageItemSchema = z
  .object({
    type: z.string().min(1, 'messageList.type is required'),
    sender: z.object({
      userId: z.string().min(1, 'messageList.sender.userId is required'),
      nickname: z.string().optional(),
      avatarUrl: z.string().optional(),
    }),
    conversationId: z.string().min(1, 'messageList.conversationId is required'),
    conversationType: conversationTypeSchema,
    timestamp: z.number().int().positive('messageList.timestamp must be positive'),
    body: z.record(z.unknown()),
    combineLevel: z.number().int().min(0).max(10).optional(),
  })
  .passthrough();

interface ReceiverListRuleValue {
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  receiverList?: string[];
  needGroupReadReceipt?: boolean;
}

const withReceiverListRule = <TOutput extends ReceiverListRuleValue, TInput>(
  schema: z.ZodType<TOutput, z.ZodTypeDef, TInput>
): z.ZodType<TOutput, z.ZodTypeDef, TInput> => {
  // 追加 receiverList 组合规则
  return schema.superRefine((value, context) => {
    if (value.receiverList && value.conversationType !== 'groupChat') {
      // 非群组不允许定向接收
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'receiverList is only allowed for group conversation',
        path: ['receiverList'],
      });
    }
    if (value.needGroupReadReceipt && value.conversationType !== 'groupChat') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'needGroupReadReceipt is only allowed for group conversation',
        path: ['needGroupReadReceipt'],
      });
    }
  });
};

export const createTextMessageSchema = withReceiverListRule(
  createMessageBaseSchema.extend({
    // 文本消息校验
    content: z.string().min(1, 'content is required'), // 消息内容必填
    targetLanguages: z.array(z.string().min(1)).optional(), // 目标语言可选
  })
);

export const createImageMessageSchema = withReceiverListRule(
  createMessageBaseSchema // 图片消息校验
    .extend({
      // 扩展图片字段
      originalUrl: z.string().min(1, 'originalUrl is required').optional(), // 原图地址可选
      filename: z.string().min(1, 'filename is required').optional(), // 文件名可选
      filetype: z.string().min(1, 'filetype is required').optional(), // 文件类型可选
      width: z.number().positive('width must be positive').optional(), // 宽度可选
      height: z.number().positive('height must be positive').optional(), // 高度可选
      isGif: z.boolean().optional(), // GIF 标记可选
      isOriginalImage: z.boolean().optional(), // 原图语义可选
      fileLength: z.number().positive('fileLength must be positive').optional(), // 文件大小可选
      data: compatibleFileSchema.optional(), // 文件对象可选
      thumbnailUrl: z.string().min(1).optional(), // 缩略图可选
    }) // 结束图片字段
    .refine(value => Boolean(value.originalUrl || value.data), {
      // originalUrl 与 data 至少其一
      message: 'originalUrl or data is required', // 错误提示
      path: ['originalUrl'], // 错误路径
    })
); // 结束图片校验

export const createFileMessageSchema = withReceiverListRule(
  createMessageBaseSchema // 文件消息校验
    .extend({
      // 扩展文件字段
      originalUrl: z.string().min(1, 'originalUrl is required').optional(), // 文件地址可选
      filename: z.string().min(1, 'filename is required').optional(), // 文件名可选
      filetype: z.string().min(1, 'filetype is required').optional(), // 文件类型可选
      fileSize: z.number().positive('fileSize must be positive').optional(), // 文件大小可选
      fileLength: z.number().positive('fileLength must be positive').optional(), // 文件大小可选
      data: compatibleFileSchema.optional(), // 文件对象可选
    }) // 结束文件字段
    .refine(value => Boolean(value.originalUrl || value.data), {
      // originalUrl 与 data 至少其一
      message: 'originalUrl or data is required', // 错误提示
      path: ['originalUrl'], // 错误路径
    })
); // 结束文件校验

export const createVoiceMessageSchema = withReceiverListRule(
  createMessageBaseSchema // 语音消息校验
    .extend({
      // 扩展语音字段
      originalUrl: z.string().min(1, 'originalUrl is required').optional(), // 语音地址可选
      filename: z.string().min(1, 'filename is required').optional(), // 文件名可选
      filetype: z.string().min(1, 'filetype is required').optional(), // 文件类型可选
      duration: z.number().positive('duration must be positive'), // 时长必填
      fileLength: z.number().positive('fileLength must be positive').optional(), // 文件大小可选
      data: compatibleFileSchema.optional(), // 文件对象可选
    }) // 结束语音字段
    .refine(value => Boolean(value.originalUrl || value.data), {
      // originalUrl 与 data 至少其一
      message: 'originalUrl or data is required', // 错误提示
      path: ['originalUrl'], // 错误路径
    })
); // 结束语音校验

export const createVideoMessageSchema = withReceiverListRule(
  createMessageBaseSchema // 视频消息校验
    .extend({
      // 扩展视频字段
      originalUrl: z.string().min(1, 'originalUrl is required').optional(), // 视频地址可选
      filename: z.string().min(1, 'filename is required').optional(), // 文件名可选
      filetype: z.string().min(1, 'filetype is required').optional(), // 文件类型可选
      duration: z.number().positive('duration must be positive'), // 时长必填
      width: z.number().positive('width must be positive').optional(), // 宽度可选
      height: z.number().positive('height must be positive').optional(), // 高度可选
      fileLength: z.number().positive('fileLength must be positive').optional(), // 文件大小可选
      thumbnailUrl: z.string().min(1).optional(), // 缩略图可选
      data: compatibleFileSchema.optional(), // 文件对象可选
    }) // 结束视频字段
    .refine(value => Boolean(value.originalUrl || value.data), {
      // originalUrl 与 data 至少其一
      message: 'originalUrl or data is required', // 错误提示
      path: ['originalUrl'], // 错误路径
    })
); // 结束视频校验

export const createLocationMessageSchema = withReceiverListRule(
  createMessageBaseSchema.extend({
    // 位置消息校验
    latitude: z.number(), // 纬度必填
    longitude: z.number(), // 经度必填
    address: z.string().min(1).optional(), // 地址可选
    buildingName: z.string().min(1).optional(), // 建筑名称可选
  })
); // 结束位置校验

export const createCmdMessageSchema = withReceiverListRule(
  createMessageBaseSchema.extend({
    // 命令消息校验
    action: z.string().min(1, 'action is required'), // 动作必填
  })
); // 结束命令校验

export const createCustomMessageSchema = withReceiverListRule(
  createMessageBaseSchema.extend({
    // 自定义消息校验
    event: z.string().min(1, 'event is required'), // 事件名称必填
    params: z.record(z.string()).optional(), // 参数可选
  })
); // 结束自定义校验

export const createCombineMessageSchema = withReceiverListRule(
  createMessageBaseSchema.extend({
    title: z.string().min(1, 'title is required'),
    summary: z.string().min(1, 'summary is required'),
    compatibleText: z.string().min(1).optional(),
    messageList: z
      .array(combineMessageItemSchema)
      .min(1, 'messageList must not be empty')
      .max(300, 'messageList max length is 300'),
  })
);
