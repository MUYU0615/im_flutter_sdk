// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_CWD = process.cwd();
const REAL_ENV_KEYS = [
  'EASEMOB_APPKEY',
  'EASEMOB_USERID',
  'EASEMOB_TOKEN',
  'EASEMOB_TARGET_ID',
  'EASEMOB_EXPECT_INBOUND',
  'EASEMOB_REST_URL',
  'EASEMOB_WS_URL',
  'EASEMOB_REST_API_URL',
  'EASEMOB_PASSWORD',
  'EASEMOB_SECOND_USERID',
  'EASEMOB_SECOND_TOKEN',
  'EASEMOB_SECOND_PASSWORD',
  'EASEMOB_THIRD_USERID',
  'EASEMOB_THIRD_TOKEN',
  'EASEMOB_THIRD_PASSWORD',
  'EASEMOB_GROUP_ID',
  'EASEMOB_CHATROOM_ID',
] as const;

type RealEnvModule = typeof import('../../test-utils/layered/real-env-runner');

const clearRealEnv = (): void => {
  for (const key of REAL_ENV_KEYS) {
    delete process.env[key];
  }
};

const loadRealEnvModule = async (): Promise<RealEnvModule> => {
  return import('../../test-utils/layered/real-env-runner');
};

describe('real-env-runner diagnostics', () => {
  let tempDir = '';

  beforeEach(() => {
    vi.resetModules();
    clearRealEnv();
    tempDir = mkdtempSync(join(tmpdir(), 'real-env-runner-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    rmSync(tempDir, { recursive: true, force: true });
    clearRealEnv();
    vi.resetModules();
  });

  it('应标记 process.env 提供的变量来源与长度', async () => {
    process.env.EASEMOB_APPKEY = 'org#app';
    process.env.EASEMOB_USERID = 'alice';
    process.env.EASEMOB_TOKEN = 'token-1234';

    const { describeRealEnvConfigRedacted, resolveRealEnvConfig } = await loadRealEnvModule();

    expect(resolveRealEnvConfig()).toEqual({
      appKey: 'org#app',
      userId: 'alice',
      token: 'token-1234',
      targetId: null,
      expectInbound: false,
      secondUserId: null,
      secondToken: null,
      groupId: null,
      restUrl: 'https://a1.easemob.com',
      wsUrl: null,
      restApiUrl: null,
      password: null,
      secondPassword: null,
      thirdUserId: null,
      thirdToken: null,
      thirdPassword: null,
      chatroomId: null,
    });
    expect(describeRealEnvConfigRedacted()).toBe(
      '.env=missing; EASEMOB_APPKEY={present:yes,length:7,source:process.env}; EASEMOB_USERID={present:yes,length:5,source:process.env}; EASEMOB_TOKEN={present:yes,length:10,source:process.env}; EASEMOB_TARGET_ID={present:no,length:0,source:missing}; EASEMOB_REST_URL={present:no,length:0,source:missing}; EASEMOB_WS_URL={present:no,length:0,source:missing}; EASEMOB_REST_API_URL={present:no,length:0,source:missing}; EASEMOB_PASSWORD={present:no,length:0,source:missing}; EASEMOB_SECOND_USERID={present:no,length:0,source:missing}; EASEMOB_SECOND_TOKEN={present:no,length:0,source:missing}; EASEMOB_SECOND_PASSWORD={present:no,length:0,source:missing}; EASEMOB_THIRD_USERID={present:no,length:0,source:missing}; EASEMOB_THIRD_TOKEN={present:no,length:0,source:missing}; EASEMOB_THIRD_PASSWORD={present:no,length:0,source:missing}; EASEMOB_GROUP_ID={present:no,length:0,source:missing}; EASEMOB_CHATROOM_ID={present:no,length:0,source:missing}'
    );
  });

  it('应标记 .env 回填的变量来源与长度', async () => {
    writeFileSync(
      join(tempDir, '.env'),
      [
        'EASEMOB_APPKEY=org#app-from-dotenv',
        'EASEMOB_USERID=bob',
        'EASEMOB_TOKEN=dotenv-token',
        'EASEMOB_TARGET_ID=target-user',
      ].join('\n')
    );

    const { describeRealEnvConfigRedacted, resolveRealEnvConfig } = await loadRealEnvModule();

    expect(resolveRealEnvConfig()).toEqual({
      appKey: 'org#app-from-dotenv',
      userId: 'bob',
      token: 'dotenv-token',
      targetId: 'target-user',
      expectInbound: false,
      secondUserId: null,
      secondToken: null,
      groupId: null,
      restUrl: 'https://a1.easemob.com',
      wsUrl: null,
      restApiUrl: null,
      password: null,
      secondPassword: null,
      thirdUserId: null,
      thirdToken: null,
      thirdPassword: null,
      chatroomId: null,
    });
    expect(describeRealEnvConfigRedacted()).toBe(
      '.env=present; EASEMOB_APPKEY={present:yes,length:19,source:.env}; EASEMOB_USERID={present:yes,length:3,source:.env}; EASEMOB_TOKEN={present:yes,length:12,source:.env}; EASEMOB_TARGET_ID={present:yes,length:11,source:.env}; EASEMOB_REST_URL={present:no,length:0,source:missing}; EASEMOB_WS_URL={present:no,length:0,source:missing}; EASEMOB_REST_API_URL={present:no,length:0,source:missing}; EASEMOB_PASSWORD={present:no,length:0,source:missing}; EASEMOB_SECOND_USERID={present:no,length:0,source:missing}; EASEMOB_SECOND_TOKEN={present:no,length:0,source:missing}; EASEMOB_SECOND_PASSWORD={present:no,length:0,source:missing}; EASEMOB_THIRD_USERID={present:no,length:0,source:missing}; EASEMOB_THIRD_TOKEN={present:no,length:0,source:missing}; EASEMOB_THIRD_PASSWORD={present:no,length:0,source:missing}; EASEMOB_GROUP_ID={present:no,length:0,source:missing}; EASEMOB_CHATROOM_ID={present:no,length:0,source:missing}'
    );
  });
});
