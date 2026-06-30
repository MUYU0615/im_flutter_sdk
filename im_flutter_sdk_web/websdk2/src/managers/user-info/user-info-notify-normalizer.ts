import type {
  UserInfo,
  UserInfoNotifyPatch,
  UserInfoRawNotifyEvent,
} from '../../types/user-info';

const normalizeMetadataValue = (
  key: string,
  value: unknown
): Partial<UserInfo> | null => {
  switch (key) {
    case 'nickname':
      return typeof value === 'string' ? { nickname: value } : null;
    case 'avatarurl':
    case 'avatarUrl':
      return typeof value === 'string' ? { avatarUrl: value } : null;
    case 'mail':
      return typeof value === 'string' ? { mail: value } : null;
    case 'phone':
      return typeof value === 'string' ? { phone: value } : null;
    case 'gender':
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? { gender: value }
        : null;
    case 'sign':
      return typeof value === 'string' ? { sign: value } : null;
    case 'birth':
      return typeof value === 'string' ? { birth: value } : null;
    case 'ext':
      return typeof value === 'string' ? { ext: value } : null;
    default:
      return null;
  }
};

export const normalizeUserInfoNotify = (
  event: UserInfoRawNotifyEvent
): UserInfoNotifyPatch | null => {
  const attributes: Partial<UserInfo> = {};
  for (const [key, value] of Object.entries(event.metadata)) {
    const normalized = normalizeMetadataValue(key, value);
    if (!normalized) {
      continue;
    }
    Object.assign(attributes, normalized);
  }

  return {
    userId: event.userId,
    attributes,
    lastModified: event.lastModified,
    source:
      event.notifyType === 'subscribe_metadata_updated'
        ? 'subscription'
        : event.notifyType === 'contact_metadata_updated'
          ? 'contact'
          : 'own',
  };
};
