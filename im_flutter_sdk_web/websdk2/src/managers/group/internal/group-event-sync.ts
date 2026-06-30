import type { GroupDetail } from '../../../types/group';
import { GroupRepository } from './group-repository';

export interface GroupEventPatch {
  readonly groupId: string;
  readonly groupName?: string;
  readonly groupPatch?: Partial<GroupDetail>;
  readonly shouldMarkStale?: boolean;
}

export class GroupEventSync {
  // Event sync applies patch/stale semantics before public payload export.
  private readonly repository: GroupRepository;

  public constructor(repository: GroupRepository) {
    this.repository = repository;
  }

  public applyPatch(patch: GroupEventPatch): GroupDetail | null {
    if (patch.shouldMarkStale) {
      this.repository.markStale(patch.groupId);
    }

    const current = this.repository.getDetailSnapshot(patch.groupId);
    if (!patch.groupPatch) {
      return current;
    }

    const baseDetail: GroupDetail = current ?? {
      groupId: patch.groupId,
      name: patch.groupPatch.name ?? patch.groupName ?? '',
    };

    return this.repository.mergeDetail({
      ...baseDetail,
      ...patch.groupPatch,
      groupId: patch.groupId,
    });
  }
}
