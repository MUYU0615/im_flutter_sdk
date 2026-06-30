import type { UserInfoSummary } from '../../cache/cache-types';
import type { UserInfo, UserInfoNotifyPatch } from '../../types/user-info';

export type UserInfoRuntimeSource =
  | 'fetch'
  | 'update'
  | 'subscription_notify'
  | 'contact_notify'
  | 'own_notify';

export interface UserInfoRuntimeRecord {
  readonly profile: UserInfo;
  readonly lastModified: number;
  readonly lastAccess: number;
  readonly source: UserInfoRuntimeSource;
}

export interface UserInfoRuntimeUpsertRecord {
  readonly profile: UserInfo;
  readonly lastModified?: number;
  readonly source: UserInfoRuntimeSource;
}

export interface UserInfoRuntimeMergeResult {
  readonly applied: boolean;
  readonly reason: 'applied' | 'stale' | 'duplicate';
  readonly record: UserInfoRuntimeRecord;
}

const USER_INFO_KEYS: ReadonlyArray<keyof UserInfo> = [
  'userId',
  'nickname',
  'avatarUrl',
  'mail',
  'phone',
  'gender',
  'sign',
  'birth',
  'ext',
];

const isSameProfile = (left: UserInfo, right: UserInfo): boolean => {
  return USER_INFO_KEYS.every(key => left[key] === right[key]);
};

export const buildUserInfoFromSummary = (summary: UserInfoSummary): UserInfo => {
  return {
    userId: summary.userId,
    nickname: summary.nickname,
    avatarUrl: summary.avatarUrl,
    sign: summary.sign,
    ext: summary.ext,
  };
};

export const projectUserInfoToSummary = (record: UserInfoRuntimeRecord): UserInfoSummary => {
  return {
    userId: record.profile.userId,
    nickname: record.profile.nickname,
    avatarUrl: record.profile.avatarUrl,
    sign: record.profile.sign,
    ext: record.profile.ext,
    lastAccess: record.lastAccess,
    lastUpdate: record.lastModified,
  };
};

export class UserInfoRuntimeStore {
  private readonly records = new Map<string, UserInfoRuntimeRecord>();

  public clear(): void {
    this.records.clear();
  }

  public get(userId: string, updateAccess = false, now = Date.now()): UserInfoRuntimeRecord | null {
    const record = this.records.get(userId) ?? null;
    if (!record || !updateAccess) {
      return record;
    }

    const nextRecord = {
      ...record,
      lastAccess: now,
    };
    this.records.set(userId, nextRecord);
    return nextRecord;
  }

  public setAll(records: ReadonlyArray<UserInfoRuntimeUpsertRecord>, now = Date.now()): void {
    for (const item of records) {
      const lastModified = item.lastModified ?? now;
      const existing = this.records.get(item.profile.userId);
      const lastAccess = existing?.lastAccess ?? now;
      this.records.set(item.profile.userId, {
        profile: item.profile,
        lastModified,
        lastAccess,
        source: item.source,
      });
    }
  }

  public applyPatch(
    patch: UserInfoNotifyPatch,
    fallbackProfile?: Partial<UserInfo>,
    now = Date.now()
  ): UserInfoRuntimeMergeResult {
    const existing = this.records.get(patch.userId);
    const baseProfile: UserInfo = {
      userId: patch.userId,
      ...(fallbackProfile ?? {}),
      ...(existing?.profile ?? {}),
    };

    if (existing && patch.lastModified < existing.lastModified) {
      return {
        applied: false,
        reason: 'stale',
        record: existing,
      };
    }

    const nextProfile: UserInfo = {
      ...baseProfile,
      ...patch.attributes,
      userId: patch.userId,
    };

    if (
      existing &&
      patch.lastModified === existing.lastModified &&
      isSameProfile(existing.profile, nextProfile)
    ) {
      return {
        applied: false,
        reason: 'duplicate',
        record: existing,
      };
    }

    const nextRecord: UserInfoRuntimeRecord = {
      profile: nextProfile,
      lastModified: patch.lastModified,
      lastAccess: existing?.lastAccess ?? now,
      source:
        patch.source === 'subscription'
          ? 'subscription_notify'
          : patch.source === 'contact'
            ? 'contact_notify'
            : 'own_notify',
    };
    this.records.set(patch.userId, nextRecord);

    return {
      applied: true,
      reason: 'applied',
      record: nextRecord,
    };
  }
}
