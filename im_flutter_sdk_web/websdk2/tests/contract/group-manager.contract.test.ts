import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/027-group-manager-api/contracts/group-manager.openapi.yaml'
);
const OO_PILOT_CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/032-group-internal-oo-pilot/contracts/group-internal-oo-pilot.md'
);

describe('group-manager contract', () => {
  it('应包含群组生命周期、成员、管理员与高阶能力核心路径', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('openapi: 3.0.3');
    expect(content).toContain('/sdk/group-manager/groups:');
    expect(content).toContain('/sdk/group-manager/groups/joined:');
    expect(content).toContain('/sdk/group-manager/groups/{groupId}:');
    expect(content).toContain('/sdk/group-manager/groups/{groupId}/members:');
    expect(content).toContain('/sdk/group-manager/groups/{groupId}/admins:');
    expect(content).toContain('/sdk/group-manager/groups/{groupId}/blocks:');
    expect(content).toContain('/sdk/group-manager/groups/{groupId}/allowlist:');
    expect(content).toContain('/sdk/group-manager/groups/{groupId}/mutes:');
    expect(content).toContain('/sdk/group-manager/groups/{groupId}/announcement:');
    expect(content).toContain('/sdk/group-manager/groups/{groupId}/shared-files:');
    expect(content).toContain('/sdk/group-manager/groups/{groupId}/members/attributes:');
  });

  it('应覆盖基础生命周期 mutation 与用户列表类 operationId', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('operationId: createGroup');
    expect(content).toContain('operationId: getJoinedGroupList');
    expect(content).toContain('operationId: getGroupInfo');
    expect(content).toContain('operationId: updateGroupInfo');
    expect(content).toContain('operationId: destroyGroup');
    expect(content).toContain('operationId: getGroupMemberList');
    expect(content).toContain('operationId: removeGroupMembers');
    expect(content).toContain('operationId: getGroupAdminList');
    expect(content).toContain('operationId: addGroupAdmin');
    expect(content).toContain('operationId: removeGroupAdmin');
    expect(content).toContain('operationId: getGroupBlocklist');
    expect(content).toContain('operationId: blockGroupMembers');
    expect(content).toContain('operationId: unblockGroupMembers');
    expect(content).toContain('operationId: getGroupAllowlist');
    expect(content).toContain('operationId: addUsersToGroupAllowlist');
    expect(content).toContain('operationId: removeUsersFromGroupAllowlist');
    expect(content).toContain('operationId: getGroupMuteList');
  });

  it('应约束对象化返回、成员属性与高阶 sampleRef', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('GroupMemberListResult');
    expect(content).toContain('GroupBlocklistEntry');
    expect(content).toContain('GroupAllowlistEntry');
    expect(content).toContain('GroupMuteEntry');
    expect(content).toContain('GroupAnnouncement');
    expect(content).toContain('GroupSharedFileListResult');
    expect(content).toContain('GroupSharedFile');
    expect(content).toContain('GroupMembersAttributesResult');
    expect(content).toContain('operationId: getGroupAnnouncement');
    expect(content).toContain('operationId: getGroupSharedFileList');
    expect(content).toContain('operationId: getGroupMembersAttributes');
    expect(content).toContain('sampleRef: docs/reference/group-api.md#get-group-detail');
    expect(content).toContain('sampleRef: docs/reference/group-api.md#get-group-admins');
    expect(content).toContain('sampleRef: docs/reference/group-api.md#get-group-blocklist');
    expect(content).toContain('sampleRef: docs/reference/group-api.md#get-group-allowlist');
    expect(content).toContain('sampleRef: docs/reference/group-api.md#get-group-mute-list');
    expect(content).toContain('sampleRef: docs/reference/group-api.md#get-group-announcement');
    expect(content).toContain('sampleRef: docs/reference/group-api.md#get-group-shared-files');
    expect(content).toContain('sampleRef: docs/reference/group-api.md#get-group-members-attributes');
  });

  it('032 试点 contract 应锁定 plain data、public handle 与会话隔离边界', () => {
    const content = readFileSync(OO_PILOT_CONTRACT_PATH, 'utf8');

    expect(content).toContain('`list.items` MUST 继续为 plain data `GroupSummary[]`');
    expect(content).toContain('返回值 MUST 继续是公开 `Group` handle');
    expect(content).toContain('`Group` 本身 MUST NOT 成为独立状态真相');
    expect(content).toContain('关键群事件 MUST 先更新内部真相，再导出公开 payload');
    expect(content).toContain('旧会话内部对象 MUST NOT 泄漏到新会话');
  });
});
