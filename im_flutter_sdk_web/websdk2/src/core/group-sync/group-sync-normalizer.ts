import {
  JoinedGroupProtocolRemindType,
  JoinedGroupProtocolRole,
} from '../../protocol/joined-groups/types';
import type { JoinedGroupProtocolItem } from '../../protocol/joined-groups/types';
import type { JoinedGroupSummary, GroupRole } from '../../types/group';
import type { SessionListRemindType } from '../../types/conversation';

const mapRole = (role: number | undefined): GroupRole | undefined => {
  if (role === JoinedGroupProtocolRole.OWNER) {
    return 'owner';
  }
  if (role === JoinedGroupProtocolRole.ADMIN) {
    return 'admin';
  }
  if (role === JoinedGroupProtocolRole.MEMBER) {
    return 'member';
  }
  return undefined;
};

const normalizeRemindType = (value: number | undefined): SessionListRemindType | undefined => {
  if (value === JoinedGroupProtocolRemindType.DEFAULT) {
    return 'DEFAULT';
  }
  if (value === JoinedGroupProtocolRemindType.ALL) {
    return 'ALL';
  }
  if (value === JoinedGroupProtocolRemindType.AT) {
    return 'AT';
  }
  if (value === JoinedGroupProtocolRemindType.NONE) {
    return 'NONE';
  }
  return undefined;
};

export const normalizeJoinedGroupItem = (
  item: JoinedGroupProtocolItem
): JoinedGroupSummary | null => {
  const groupId = item.group_id?.trim();
  if (!groupId) {
    return null;
  }
  return {
    groupId,
    name: item.group_name ?? '',
    description: item.description,
    memberCount: item.members_count,
    role: mapRole(item.role),
    disabled: item.disabled,
    ownerId: item.group_owner,
    avatarUrl: item.group_avatar,
    muteAllMembers: item.mute_all,
    muteExpiration: item.mute_expiration,
    remindType: normalizeRemindType(item.remind_type),
    createdAt: item.create_at,
    updatedAt: item.update_at,
    joinedAt: item.joined_timestamp,
  };
};

export const normalizeJoinedGroupItems = (
  items: ReadonlyArray<JoinedGroupProtocolItem>
): ReadonlyArray<JoinedGroupSummary> => {
  const normalized: JoinedGroupSummary[] = [];
  for (const item of items) {
    const summary = normalizeJoinedGroupItem(item);
    if (summary) {
      normalized.push(summary);
    }
  }
  return normalized;
};
