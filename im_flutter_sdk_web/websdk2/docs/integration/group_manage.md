# 群组管理

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `GroupManager`。

## 创建群组

```typescript
const result = await client.groupManager.createGroup({
  groupName: '我的群组',
  description: '群组描述',
  members: ['user2', 'user3'],
  isPublic: true,           // 是否公开群
  needApprovalToJoin: true, // 入群是否需要审批
  allowMemberToInvite: true, // 是否允许成员邀请
  inviteNeedConfirm: true,  // 邀请是否需要确认
  maxMemberCount: 200,
});

console.log('群组 ID:', result.groupId);
```

## 获取群组信息

```typescript
// 获取单个群信息
const groupInfo = await client.groupManager.getGroupInfo({ groupId: 'group1' });

// 批量获取群信息
const groupInfoList = await client.groupManager.getGroupInfoList({
  groupIds: ['group1', 'group2'],
});
```

## 获取群组列表

```typescript
// 获取已加入的群组
const joined = await client.groupManager.getJoinedGroupList({
  pageSize: 20,
  pageNum: 1,
});

// 获取公开群列表
const publicGroups = await client.groupManager.getPublicGroupList({
  pageSize: 20,
  cursor: '',
});
```

## 修改群组信息

```typescript
await client.groupManager.updateGroupInfo({
  groupId: 'group1',
  groupName: '新群名',
  description: '新描述',
  ext: '{"key": "value"}',
});
```

## 解散群组

```typescript
await client.groupManager.destroyGroup({ groupId: 'group1' });
```

## 退出群组

```typescript
await client.groupManager.leaveGroup({ groupId: 'group1' });
```

## 转让群主

```typescript
await client.groupManager.changeGroupOwner({
  groupId: 'group1',
  newOwner: 'user2',
});
```

## 邀请用户入群

```typescript
await client.groupManager.inviteUsersToGroup({
  groupId: 'group1',
  userIds: ['user4', 'user5'],
});
```

## 申请加入群组

```typescript
await client.groupManager.joinGroup({
  groupId: 'group1',
  reason: '我想加入这个群',
});
```

## 处理入群申请

```typescript
// 同意
await client.groupManager.acceptGroupJoinRequest({
  groupId: 'group1',
  applicant: 'user4',
});

// 拒绝
await client.groupManager.rejectGroupJoinRequest({
  groupId: 'group1',
  applicant: 'user4',
  reason: '暂不接受新成员',
});
```

## 处理入群邀请

```typescript
// 接受邀请
await client.groupManager.acceptInvitation({ groupId: 'group1' });

// 拒绝邀请
await client.groupManager.rejectInvitation({ groupId: 'group1' });
```

## 使用 Group 实体对象

SDK 提供面向对象的 Group 实体，通过 `getGroup` 获取：

```typescript
const group = client.groupManager.getGroup('group1');

// 获取详情
const detail = await group.getDetail();

// 修改信息
await group.updateInfo({ groupName: '新名称' });

// 成员操作
const members = await group.getMembers({ pageSize: 20, cursor: '' });
```

## 监听群组事件

```typescript
client.addEventHandler('group', {
  // 收到入群邀请
  onGroupInvitation: (event) => {
    console.log('收到入群邀请:', event.groupId, '邀请者:', event.from);
  },
  // 入群申请
  onGroupJoinRequest: (event) => {
    console.log('收到入群申请:', event.groupId, '申请者:', event.from);
  },
  // 成员加入
  onGroupMemberJoined: (event) => {
    console.log('成员加入:', event.userId, '群:', event.groupId);
  },
  // 成员退出
  onGroupMemberExited: (event) => {
    console.log('成员退出:', event.userId, '群:', event.groupId);
  },
  // 被移出群
  onGroupMemberRemoved: (event) => {
    console.log('被移出群:', event.groupId);
  },
  // 群组解散
  onGroupDestroyed: (event) => {
    console.log('群组解散:', event.groupId);
  },
  // 群信息变更
  onGroupInfoChanged: (event) => {
    console.log('群信息变更:', event.groupId);
  },
  // 群主变更
  onGroupOwnerChanged: (event) => {
    console.log('群主变更:', event.groupId, '新群主:', event.newOwner);
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onGroupInvitation` | 收到入群邀请 | 被邀请者 |
| `onGroupJoinRequest` | 收到入群申请 | 群主和管理员 |
| `onGroupInvitationAccepted` | 邀请被接受 | 邀请发起者 |
| `onGroupInvitationDeclined` | 邀请被拒绝 | 邀请发起者 |
| `onGroupJoinRequestAccepted` | 入群申请被同意 | 申请者 |
| `onGroupJoinRequestDeclined` | 入群申请被拒绝 | 申请者 |
| `onGroupMemberJoined` | 新成员加入 | 群内所有成员 |
| `onGroupMemberExited` | 成员退出 | 群内所有成员 |
| `onGroupMemberRemoved` | 被移出群 | 被移出者 + 群内所有成员 |
| `onGroupDestroyed` | 群组解散 | 群内所有成员 |
| `onGroupInfoChanged` | 群信息变更 | 群内所有成员 |
| `onGroupOwnerChanged` | 群主变更 | 群内所有成员 |
| `onGroupAdminAdded` | 新增管理员 | 群内所有成员 |
| `onGroupAdminRemoved` | 移除管理员 | 群内所有成员 |
