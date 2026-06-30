import { describe, expect, it } from 'vitest';

import { createStaticProtoAdapter, getStaticProtoRoot } from '../../../src/platform';

describe('protocol/protobuf-static-compat', () => {
  it('静态 protobuf 适配器可完成 JID 编解码', () => {
    const adapter = createStaticProtoAdapter();
    const samplePayload = {
      appKey: 'demo#app',
      name: 'user-1',
      domain: 'easemob.com',
      clientResource: 'device-1',
    };

    const encoded = adapter.encode('easemob.pb.JID', samplePayload);
    const decoded = adapter.decode<Record<string, unknown>>('easemob.pb.JID', encoded);

    expect(decoded).toMatchObject(samplePayload);
  });

  it('静态 protobuf 适配器与 root 解码结果一致', () => {
    const adapter = createStaticProtoAdapter();
    const samplePayload = {
      key: 'lang',
      type: 7,
      stringValue: 'zh-CN',
    };

    const encoded = adapter.encode('easemob.pb.KeyValue', samplePayload);
    const decodedByAdapter = adapter.decode<Record<string, unknown>>(
      'easemob.pb.KeyValue',
      encoded
    );

    const root = getStaticProtoRoot();
    const type = root.lookupType('easemob.pb.KeyValue');
    const decodedByRoot = type.toObject(type.decode(encoded), {
      longs: String,
      enums: Number,
      defaults: false,
    }) as Record<string, unknown>;

    expect(decodedByAdapter).toEqual(decodedByRoot);
  });
});
