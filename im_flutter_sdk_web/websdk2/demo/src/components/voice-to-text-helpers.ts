import { formatTimestamp } from '../utils';
import type { VoiceMessageSource } from 'im-sdk-web';
import type { MessageRecord } from '../types';

export interface DemoVoiceMessageOption {
  readonly id: string;
  readonly label: string;
  readonly message: VoiceMessageSource;
}

const MAX_RECENT_VOICE_MESSAGES = 10;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

const readNumber = (record: Record<string, unknown>, key: string): number | undefined => {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const getMessageId = (message: MessageRecord): string => {
  return message.msgServerId || message.msgLocalId || `voice-${message.timestamp}`;
};

const toVoiceMessageSource = (message: MessageRecord): VoiceMessageSource | null => {
  if (message.type !== 'voice' || !isRecord(message.body)) {
    return null;
  }
  const filename = readString(message.body, 'filename');
  const filetype = readString(message.body, 'filetype');
  const duration = readNumber(message.body, 'duration');
  const url = readString(message.body, 'url');
  if (!filename || !filetype || duration === undefined || !url) {
    return null;
  }
  const fileLength = readNumber(message.body, 'fileLength');
  const secret = readString(message.body, 'secret');
  return {
    type: 'voice',
    filename,
    filetype,
    duration,
    url,
    ...(fileLength !== undefined ? { fileLength } : {}),
    ...(secret ? { secret } : {}),
  };
};

export const selectRecentVoiceMessages = (
  messages: ReadonlyArray<MessageRecord>,
  limit = MAX_RECENT_VOICE_MESSAGES
): ReadonlyArray<DemoVoiceMessageOption> => {
  return messages
    .map(message => {
      const source = toVoiceMessageSource(message);
      if (!source) {
        return null;
      }
      const sender = message.sender?.userId ?? 'unknown';
      const timestamp = formatTimestamp(message.timestamp);
      const id = getMessageId(message);
      return {
        id,
        label: `${source.filename} | ${sender} | ${timestamp} | ${source.duration}s`,
        message: source,
      } satisfies DemoVoiceMessageOption;
    })
    .filter((item): item is DemoVoiceMessageOption => item !== null)
    .slice(0, Math.max(0, limit));
};
