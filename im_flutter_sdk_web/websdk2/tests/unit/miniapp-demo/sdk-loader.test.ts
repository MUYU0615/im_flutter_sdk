import { describe, expect, it, vi } from 'vitest';

import {
  DIST_SDK_ENTRY,
  MINI_PROGRAM_SDK_MODE,
  getMiniProgramSdkMode,
  loadSdkModule,
  type MiniProgramSdkModule,
} from '../../../miniprogram-demo/utils/sdk-loader';
import { RUNTIME_PLATFORMS } from '../../../src/platform';

describe('miniapp-demo/sdk-loader', () => {
  it('支持注入自定义 loader', async () => {
    const module = {
      ChatClient: {
        init: vi.fn(),
      },
      RUNTIME_PLATFORMS,
    } as unknown as MiniProgramSdkModule;
    const loader = vi.fn(async () => module);

    const loaded = await loadSdkModule(loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(loaded).toBe(module);
  });

  it('暴露 dist 模式标识', () => {
    expect(DIST_SDK_ENTRY).toBe('../../dist/index.js');
    expect(MINI_PROGRAM_SDK_MODE).toBe('dist');
    expect(getMiniProgramSdkMode()).toBe('dist');
  });
});
