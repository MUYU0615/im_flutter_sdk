/**
 * 数据清理工具
 *
 * 对标 robot 的 Setup/Teardown 清理逻辑。
 * 所有方法忽略错误，确保清理不会因残留数据不存在而失败。
 */

/** 最小 client 接口，避免依赖 .use() 注册后的具体类型 */
interface ClientWithManagers {
  contactManager: {
    deleteContact(params: { userId: string }): Promise<void>;
    removeUserFromBlocklist(params: { userId: string }): Promise<void>;
  };
  groupManager: {
    destroyGroup(params: { groupId: string }): Promise<void>;
  };
  chatRoomManager: {
    leaveChatRoom(params: { chatRoomId: string }): Promise<void>;
  };
}

/**
 * 清除两个用户间的好友关系（双向删除，忽略错误）
 */
export async function cleanupContacts(client: ClientWithManagers, userIdB: string): Promise<void> {
  try {
    await client.contactManager.deleteContact({ userId: userIdB });
  } catch {
    // 忽略：可能不是好友
  }
}

/**
 * 销毁群组（忽略不存在错误）
 */
export async function destroyGroupSafe(client: ClientWithManagers, groupId: string): Promise<void> {
  try {
    await client.groupManager.destroyGroup({ groupId });
  } catch {
    // 忽略：群组可能不存在或无权限
  }
}

/**
 * 退出聊天室（忽略错误）
 */
export async function leaveChatroomSafe(client: ClientWithManagers, chatroomId: string): Promise<void> {
  try {
    await client.chatRoomManager.leaveChatRoom({ chatRoomId: chatroomId });
  } catch {
    // 忽略：可能未加入或聊天室不存在
  }
}

/**
 * 从黑名单移除用户（忽略错误）
 */
export async function removeFromBlocklistSafe(client: ClientWithManagers, userId: string): Promise<void> {
  try {
    await client.contactManager.removeUserFromBlocklist({ userId });
  } catch {
    // 忽略：可能不在黑名单中
  }
}
