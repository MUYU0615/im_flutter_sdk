import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/028-chatroom-manager-api/contracts/chatroom-manager.openapi.yaml'
);

describe('chatroom-manager contract', () => {
  it('应包含聊天室生命周期、成员、公告与属性核心路径', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('openapi: 3.0.3');
    expect(content).toContain('/sdk/chatroom-manager/chatrooms:');
    expect(content).not.toContain('/sdk/chatroom-manager/chatrooms/joined:');
    expect(content).toContain('/sdk/chatroom-manager/chatrooms/{chatRoomId}:');
    expect(content).toContain('/sdk/chatroom-manager/chatrooms/{chatRoomId}/members:');
    expect(content).toContain('/sdk/chatroom-manager/chatrooms/{chatRoomId}/admins:');
    expect(content).toContain('/sdk/chatroom-manager/chatrooms/{chatRoomId}/announcement:');
    expect(content).toContain('/sdk/chatroom-manager/chatrooms/{chatRoomId}/shared-files:');
    expect(content).toContain('/sdk/chatroom-manager/chatrooms/{chatRoomId}/attributes:');
  });

  it('应约束聊天室属性结果、allowlist 命名与上传共享文件已移除', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('ChatRoomAttributeMutationResult');
    expect(content).toContain('ChatRoomAttributesSnapshot');
    expect(content).toContain('/sdk/chatroom-manager/chatrooms/{chatRoomId}/allowlist:');
    expect(content).toContain('/sdk/chatroom-manager/chatrooms/{chatRoomId}/allowlist/me:');
    expect(content).toContain('operationId: getAttributes');
    expect(content).toContain('operationId: deleteSharedFile');
    expect(content).not.toContain('operationId: createChatRoom');
    expect(content).not.toContain('operationId: getJoinedChatRoomList');
    expect(content).not.toContain('uploadSharedFile');
    expect(content).not.toContain('operationId: uploadChatRoomSharedFile');
  });
});
