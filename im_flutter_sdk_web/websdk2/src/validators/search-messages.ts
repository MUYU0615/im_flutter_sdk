/**
 * 服务端消息搜索参数校验
 */

import { z } from './validator'; // 引入统一校验工具

const searchableMessageTypes = ['txt', 'img', 'video', 'file', 'loc', 'custom'] as const;

const messageSearchOptionSchema = z.object({
  // 搜索选项校验
  keywordList: z
    .array(z.string())
    .min(1, 'keywordList must not be empty') // 关键词列表不能为空
    .max(5, 'keywordList must have at most 5 keywords') // 最多5个关键词
    .refine(
      list => list.map(k => k.trim()).filter(k => k.length > 0).length > 0,
      'keywordList must contain at least one non-empty keyword' // 至少一个非空关键词
    )
    .refine(
      list => list.every(k => k.trim().length <= 512),
      'each keyword must be at most 512 characters' // 单个关键词最长512字符
    ),
  keywordListMatchType: z.enum(['or', 'and']).optional(), // 关键词匹配模式可选
  conversationId: z.string().min(1).optional(), // 会话 ID 可选
  conversationType: z.enum(['singleChat', 'groupChat', 'chatRoom']).optional(), // 会话类型可选
  msgTypes: z.array(z.enum(searchableMessageTypes)).optional(), // 消息类型过滤可选
  startTime: z.number().optional(), // 开始时间可选
  endTime: z.number().optional(), // 结束时间可选
  searchScope: z.enum(['none', 'with', 'only']).optional(), // 搜索范围可选
  direction: z.enum(['up', 'down']).optional(), // 排序方向可选
}).refine(
  data => {
    // conversationId 和 conversationType 必须同时提供或同时不提供
    const hasId = data.conversationId !== undefined;
    const hasType = data.conversationType !== undefined;
    return hasId === hasType;
  },
  { message: 'conversationId and conversationType must be provided together' }
).refine(
  data => {
    // startTime 和 endTime 必须同时提供或同时不提供
    const hasStart = data.startTime !== undefined;
    const hasEnd = data.endTime !== undefined;
    return hasStart === hasEnd;
  },
  { message: 'startTime and endTime must be provided together' }
).refine(
  data => {
    // endTime 必须大于等于 startTime
    if (data.startTime !== undefined && data.endTime !== undefined) {
      return data.endTime >= data.startTime;
    }
    return true;
  },
  { message: 'endTime must be >= startTime' }
);

export const searchMessagesSchema = z.object({
  // 顶层搜索参数校验
  option: messageSearchOptionSchema, // 搜索选项
  pageNum: z.number().int().min(1).default(1), // 页码，默认1
  pageSize: z.number().int().min(1).max(100).default(20), // 每页数量，默认20
});
