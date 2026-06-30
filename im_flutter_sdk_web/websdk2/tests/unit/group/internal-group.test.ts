import { describe, expect, it } from 'vitest';

import { InternalGroup } from '@/managers/group/internal/internal-group';

describe('InternalGroup', () => {
  it('应合并 summary/detail 并维护基础状态', () => {
    const group = new InternalGroup('g1');

    group.mergeSummary({
      groupId: 'g1',
      name: 'Group 1',
    });

    expect(group.getSummarySnapshot()).toEqual({
      groupId: 'g1',
      name: 'Group 1',
    });
    expect(group.hasLoadedSummary()).toBe(true);
    expect(group.hasLoadedDetail()).toBe(false);

    group.markStale();
    expect(group.isStale()).toBe(true);

    group.mergeDetail({
      groupId: 'g1',
      name: 'Group 1 Detail',
      description: 'desc',
      owner: {
        userId: 'owner',
      },
    });

    expect(group.hasLoadedDetail()).toBe(true);
    expect(group.isStale()).toBe(false);
    expect(group.getDetailSnapshot()).toEqual({
      groupId: 'g1',
      name: 'Group 1 Detail',
      description: 'desc',
      owner: {
        userId: 'owner',
      },
    });
    expect(group.getSummarySnapshot()).toEqual({
      groupId: 'g1',
      name: 'Group 1 Detail',
      description: 'desc',
      public: undefined,
      joinApprovalRequired: undefined,
      allowInvites: undefined,
      maxMembers: undefined,
      role: undefined,
      disabled: undefined,
      memberCount: undefined,
    });
    expect(group.hasLoadedSummary()).toBe(true);
  });

  it('返回的快照应与内部状态隔离', () => {
    const group = new InternalGroup('g1');

    group.mergeDetail({
      groupId: 'g1',
      name: 'Group 1',
      owner: {
        userId: 'owner',
        nickname: 'Owner',
      },
    });

    const detail = group.getDetailSnapshot();
    if (!detail || !detail.owner) {
      throw new Error('expected detail snapshot');
    }

    (detail as { name: string }).name = 'Mutated';
    (detail.owner as { nickname?: string }).nickname = 'Mutated Owner';

    expect(group.getDetailSnapshot()).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      owner: {
        userId: 'owner',
        nickname: 'Owner',
      },
    });
  });

  it('clear 后应重置 summary/detail 已知状态', () => {
    const group = new InternalGroup('g1');

    group.mergeSummary({
      groupId: 'g1',
      name: 'Group 1',
    });
    group.mergeDetail({
      groupId: 'g1',
      name: 'Group 1 Detail',
    });

    group.clear();

    expect(group.hasLoadedSummary()).toBe(false);
    expect(group.hasLoadedDetail()).toBe(false);
    expect(group.isStale()).toBe(false);
    expect(group.getSummarySnapshot()).toBeNull();
    expect(group.getDetailSnapshot()).toBeNull();
  });
});
