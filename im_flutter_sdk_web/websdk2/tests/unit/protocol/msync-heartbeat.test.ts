/**
 * MSync 心跳编码测试
 */

import { describe, it, expect } from 'vitest'; // 测试框架
import { MsyncCodec } from '@/protocol/msync/codec'; // 编解码器
import { MsyncCommand } from '@/protocol/msync/types'; // 命令常量

describe('Msync heartbeat', (): void => {
  it('encodeHeartbeat 使用 UNREAD 命令', (): void => {
    const codec = new MsyncCodec({ // 创建编解码器
      appKey: 'app#key', // appKey
      userId: 'user-1', // 用户 ID
      token: 'token-1', // token
      useFixedDeviceId: true, // 固定设备 ID
      deviceId: 'webim', // 设备 ID
    }); // 编解码器创建结束

    const payload = codec.encodeHeartbeat(); // 生成心跳消息
    const decoded = codec.decodeMsync(payload); // 解码 MSync

    expect(decoded.command).toBe(MsyncCommand.UNREAD); // 校验命令类型
  });
});
