import { describe, expect, it } from 'vitest';

import { GroupRepository } from '@/managers/group/internal/group-repository';

describe('GroupRepository', () => {
  it('同一 groupId 应返回同一个内部运行时对象', () => {
    const repository = new GroupRepository();

    const first = repository.getOrCreate('g1');
    const second = repository.getOrCreate('g1');

    expect(first).toBe(second);
  });

  it('应在 merge 后返回隔离的 summary/detail 快照', () => {
    const repository = new GroupRepository();

    const summary = repository.mergeSummary({
      groupId: 'g1',
      name: 'Group 1',
    });
    (summary as { name: string }).name = 'Mutated Summary';

    const detail = repository.mergeDetail({
      groupId: 'g1',
      name: 'Group 1 Detail',
      owner: {
        userId: 'owner',
        nickname: 'Owner',
      },
    });
    if (!detail.owner) {
      throw new Error('expected owner');
    }
    (detail.owner as { nickname?: string }).nickname = 'Mutated Owner';

    expect(repository.getSummarySnapshot('g1')).toEqual({
      groupId: 'g1',
      name: 'Group 1 Detail',
      memberCount: undefined,
      description: undefined,
      public: undefined,
      joinApprovalRequired: undefined,
      allowInvites: undefined,
      maxMembers: undefined,
      role: undefined,
      disabled: undefined,
    });
    expect(repository.getDetailSnapshot('g1')).toEqual({
      groupId: 'g1',
      name: 'Group 1 Detail',
      owner: {
        userId: 'owner',
        nickname: 'Owner',
      },
    });
  });

  it('clear 后不应继续返回旧快照', () => {
    const repository = new GroupRepository();
    repository.mergeSummary({
      groupId: 'g1',
      name: 'Group 1',
    });
    repository.applyJoinedGroupSnapshot({
      items: [
        {
          groupId: 'g1',
          name: 'Group 1',
          joinedAt: 100,
        },
      ],
      meta: {
        integrity: 'synced',
        limited: false,
        storageLimit: 100,
        serverLimit: 3000,
        source: 'sync',
      },
    });

    repository.clear();

    expect(repository.getSummarySnapshot('g1')).toBeNull();
    expect(repository.getDetailSnapshot('g1')).toBeNull();
    expect(repository.getJoinedGroupSummarySnapshot('g1')).toBeNull();
  });

  it('delete 后不应继续返回指定群组的旧快照', () => {
    const repository = new GroupRepository();
    repository.mergeDetail({
      groupId: 'g1',
      name: 'Group 1',
    });
    repository.mergeDetail({
      groupId: 'g2',
      name: 'Group 2',
    });

    repository.delete('g1');

    expect(repository.getDetailSnapshot('g1')).toBeNull();
    expect(repository.getDetailSnapshot('g2')).toEqual({
      groupId: 'g2',
      name: 'Group 2',
    });
  });

  it('delete 后应从已加入群组快照中移除指定群组', () => {
    const repository = new GroupRepository();
    repository.applyJoinedGroupSnapshot({
      items: [
        {
          groupId: 'g1',
          name: 'Group 1',
          joinedAt: 100,
        },
        {
          groupId: 'g2',
          name: 'Group 2',
          joinedAt: 200,
        },
      ],
      meta: {
        integrity: 'synced',
        limited: false,
        storageLimit: 100,
        serverLimit: 3000,
        source: 'sync',
      },
    });

    repository.delete('g1');

    expect(repository.getJoinedGroupSummarySnapshot('g1')).toBeNull();
    expect(repository.getJoinedGroupSnapshot().items).toEqual([
      {
        groupId: 'g2',
        name: 'Group 2',
        joinedAt: 200,
      },
    ]);
  });

  it('mergeDetail 应从本地已加入群快照补齐 joinedAt 且不覆盖详情已有值', () => {
    const repository = new GroupRepository();
    repository.applyJoinedGroupSnapshot({
      items: [
        {
          groupId: 'g1',
          name: 'Joined Group',
          joinedAt: 300,
        },
        {
          groupId: 'g2',
          name: 'Joined Group 2',
          joinedAt: 400,
        },
      ],
      meta: {
        integrity: 'synced',
        limited: false,
        storageLimit: 100,
        serverLimit: 3000,
        source: 'sync',
      },
    });

    const filled = repository.mergeDetail({
      groupId: 'g1',
      name: 'Group 1 Detail',
    });
    const preserved = repository.mergeDetail({
      groupId: 'g2',
      name: 'Group 2 Detail',
      joinedAt: 450,
    });

    expect(filled.joinedAt).toBe(300);
    expect(repository.getDetailSnapshot('g1')?.joinedAt).toBe(300);
    expect(preserved.joinedAt).toBe(450);
    expect(repository.getDetailSnapshot('g2')?.joinedAt).toBe(450);
  });

  it('应按 groupId 返回隔离的已加入群轻量摘要并支持 preview fallback', () => {
    const repository = new GroupRepository();
    repository.applyJoinedGroupSnapshot({
      items: [
        {
          groupId: 'g1',
          name: 'Runtime Group',
          avatarUrl: 'https://cdn.example.com/runtime.png',
          remindType: 'AT',
        },
      ],
      meta: {
        integrity: 'synced',
        limited: false,
        storageLimit: 100,
        serverLimit: 3000,
        source: 'sync',
      },
    });

    const runtimeSummary = repository.getJoinedGroupSummarySnapshot('g1');
    const previewSummary = repository.getJoinedGroupSummarySnapshot('g2', {
      items: [
        {
          groupId: 'g2',
          name: 'Preview Group',
          avatarUrl: 'https://cdn.example.com/preview.png',
          role: 'admin',
        },
      ],
      meta: {
        integrity: 'preview',
        limited: false,
        storageLimit: 100,
        serverLimit: 3000,
        source: 'localPreview',
      },
    });

    expect(runtimeSummary).toEqual({
      groupId: 'g1',
      name: 'Runtime Group',
      avatarUrl: 'https://cdn.example.com/runtime.png',
      remindType: 'AT',
    });
    expect(previewSummary).toEqual({
      groupId: 'g2',
      name: 'Preview Group',
      avatarUrl: 'https://cdn.example.com/preview.png',
      role: 'admin',
    });

    (runtimeSummary as { name: string }).name = 'Mutated Runtime';

    expect(repository.getJoinedGroupSummarySnapshot('g1')?.name).toBe('Runtime Group');
    expect(repository.getJoinedGroupSummarySnapshot('missing')).toBeNull();
  });

  it('sessionKey 变化后应清理旧会话快照', () => {
    const repository = new GroupRepository();

    expect(repository.ensureSession('s1')).toBe(true);
    repository.mergeDetail({
      groupId: 'g1',
      name: 'Group 1',
    });
    repository.applyJoinedGroupSnapshot({
      items: [
        {
          groupId: 'g1',
          name: 'Group 1',
          joinedAt: 100,
        },
      ],
      meta: {
        integrity: 'synced',
        limited: false,
        storageLimit: 100,
        serverLimit: 3000,
        source: 'sync',
      },
    });

    expect(repository.getSessionKey()).toBe('s1');
    expect(repository.getDetailSnapshot('g1')).toEqual({
      groupId: 'g1',
      name: 'Group 1',
    });
    expect(repository.getJoinedGroupSummarySnapshot('g1')?.joinedAt).toBe(100);

    expect(repository.ensureSession('s2')).toBe(true);
    expect(repository.getSessionKey()).toBe('s2');
    expect(repository.getDetailSnapshot('g1')).toBeNull();
    expect(repository.getJoinedGroupSummarySnapshot('g1')).toBeNull();
    expect(repository.ensureSession('s2')).toBe(false);
  });
});
