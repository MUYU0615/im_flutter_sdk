import { describe, expect, it } from 'vitest';

import { InternalGroup } from '@/managers/group/internal/internal-group';
import { GroupSnapshotMapper } from '@/managers/group/internal/group-snapshot-mapper';

describe('GroupSnapshotMapper', () => {
  it('应为内部对象导出隔离的 summary/detail 快照', () => {
    const mapper = new GroupSnapshotMapper();
    const group = new InternalGroup('g1');
    group.mergeDetail({
      groupId: 'g1',
      name: 'Group 1',
      owner: {
        userId: 'owner',
      },
    });

    const summary = mapper.toSummary(group);
    const detail = mapper.toDetail(group);

    expect(summary).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      description: undefined,
      memberCount: undefined,
      public: undefined,
      joinApprovalRequired: undefined,
      allowInvites: undefined,
      maxMembers: undefined,
      role: undefined,
      disabled: undefined,
    });
    expect(detail).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      owner: {
        userId: 'owner',
      },
    });

    if (!detail || !detail.owner || !summary) {
      throw new Error('expected snapshots');
    }
    (detail.owner as { userId: string }).userId = 'mutated';
    (summary as { name: string }).name = 'mutated';

    expect(mapper.toDetail(group)).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      owner: {
        userId: 'owner',
      },
    });
    expect(mapper.toSummary(group)).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      description: undefined,
      memberCount: undefined,
      public: undefined,
      joinApprovalRequired: undefined,
      allowInvites: undefined,
      maxMembers: undefined,
      role: undefined,
      disabled: undefined,
    });
  });
});
