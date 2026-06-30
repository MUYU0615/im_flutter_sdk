export const MULTIPART_THRESHOLD = 1024 * 1024 * 5; // 5MB
export const DEFAULT_PART_SIZE = 1024 * 1024 * 5; // 默认分片大小 5MB
export const MAX_POOL = 4; // 最大并发分片数

export const FILE_CONVERSATION_TYPES = {
  single: 'CHAT',
  group: 'GROUP',
  room: 'ROOM',
} as const;
