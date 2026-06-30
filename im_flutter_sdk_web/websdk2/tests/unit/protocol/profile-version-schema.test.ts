import { describe, expect, it } from 'vitest';

import { getMsyncRoot } from '@/protocol/msync/root';

describe('MessageBody profile version schema', () => {
  it('userInfoUpdateTime 与 namecardUpdateTime 应声明为 int32', async () => {
    const root = await getMsyncRoot();
    const messageBodyType = root.lookupType('easemob.pb.MessageBody');

    expect(messageBodyType.fields.userInfoUpdateTime?.type).toBe('int32');
    expect(messageBodyType.fields.namecardUpdateTime?.type).toBe('int32');
  });
});
