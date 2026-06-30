import type { Message } from '../../../types';

export interface MessageProfileVersionSidecar {
  readonly userInfoUpdateTime?: number;
  readonly namecardUpdateTime?: number;
}

const messageProfileVersionMap = new WeakMap<Message, MessageProfileVersionSidecar>();

export const setMessageProfileVersionSidecar = (
  message: Message,
  sidecar: MessageProfileVersionSidecar
): void => {
  messageProfileVersionMap.set(message, sidecar);
};

export const getMessageProfileVersionSidecar = (
  message: Message
): MessageProfileVersionSidecar | null => {
  return messageProfileVersionMap.get(message) ?? null;
};

export const clearMessageProfileVersionSidecar = (message: Message): void => {
  messageProfileVersionMap.delete(message);
};

export const copyMessageProfileVersionSidecar = (source: Message, target: Message): void => {
  const sidecar = getMessageProfileVersionSidecar(source);
  if (!sidecar) {
    return;
  }
  setMessageProfileVersionSidecar(target, sidecar);
};
