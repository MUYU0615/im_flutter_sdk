import type { CacheManager } from '../../cache/cache-manager';
import type { UserInfoSummary } from '../../cache/cache-types';
import type { UserInfo } from '../../types/user-info';
import type { Contact } from '../../types/contact';

export interface ContactUserInfoFetchParams {
  readonly userIds: ReadonlyArray<string>;
}

export type ContactUserInfoFetcher = (
  params: ContactUserInfoFetchParams
) => Promise<ReadonlyArray<UserInfo>>;

interface ContactUserInfoResolverOptions {
  readonly cacheManager: Pick<CacheManager, 'getUserInfoSummaries'> | null;
  readonly fetchUserInfos?: ContactUserInfoFetcher;
}

const buildMinimalContactUserInfo = (userId: string): UserInfo => {
  return {
    userId,
  };
};

const mergeContactUserInfo = (
  base: UserInfo | undefined,
  incoming: UserInfo | undefined,
  userId: string
): UserInfo => {
  return {
    userId,
    nickname: incoming?.nickname ?? base?.nickname,
    avatarUrl: incoming?.avatarUrl ?? base?.avatarUrl,
    mail: incoming?.mail ?? base?.mail,
    phone: incoming?.phone ?? base?.phone,
    gender: incoming?.gender ?? base?.gender,
    sign: incoming?.sign ?? base?.sign,
    birth: incoming?.birth ?? base?.birth,
    ext: incoming?.ext ?? base?.ext,
  };
};

const toContactUserInfoFromSummary = (summary: UserInfoSummary): UserInfo => {
  return {
    userId: summary.userId,
    nickname: summary.nickname,
    avatarUrl: summary.avatarUrl,
    sign: summary.sign,
    ext: summary.ext,
  };
};

const toContactUserInfoFromProfile = (profile: UserInfo): UserInfo => profile;

const dedupeUserIds = (userIds: ReadonlyArray<string>): ReadonlyArray<string> => {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const userId of userIds) {
    const normalized = userId.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

export const resolveContactUserInfoMap = async (
  userIds: ReadonlyArray<string>,
  options: ContactUserInfoResolverOptions
): Promise<ReadonlyMap<string, UserInfo>> => {
  const normalizedUserIds = dedupeUserIds(userIds);
  const resolved = new Map<string, UserInfo>();

  if (normalizedUserIds.length === 0) {
    return resolved;
  }

  const cachedUsers = options.cacheManager?.getUserInfoSummaries(normalizedUserIds, false) ?? [];
  for (const item of cachedUsers) {
    resolved.set(item.userId, toContactUserInfoFromSummary(item));
  }

  const missingUserIds = normalizedUserIds.filter(userId => !resolved.has(userId));
  if (missingUserIds.length > 0 && options.fetchUserInfos) {
    const fetchedUsers = await options.fetchUserInfos({
      userIds: missingUserIds,
    });
    for (const item of fetchedUsers) {
      resolved.set(item.userId, toContactUserInfoFromProfile(item));
    }
  }

  for (const userId of normalizedUserIds) {
    if (!resolved.has(userId)) {
      resolved.set(userId, buildMinimalContactUserInfo(userId));
    }
  }

  return resolved;
};

export const enrichContactsWithResolvedUserInfo = async (
  contacts: ReadonlyArray<Contact>,
  options: ContactUserInfoResolverOptions
): Promise<ReadonlyArray<Contact>> => {
  const userInfoMap = await resolveContactUserInfoMap(
    contacts.map(contact => contact.userId),
    options
  );

  return contacts.map(contact => ({
    ...contact,
    userInfo: mergeContactUserInfo(
      contact.userInfo,
      userInfoMap.get(contact.userId),
      contact.userId
    ),
  }));
};

export const resolveSingleContactUserInfo = async (
  userId: string,
  options: ContactUserInfoResolverOptions
): Promise<UserInfo> => {
  const userInfoMap = await resolveContactUserInfoMap([userId], options);
  return mergeContactUserInfo(undefined, userInfoMap.get(userId), userId);
};
