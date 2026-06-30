import { describe, expect, it } from 'vitest';

import { GroupEventSync } from '@/managers/group/internal/group-event-sync';
import { GroupRepository } from '@/managers/group/internal/group-repository';

describe('GroupEventSync', () => {
  it('应在现有详情上应用 patch', () => {
    const repository = new GroupRepository();
    const sync = new GroupEventSync(repository);

    repository.mergeDetail({
      groupId: 'g1',
      name: 'Group 1',
      description: 'old',
    });

    const result = sync.applyPatch({
      groupId: 'g1',
      groupPatch: {
        description: 'new',
      },
    });

    expect(result).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      description: 'new',
    });
  });

  it('应支持仅标记 stale 而不强制构造详情', () => {
    const repository = new GroupRepository();
    const sync = new GroupEventSync(repository);

    const result = sync.applyPatch({
      groupId: 'g1',
      shouldMarkStale: true,
    });

    expect(result).toBeNull();
    expect(repository.getOrCreate('g1').isStale()).toBe(true);
  });

  it('在无现有 detail 时也应能基于 groupName 和 patch 建立最小详情快照', () => {
    const repository = new GroupRepository();
    const sync = new GroupEventSync(repository);

    const result = sync.applyPatch({
      groupId: 'g1',
      groupName: 'Group 1',
      groupPatch: {
        description: 'patched',
      },
    });

    expect(result).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      description: 'patched',
    });
    expect(repository.getDetailSnapshot('g1')).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      description: 'patched',
    });
  });
});
