import { describe, expect, it } from 'vitest';

import { buildInitConfig, buildInitSignature, validateInitForm, validateLoginForm } from '../../../miniprogram-demo/utils/session-controller';
import { DEFAULT_INIT_FORM, DEFAULT_LOGIN_FORM } from '../../../miniprogram-demo/utils/env';

describe('miniapp-demo/session-controller', () => {
  it('校验初始化与登录必填项', () => {
    expect(validateInitForm(DEFAULT_INIT_FORM)).toBe('请输入 AppKey');
    expect(validateLoginForm(DEFAULT_LOGIN_FORM)).toBe('请输入用户 ID');
    expect(
      validateInitForm({
        ...DEFAULT_INIT_FORM,
        appKey: 'demo#app',
      })
    ).toBeNull();
    expect(
      validateLoginForm({
        userId: 'alice',
        token: 'token',
      })
    ).toBeNull();
  });

  it('构建初始化签名时会去掉无意义空白', () => {
    const signature = buildInitSignature({
      appKey: ' demo#app ',
      restApiUrl: ' https://rest.example.com ',
      wsUrl: ' wss://ws.example.com ',
    });

    expect(signature).toContain('"appKey":"demo#app"');
    expect(signature).toContain('"restApiUrl":"https://rest.example.com"');
    expect(signature).toContain('"wsUrl":"wss://ws.example.com"');
  });

  it('构建初始化配置时固定使用服务地址与关闭自动联系人同步', () => {
    const config = buildInitConfig({
      appKey: 'demo#app',
      restApiUrl: 'https://rest.example.com',
      wsUrl: 'wss://ws.example.com',
    });

    expect(config.enableSyncData).toEqual([]);
    expect(config.serviceConfig?.serverUrls).toEqual({
      restApiUrl: 'https://rest.example.com',
      wsUrl: 'wss://ws.example.com',
    });
    expect('cacheEncryptionMode' in config).toBe(false);
    expect('platformAdapterOptions' in config).toBe(false);
  });
});
