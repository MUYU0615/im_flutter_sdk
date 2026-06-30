import type {
  ChatConversationType,
  CreateCmdMessageParams,
  CreateCustomMessageParams,
  CreateFileMessageParams,
  CreateImageMessageParams,
  CreateLocationMessageParams,
  CreateTextMessageParams,
  CreateVideoMessageParams,
  CreateVoiceMessageParams,
  MiniAppFile,
} from '../../src/types';
import type { MiniAppChannelType } from './env';

export interface MiniAppAttachmentSelection {
  readonly path: string;
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly duration?: number;
  readonly width?: number;
  readonly height?: number;
}

export interface MiniAppDraftState {
  readonly channelType: MiniAppChannelType;
  readonly targetId: string;
  readonly textMessage: string;
  readonly imageSelection: MiniAppAttachmentSelection | null;
  readonly imageSendOriginal: boolean;
  readonly voiceSelection: MiniAppAttachmentSelection | null;
  readonly voiceDuration: string;
  readonly videoSelection: MiniAppAttachmentSelection | null;
  readonly fileSelection: MiniAppAttachmentSelection | null;
  readonly locationLatitude: string;
  readonly locationLongitude: string;
  readonly locationAddress: string;
  readonly locationBuildingName: string;
  readonly cmdAction: string;
  readonly customEvent: string;
  readonly customParamsJson: string;
}

export const DEFAULT_DRAFT_STATE: MiniAppDraftState = {
  channelType: 'single',
  targetId: '',
  textMessage: '',
  imageSelection: null,
  imageSendOriginal: false,
  voiceSelection: null,
  voiceDuration: '',
  videoSelection: null,
  fileSelection: null,
  locationLatitude: '',
  locationLongitude: '',
  locationAddress: '',
  locationBuildingName: '',
  cmdAction: '',
  customEvent: '',
  customParamsJson: '',
};

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  aac: 'audio/aac',
  amr: 'audio/amr',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  txt: 'text/plain',
};

const requireText = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`请输入${label}`);
  }
  return trimmed;
};

const parseRequiredNumber = (value: string, label: string): number => {
  const trimmed = requireText(value, label);
  const numberValue = Number(trimmed);
  if (Number.isNaN(numberValue)) {
    throw new Error(`${label}格式不正确`);
  }
  return numberValue;
};

const parseOptionalStringMap = (
  jsonText: string,
  label: string
): Record<string, string> | undefined => {
  const trimmed = jsonText.trim();
  if (!trimmed) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${label}必须是合法 JSON`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label}必须是对象`);
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  return Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
};

const inferMimeTypeFromName = (name: string): string => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0) {
    return 'application/octet-stream';
  }
  const extension = name.slice(dotIndex + 1).toLowerCase();
  return MIME_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
};

const toConversationType = (channelType: MiniAppChannelType): ChatConversationType => {
  if (channelType === 'group') {
    return 'groupChat';
  }
  if (channelType === 'room') {
    return 'chatRoom';
  }
  return 'singleChat';
};

export const buildConversationLocator = (
  targetId: string,
  channelType: MiniAppChannelType
): Pick<CreateTextMessageParams, 'conversationId' | 'conversationType'> => {
  return {
    conversationId: requireText(targetId, '目标 ID'),
    conversationType: toConversationType(channelType),
  };
};

export const toMiniAppFile = (selection: MiniAppAttachmentSelection): MiniAppFile => {
  return {
    path: selection.path,
    name: selection.name,
    type: selection.type,
    size: selection.size,
  };
};

export const normalizeSelection = (selection: {
  path: string;
  name?: string;
  type?: string;
  size?: number;
  duration?: number;
  width?: number;
  height?: number;
}): MiniAppAttachmentSelection => {
  const name = selection.name?.trim() || selection.path.split('/').pop() || 'file';
  const type = selection.type?.trim() || inferMimeTypeFromName(name);
  return {
    path: selection.path,
    name,
    type,
    size: selection.size ?? 0,
    duration: selection.duration,
    width: selection.width,
    height: selection.height,
  };
};

export const buildTextDraft = (draft: MiniAppDraftState): CreateTextMessageParams => {
  return {
    ...buildConversationLocator(draft.targetId, draft.channelType),
    content: requireText(draft.textMessage, '文本内容'),
  };
};

export const buildImageDraft = (draft: MiniAppDraftState): CreateImageMessageParams => {
  const selection = draft.imageSelection;
  if (!selection) {
    throw new Error('请选择图片');
  }
  return {
    ...buildConversationLocator(draft.targetId, draft.channelType),
    filename: selection.name,
    filetype: selection.type,
    width: selection.width ?? 0,
    height: selection.height ?? 0,
    isGif: selection.type === 'image/gif',
    isOriginalImage: draft.imageSendOriginal || undefined,
    data: toMiniAppFile(selection),
  };
};

export const buildVoiceDraft = (draft: MiniAppDraftState): CreateVoiceMessageParams => {
  const selection = draft.voiceSelection;
  if (!selection) {
    throw new Error('请选择语音文件');
  }
  return {
    ...buildConversationLocator(draft.targetId, draft.channelType),
    filename: selection.name,
    filetype: selection.type,
    duration: selection.duration ?? parseRequiredNumber(draft.voiceDuration, '语音时长'),
    data: toMiniAppFile(selection),
  };
};

export const buildVideoDraft = (draft: MiniAppDraftState): CreateVideoMessageParams => {
  const selection = draft.videoSelection;
  if (!selection) {
    throw new Error('请选择视频');
  }
  return {
    ...buildConversationLocator(draft.targetId, draft.channelType),
    filename: selection.name,
    filetype: selection.type,
    duration: selection.duration ?? 0,
    width: selection.width,
    height: selection.height,
    data: toMiniAppFile(selection),
  };
};

export const buildFileDraft = (draft: MiniAppDraftState): CreateFileMessageParams => {
  const selection = draft.fileSelection;
  if (!selection) {
    throw new Error('请选择文件');
  }
  return {
    ...buildConversationLocator(draft.targetId, draft.channelType),
    filename: selection.name,
    filetype: selection.type,
    fileSize: selection.size,
    data: toMiniAppFile(selection),
  };
};

export const buildLocationDraft = (draft: MiniAppDraftState): CreateLocationMessageParams => {
  return {
    ...buildConversationLocator(draft.targetId, draft.channelType),
    latitude: parseRequiredNumber(draft.locationLatitude, '纬度'),
    longitude: parseRequiredNumber(draft.locationLongitude, '经度'),
    address: draft.locationAddress.trim() || undefined,
    buildingName: draft.locationBuildingName.trim() || undefined,
  };
};

export const buildCmdDraft = (draft: MiniAppDraftState): CreateCmdMessageParams => {
  return {
    ...buildConversationLocator(draft.targetId, draft.channelType),
    action: requireText(draft.cmdAction, '命令动作'),
  };
};

export const buildCustomDraft = (draft: MiniAppDraftState): CreateCustomMessageParams => {
  return {
    ...buildConversationLocator(draft.targetId, draft.channelType),
    event: requireText(draft.customEvent, '自定义事件'),
    params: parseOptionalStringMap(draft.customParamsJson, '自定义参数'),
  };
};
