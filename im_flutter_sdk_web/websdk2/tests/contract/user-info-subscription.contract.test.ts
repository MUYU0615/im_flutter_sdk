import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/033-user-info-subscription/contracts/user-info-subscription.openapi.yaml'
);

describe('user-info-subscription contract', () => {
  it('应包含三项订阅 API 与真实上游映射', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('openapi: 3.0.3');
    expect(content).toContain('/sdk/user-info/subscriptions:');
    expect(content).toContain('operationId: subscribeUsersInfo');
    expect(content).toContain('operationId: unsubscribeUsersInfo');
    expect(content).toContain('operationId: getSubscribedUsers');
    expect(content).toContain('requestBodyField: usernames');
    expect(content).toContain('requestQueryParam: usernames');
  });

  it('应固化真实 success envelope 与 hydrate 语义', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('SubscribeUsersInfoResponseEnvelope');
    expect(content).toContain('UnsubscribeUsersInfoResponseEnvelope');
    expect(content).toContain('GetSubscribedUsersResponseEnvelope');
    expect(content).toContain('x-sample-status: confirmed-real-sample');
    expect(content).toContain('applicationName:');
    expect(content).toContain('upstream 查询订阅列表成功的真实 response envelope；`data` 为用户名数组。');
  });
});
