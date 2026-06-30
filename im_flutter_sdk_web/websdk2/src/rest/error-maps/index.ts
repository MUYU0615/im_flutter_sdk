import { COMMON_ERROR_MAP } from './common';
import { CHAT_ERROR_MAP } from './chat';
import { CHATROOM_ERROR_MAP } from './chatroom';
import { CONTACT_ERROR_MAP } from './contact';
import { CORE_ERROR_MAP } from './core';
import { GROUP_ERROR_MAP } from './group';
import { PRESENCE_ERROR_MAP } from './presence';
import { PUSH_ERROR_MAP } from './push';
import { THREAD_ERROR_MAP } from './thread';
import { USER_INFO_ERROR_MAP } from './user-info';
import { mergeRuntimeErrorMaps } from '../error-map-types';

export const CORE_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, CORE_ERROR_MAP);
export const CHAT_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, CHAT_ERROR_MAP);
export const CONTACT_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, CONTACT_ERROR_MAP);
export const GROUP_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, GROUP_ERROR_MAP);
export const CHATROOM_REST_ERROR_MAP = mergeRuntimeErrorMaps(
  COMMON_ERROR_MAP,
  CHATROOM_ERROR_MAP
);
export const PRESENCE_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, PRESENCE_ERROR_MAP);
export const PUSH_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, PUSH_ERROR_MAP);
export const USER_INFO_REST_ERROR_MAP = mergeRuntimeErrorMaps(
  COMMON_ERROR_MAP,
  USER_INFO_ERROR_MAP
);
export const THREAD_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, THREAD_ERROR_MAP);
