# 群组属性

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `GroupManager`。

## 群公告

```typescript
// 获取群公告
const announcement = await client.groupManager.getGroupAnnouncement({
  groupId: 'group1',
});

// 更新群公告（最多 512 字符，仅群主/管理员）
await client.groupManager.updateGroupAnnouncement({
  groupId: 'group1',
  announcement: '欢迎加入本群！',
});
```

## 群共享文件

```typescript
// 获取共享文件列表
const result = await client.groupManager.getGroupSharedFileList({
  groupId: 'group1',
  pageSize: 20,
  pageNum: 1,
});

// 上传共享文件（最大 10MB）
await client.groupManager.uploadGroupSharedFile({
  groupId: 'group1',
  file: selectedFile,
});

// 下载共享文件
await client.groupManager.downloadGroupSharedFile({
  groupId: 'group1',
  fileId: 'file-id-123',
});

// 删除共享文件
await client.groupManager.deleteGroupSharedFile({
  groupId: 'group1',
  fileId: 'file-id-123',
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onGroupAnnouncementChanged` | 群公告变更 | 群内所有成员 |
| `onGroupSharedFileAdded` | 新增共享文件 | 群内所有成员 |
| `onGroupSharedFileDeleted` | 删除共享文件 | 群内所有成员 |
