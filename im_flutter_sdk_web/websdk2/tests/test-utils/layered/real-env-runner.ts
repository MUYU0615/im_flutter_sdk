import { existsSync, readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

export interface RealEnvConfig {
  readonly appKey: string;
  readonly userId: string;
  readonly token: string;
  readonly targetId: string | null;
  readonly expectInbound: boolean;
  readonly secondUserId: string | null;
  readonly secondToken: string | null;
  readonly groupId: string | null;
  readonly restUrl: string;
  readonly wsUrl: string | null;
  readonly restApiUrl: string | null;
  readonly password: string | null;
  readonly secondPassword: string | null;
  readonly thirdUserId: string | null;
  readonly thirdToken: string | null;
  readonly thirdPassword: string | null;
  readonly chatroomId: string | null;
}

const REQUIRED_ENV_KEYS = ['EASEMOB_APPKEY', 'EASEMOB_USERID', 'EASEMOB_TOKEN'] as const;
const OPTIONAL_ENV_KEYS = [
  'EASEMOB_TARGET_ID',
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
const REAL_ENV_KEYS = [...REQUIRED_ENV_KEYS, ...OPTIONAL_ENV_KEYS] as const;

type RealEnvKey = (typeof REAL_ENV_KEYS)[number];
type RealEnvValueSource = 'process.env' | '.env' | 'missing';

interface RealEnvFieldDiagnostic {
  readonly present: boolean;
  readonly length: number;
  readonly source: RealEnvValueSource;
}

interface LoadedDotEnvState {
  readonly envPathExists: boolean;
  readonly valueSources: Readonly<Record<RealEnvKey, RealEnvValueSource>>;
}

let loadedDotEnvState: LoadedDotEnvState | null = null;

const parseDotEnv = (
  envPath: string
): { exists: boolean; values: Partial<Record<string, string>> } => {
  if (!existsSync(envPath)) {
    return { exists: false, values: {} };
  }

  const raw = readFileSync(envPath, 'utf8');
  const values: Partial<Record<string, string>> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const [key, ...rest] = trimmed.split('=');
    if (!key || rest.length === 0) {
      continue;
    }
    values[key] = rest
      .join('=')
      .trim()
      .replace(/^"(.*)"$/, '$1');
  }
  return { exists: true, values };
};

const loadDotEnv = (): LoadedDotEnvState => {
  if (loadedDotEnvState) {
    return loadedDotEnvState;
  }

  const envPath = resolvePath(process.cwd(), '.env');
  const parsed = parseDotEnv(envPath);
  const valueSources = {} as Record<RealEnvKey, RealEnvValueSource>;

  for (const key of REAL_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      valueSources[key] = 'process.env';
      continue;
    }

    const dotenvValue = parsed.values[key];
    if (dotenvValue !== undefined) {
      process.env[key] = dotenvValue;
      valueSources[key] = '.env';
      continue;
    }

    valueSources[key] = 'missing';
  }

  loadedDotEnvState = {
    envPathExists: parsed.exists,
    valueSources,
  };
  return loadedDotEnvState;
};

export const getMissingRealEnvKeys = (): ReadonlyArray<string> => {
  loadDotEnv();
  return REQUIRED_ENV_KEYS.filter(key => !(process.env[key] ?? '').trim());
};

const buildFieldDiagnostic = (key: RealEnvKey): RealEnvFieldDiagnostic => {
  const state = loadDotEnv();
  const value = (process.env[key] ?? '').trim();
  return {
    present: value.length > 0,
    length: value.length,
    source: state.valueSources[key],
  };
};

export const describeRealEnvConfigRedacted = (): string => {
  const state = loadDotEnv();
  const fieldSummaries = REAL_ENV_KEYS.map(key => {
    const diagnostic = buildFieldDiagnostic(key);
    return `${key}={present:${diagnostic.present ? 'yes' : 'no'},length:${diagnostic.length},source:${diagnostic.source}}`;
  });

  return [
    `.env=${state.envPathExists ? 'present' : 'missing'}`,
    ...fieldSummaries,
  ].join('; ');
};

export const resolveRealEnvConfig = (): RealEnvConfig | null => {
  const missing = getMissingRealEnvKeys();
  if (missing.length > 0) {
    return null;
  }
  const appKey = (process.env.EASEMOB_APPKEY ?? '').trim();
  const userId = (process.env.EASEMOB_USERID ?? '').trim();
  const token = (process.env.EASEMOB_TOKEN ?? '').trim();
  const targetIdRaw = (process.env.EASEMOB_TARGET_ID ?? '').trim();
  const expectInbound = process.env.EASEMOB_EXPECT_INBOUND === '1';
  const secondUserIdRaw = (process.env.EASEMOB_SECOND_USERID ?? '').trim();
  const secondTokenRaw = (process.env.EASEMOB_SECOND_TOKEN ?? '').trim();
  const groupIdRaw = (process.env.EASEMOB_GROUP_ID ?? '').trim();
  const restUrlRaw = (process.env.EASEMOB_REST_URL ?? '').trim();
  const wsUrlRaw = (process.env.EASEMOB_WS_URL ?? '').trim();
  const restApiUrlRaw = (process.env.EASEMOB_REST_API_URL ?? '').trim();
  const passwordRaw = (process.env.EASEMOB_PASSWORD ?? '').trim();
  const secondPasswordRaw = (process.env.EASEMOB_SECOND_PASSWORD ?? '').trim();
  const thirdUserIdRaw = (process.env.EASEMOB_THIRD_USERID ?? '').trim();
  const thirdTokenRaw = (process.env.EASEMOB_THIRD_TOKEN ?? '').trim();
  const thirdPasswordRaw = (process.env.EASEMOB_THIRD_PASSWORD ?? '').trim();
  const chatroomIdRaw = (process.env.EASEMOB_CHATROOM_ID ?? '').trim();
  return {
    appKey,
    userId,
    token,
    targetId: targetIdRaw || null,
    expectInbound,
    secondUserId: secondUserIdRaw || null,
    secondToken: secondTokenRaw || null,
    groupId: groupIdRaw || null,
    restUrl: restUrlRaw || 'https://a1.easemob.com',
    wsUrl: wsUrlRaw || null,
    restApiUrl: restApiUrlRaw || null,
    password: passwordRaw || null,
    secondPassword: secondPasswordRaw || null,
    thirdUserId: thirdUserIdRaw || null,
    thirdToken: thirdTokenRaw || null,
    thirdPassword: thirdPasswordRaw || null,
    chatroomId: chatroomIdRaw || null,
  };
};

export const isMsyncDecodeRangeError = (reason: unknown): boolean => {
  if (!(reason instanceof RangeError)) {
    return false;
  }
  return reason.message.includes('index out of range');
};
