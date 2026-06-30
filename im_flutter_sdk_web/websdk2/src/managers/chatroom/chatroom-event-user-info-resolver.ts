import type { CacheManager } from '../../cache/cache-manager';
import type { UserInfoSummary } from '../../cache/cache-types';
import type { UserInfo } from '../../types/user-info';

export interface ChatRoomUserInfoFetchParams {
  readonly userIds: ReadonlyArray<string>;
}

export type ChatRoomUserInfoFetcher = (
  params: ChatRoomUserInfoFetchParams
) => Promise<ReadonlyArray<UserInfo>>;

interface ChatRoomUserInfoResolverOptions {
  readonly cacheManager: Pick<CacheManager, 'getUserInfoSummaries'> | null;
  readonly fetchUserInfos?: ChatRoomUserInfoFetcher;
}

const USER_INFO_FIELDS = [
  'nickname',
  'avatarUrl',
  'mail',
  'phone',
  'gender',
  'sign',
  'birth',
  'ext',
] as const;

const dedupeUserIds = (userIds: ReadonlyArray<string>): ReadonlyArray<string> => {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of userIds) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

const toUserInfoFromSummary = (summary: UserInfoSummary): UserInfo => {
  return {
    userId: summary.userId,
    nickname: summary.nickname,
    avatarUrl: summary.avatarUrl,
    sign: summary.sign,
    ext: summary.ext,
  };
};

export const buildMinimalChatRoomUserInfo = (userId: string): UserInfo => ({
  userId,
});

export const mergeChatRoomUserInfo = (
  base: UserInfo | undefined,
  incoming: UserInfo | undefined,
  userId: string
): UserInfo => {
  const result: UserInfo = {
    userId,
  };

  for (const field of USER_INFO_FIELDS) {
    const value = incoming?.[field] ?? base?.[field];
    if (value !== undefined) {
      (result as unknown as Record<string, unknown>)[field] = value;
    }
  }

  return result;
};

export const resolveChatRoomUserInfoMap = async (
  userIds: ReadonlyArray<string>,
  options: ChatRoomUserInfoResolverOptions
): Promise<ReadonlyMap<string, UserInfo>> => {
  const normalizedUserIds = dedupeUserIds(userIds);
  const resolved = new Map<string, UserInfo>();

  if (normalizedUserIds.length === 0) {
    return resolved;
  }

  const cachedUsers = options.cacheManager?.getUserInfoSummaries(normalizedUserIds, false) ?? [];
  for (const summary of cachedUsers) {
    resolved.set(summary.userId, toUserInfoFromSummary(summary));
  }

  const missingUserIds = normalizedUserIds.filter(userId => !resolved.has(userId));
  if (missingUserIds.length > 0 && options.fetchUserInfos) {
    const fetchedUsers = await options.fetchUserInfos({
      userIds: missingUserIds,
    });
    for (const item of fetchedUsers) {
      resolved.set(item.userId, item);
    }
  }

  for (const userId of normalizedUserIds) {
    if (!resolved.has(userId)) {
      resolved.set(userId, buildMinimalChatRoomUserInfo(userId));
    }
  }

  return resolved;
};

export const resolveChatRoomUserInfos = async (
  userIds: ReadonlyArray<string>,
  options: ChatRoomUserInfoResolverOptions
): Promise<ReadonlyArray<UserInfo>> => {
  const normalizedUserIds = dedupeUserIds(userIds);
  const userInfoMap = await resolveChatRoomUserInfoMap(normalizedUserIds, options);
  return normalizedUserIds.map(userId =>
    mergeChatRoomUserInfo(undefined, userInfoMap.get(userId), userId)
  );
};
