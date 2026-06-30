// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CoreSDK } from '@/core';
import { EventHub } from '@/core/events/event-hub';
import { createTextMessage } from '@/message/create-message';
import { resolveDnsConfig } from '@/rest/dns-config';
import {
  isMsyncDecodeRangeError,
  resolveRealEnvConfig,
  getMissingRealEnvKeys,
} from '../../test-utils/layered/real-env-runner';

const config = resolveRealEnvConfig();
const strictGate =
  process.env.REAL_ENV_GATE_STRICT === '1' || process.env.LAYERED_GATE_STRICT === '1';
const explicitRun = process.env.REAL_ENV_ENABLE === '1' || strictGate;
const canRun = Boolean(config) && explicitRun;
const describeReal = canRun ? describe : describe.skip;

if (!canRun && strictGate) {
  describe('真实环境 smoke 凭证检查', () => {
    it('严格模式要求必须具备真实环境凭证', () => {
      const missing = getMissingRealEnvKeys();
      throw new Error(`真实环境门禁缺少环境变量: ${missing.join(', ')}`);
    });
  });
}

describeReal('真实环境 smoke 核心链路', () => {
  it('可以完成连接、鉴权、发送、回执主链路', async () => {
    if (!config) {
      throw new Error('真实环境配置缺失');
    }
    const eventHub = new EventHub();
    let deferredError: Error | null = null;
    const handleUnhandledRejection = (reason: unknown): void => {
      if (isMsyncDecodeRangeError(reason)) {
        return;
      }
      deferredError = reason instanceof Error ? reason : new Error(String(reason));
    };
    process.on('unhandledRejection', handleUnhandledRejection);
    let inboundResolve: (() => void) | null = null;
    const inboundPromise = new Promise<void>(resolve => {
      inboundResolve = resolve;
    });
    eventHub.addEventHandler('real-env-core', {
      onMessage: () => inboundResolve?.(),
    });

    const dnsConfig = await resolveDnsConfig({
      appKey: config.appKey,
      pageProtocol: 'https',
      baseUrls: ['https://rs.easemob.com'],
    });
    const sdk = new CoreSDK(
      {
        serverUrl: dnsConfig.websocketUrl,
        userId: config.userId,
        token: config.token,
        appKey: config.appKey,
        autoReconnectNumMax: 5,
        useFixedDeviceId: true,
        deviceId: '1748226104694',
      },
      eventHub
    );

    try {
      await sdk.connect();
      expect(sdk.getConnectionStatus()).toBe('connected');
      const message = createTextMessage(
        {
          conversationId: config.targetId || config.userId,
          conversationType: 'singleChat',
          content: `real-env-core:${Date.now()}`,
        },
        { userId: config.userId }
      );
      const sent = await sdk.sendMessage(message);
      expect(sent.status).toBe('sent');
      if (config.expectInbound) {
        await Promise.race([
          inboundPromise,
          new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error('等待 onMessage 超时')), 15000);
          }),
        ]);
      }
    } finally {
      process.off('unhandledRejection', handleUnhandledRejection);
      eventHub.removeEventHandler('real-env-core');
      await sdk.disconnect();
    }
    if (deferredError) {
      throw deferredError;
    }
  }, 30000);
});
