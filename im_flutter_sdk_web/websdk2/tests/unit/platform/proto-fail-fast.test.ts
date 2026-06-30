import { describe, expect, it } from 'vitest';

import {
  PLATFORM_ERROR_CODE,
  RUNTIME_PLATFORMS,
  createPlatformAdapter,
  createStaticProtoAdapter,
} from '../../../src/platform';

describe('platform/proto-fail-fast', () => {
  it('关键编解码能力缺失时初始化立即失败', () => {
    expect(() => {
      createPlatformAdapter({
        prefer: RUNTIME_PLATFORMS.WEB,
        overrides: {
          proto: undefined,
        },
      });
    }).toThrowError(/required capabilities/i);

    try {
      createPlatformAdapter({
        prefer: RUNTIME_PLATFORMS.WEB,
        overrides: {
          proto: undefined,
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        expect((error as { code?: string }).code).toBe(PLATFORM_ERROR_CODE.MISSING_CAPABILITY);
      }
    }
  });

  it('静态 protobuf 编解码初始化后遇到非法类型会 fail-fast', () => {
    const adapter = createStaticProtoAdapter();

    expect(() => {
      adapter.encode('easemob.pb.NotExistsType', {
        hello: 'world',
      });
    }).toThrowError(/proto/i);

    try {
      adapter.decode<Record<string, unknown>>('easemob.pb.NotExistsType', new Uint8Array());
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        expect((error as { code?: string }).code).toBe(PLATFORM_ERROR_CODE.PROTO_FAILED);
      }
    }
  });
});
