import { describe, expect, it } from 'vitest';

import { buildInitConfig } from '../../../miniprogram-demo/utils/session-controller';
import { DEFAULT_INIT_FORM } from '../../../miniprogram-demo/utils/env';

describe('miniapp-demo/init-config', () => {
  it('只暴露固定服务地址初始化所需字段', () => {
    const config = buildInitConfig({
      ...DEFAULT_INIT_FORM,
      appKey: 'demo#app',
    });

    expect(config.enableSyncData).toEqual([]);
    expect(config.serviceConfig?.dnsConfigUrls).toBeUndefined();
    expect(config.serviceConfig?.serverUrls?.restApiUrl).toBe(DEFAULT_INIT_FORM.restApiUrl);
    expect(config.serviceConfig?.serverUrls?.wsUrl).toBe(DEFAULT_INIT_FORM.wsUrl);
    expect('platformAdapterOptions' in config).toBe(false);
  });
});
