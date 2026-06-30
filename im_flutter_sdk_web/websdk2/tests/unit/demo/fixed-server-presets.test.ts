import { describe, expect, it } from 'vitest';

import {
  DEMO_FIXED_SERVER_PRESETS,
  findFixedServerPresetById,
  matchFixedServerPreset,
} from '../../../demo/src/fixed-server-presets';

describe('demo fixed server presets', () => {
  it('应包含 hsb 与 tke 预置环境', () => {
    expect(DEMO_FIXED_SERVER_PRESETS.map(item => item.id)).toEqual(
      expect.arrayContaining(['hsb-chatdemoui', 'tke-session-sync-prod'])
    );
  });

  it('应能按固定服务地址匹配 tke session-sync-prod 预置', () => {
    const preset = matchFixedServerPreset({
      appKey: 'easemob-demo#session-sync-prod',
      restApiUrl: 'https://tke-sdb-a1.easemob.com',
      wsUrl: 'wss://tke-sdb-im-api-wechat.easemob.com/websocket',
      syncWsUrl: 'wss://tke-sdb-fusion.easemob.com/ws',
    });

    expect(preset).toEqual(
      expect.objectContaining({
        id: 'tke-session-sync-prod',
        label: 'TKE / session-sync-prod',
      })
    );
    expect(findFixedServerPresetById('hsb-chatdemoui')).toEqual(
      expect.objectContaining({
        appKey: 'easemob-demo#chatdemoui',
      })
    );
  });
});
