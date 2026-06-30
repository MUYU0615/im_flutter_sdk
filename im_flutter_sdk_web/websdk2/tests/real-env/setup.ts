/**
 * 真实环境 API 测试共享工具。
 * 凭证从 .env 或 process.env 加载，通过 REAL_ENV_ENABLE=1 启用。
 */
// @vitest-environment node
import { describe } from 'vitest';
import {
  resolveRealEnvConfig,
  getMissingRealEnvKeys,
  type RealEnvConfig,
} from '../test-utils/layered/real-env-runner';

export type { RealEnvConfig };

const config = resolveRealEnvConfig();
const strictGate =
  process.env.REAL_ENV_GATE_STRICT === '1' || process.env.LAYERED_GATE_STRICT === '1';
const explicitRun = process.env.REAL_ENV_ENABLE === '1' || strictGate;
const canRun = Boolean(config) && explicitRun;

/** 条件 describe：无凭证或未启用时自动 skip */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const describeRealEnv: any = canRun ? describe : describe.skip;

/** 获取已解析的凭证配置，测试内部使用 */
export const getRealEnvConfig = (): RealEnvConfig => {
  if (!config) {
    throw new Error(
      `真实环境配置缺失，缺少: ${getMissingRealEnvKeys().join(', ')}`
    );
  }
  return config;
};
