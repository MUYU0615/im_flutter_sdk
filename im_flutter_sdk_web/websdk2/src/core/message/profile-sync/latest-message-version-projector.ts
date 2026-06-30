import type { MessageSnippet } from '../../../cache/cache-types';
import type { Message } from '../../../types';
import { getMessageProfileVersionSidecar } from './profile-version-sidecar';

export const projectLatestMessageVersions = (
  message: Message
): Pick<MessageSnippet, 'userInfoUpdateTime' | 'namecardUpdateTime'> => {
  const sidecar = getMessageProfileVersionSidecar(message);
  return {
    userInfoUpdateTime: sidecar?.userInfoUpdateTime,
    namecardUpdateTime:
      message.conversationType === 'groupChat' ? sidecar?.namecardUpdateTime : undefined,
  };
};
