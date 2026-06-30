import type { DemoFixedServerPreset } from './types';

export const DEMO_FIXED_SERVER_PRESETS: ReadonlyArray<DemoFixedServerPreset> = [
  {
    id: 'hsb-chatdemoui',
    label: 'HSB / chatdemoui',
    appKey: 'easemob-demo#chatdemoui',
    restApiUrl: 'https://a1-hsb.easemob.com',
    wsUrl: 'wss://im-api-new-hsb.easemob.com/websocket',
    syncWsUrl: 'ws://140.143.132.6:8086',
  },
  {
    id: 'tke-session-sync-prod',
    label: 'TKE / session-sync-prod',
    appKey: 'easemob-demo#session-sync-prod',
    restApiUrl: 'https://tke-sdb-a1.easemob.com',
    wsUrl: 'wss://tke-sdb-im-api-wechat.easemob.com/websocket',
    syncWsUrl: 'wss://tke-sdb-fusion.easemob.com/ws',
  },
];

export const DEFAULT_FIXED_SERVER_PRESET_ID = DEMO_FIXED_SERVER_PRESETS[0]?.id ?? 'custom';

export const findFixedServerPresetById = (
  presetId: string
): DemoFixedServerPreset | undefined => {
  return DEMO_FIXED_SERVER_PRESETS.find(item => item.id === presetId);
};

export const matchFixedServerPreset = (options: {
  readonly appKey?: string;
  readonly restApiUrl?: string;
  readonly wsUrl?: string;
  readonly syncWsUrl?: string;
}): DemoFixedServerPreset | undefined => {
  const appKey = options.appKey?.trim() ?? '';
  const restApiUrl = options.restApiUrl?.trim() ?? '';
  const wsUrl = options.wsUrl?.trim() ?? '';
  const syncWsUrl = options.syncWsUrl?.trim() ?? '';
  return DEMO_FIXED_SERVER_PRESETS.find(item => {
    return (
      item.appKey === appKey &&
      item.restApiUrl === restApiUrl &&
      item.wsUrl === wsUrl &&
      item.syncWsUrl === syncWsUrl
    );
  });
};
