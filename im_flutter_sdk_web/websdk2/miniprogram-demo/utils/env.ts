export type MiniAppChannelType = 'single' | 'group' | 'room';
export type MiniAppMessageType =
  | 'text'
  | 'image'
  | 'voice'
  | 'video'
  | 'file'
  | 'location'
  | 'cmd'
  | 'custom';

export interface MiniAppInitForm {
  readonly appKey: string;
  readonly restApiUrl: string;
  readonly wsUrl: string;
}

export interface MiniAppLoginForm {
  readonly userId: string;
  readonly token: string;
}

export const DEFAULT_INIT_FORM: MiniAppInitForm = {
  appKey: '',
  restApiUrl: 'https://a1-hsb.easemob.com',
  wsUrl: 'wss://im-api-new-hsb.easemob.com/websocket',
};

export const DEFAULT_LOGIN_FORM: MiniAppLoginForm = {
  userId: '',
  token: '',
};

export const MESSAGE_TYPE_OPTIONS: ReadonlyArray<MiniAppMessageType> = [
  'text',
  'image',
  'voice',
  'video',
  'file',
  'location',
  'cmd',
  'custom',
];

export const CHANNEL_TYPE_OPTIONS: ReadonlyArray<MiniAppChannelType> = ['single', 'group', 'room'];
