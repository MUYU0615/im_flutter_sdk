import type {
  GroupDetail,
  GroupSummary,
  JoinedGroupSnapshot,
  JoinedGroupSummary,
} from '../../../types/group';
import { InternalGroup } from './internal-group';
import { GroupSnapshotMapper } from './group-snapshot-mapper';

export class GroupRepository {
  // Repository owns the per-session identity map for InternalGroup instances.
  private readonly groups = new Map<string, InternalGroup>();
  private readonly joinedGroupById = new Map<string, JoinedGroupSummary>();
  private readonly snapshotMapper = new GroupSnapshotMapper();
  private joinedGroupSnapshot: JoinedGroupSnapshot | null = null;
  private sessionKey: string | null = null;

  public ensureSession(sessionKey: string | null): boolean {
    if (this.sessionKey === sessionKey) {
      return false;
    }

    this.sessionKey = sessionKey;
    this.groups.clear();
    this.joinedGroupById.clear();
    this.joinedGroupSnapshot = null;
    return true;
  }

  public getSessionKey(): string | null {
    return this.sessionKey;
  }

  public getOrCreate(groupId: string): InternalGroup {
    const existing = this.groups.get(groupId);
    if (existing) {
      return existing;
    }

    const group = new InternalGroup(groupId);
    this.groups.set(groupId, group);
    return group;
  }

  public mergeSummary(summary: GroupSummary): GroupSummary {
    const group = this.getOrCreate(summary.groupId);
    group.mergeSummary(summary);
    return this.getSummarySnapshot(summary.groupId) ?? { ...summary };
  }

  public mergeSummaries(items: ReadonlyArray<GroupSummary>): ReadonlyArray<GroupSummary> {
    return items.map(item => this.mergeSummary(item));
  }

  public applyJoinedGroupSnapshot(snapshot: JoinedGroupSnapshot): void {
    this.joinedGroupSnapshot = {
      items: snapshot.items.map(item => ({ ...item })),
      meta: { ...snapshot.meta },
    };
    this.joinedGroupById.clear();
    for (const item of snapshot.items) {
      const snapshotItem = { ...item };
      this.joinedGroupById.set(snapshotItem.groupId, snapshotItem);
      this.mergeSummary(this.toGroupSummary(snapshotItem));
    }
  }

  public getJoinedGroupSnapshot(fallback?: JoinedGroupSnapshot): JoinedGroupSnapshot {
    if (this.joinedGroupSnapshot) {
      return {
        items: this.joinedGroupSnapshot.items.map(item => ({ ...item })),
        meta: { ...this.joinedGroupSnapshot.meta },
      };
    }
    if (fallback) {
      return {
        items: fallback.items.map(item => ({ ...item })),
        meta: { ...fallback.meta },
      };
    }
    return {
      items: [],
      meta: {
        integrity: 'unknown',
        limited: false,
        storageLimit: 100,
        serverLimit: 3000,
        source: 'sync',
      },
    };
  }

  public getJoinedGroupSummarySnapshot(
    groupId: string,
    fallback?: JoinedGroupSnapshot
  ): JoinedGroupSummary | null {
    const runtimeSummary = this.joinedGroupById.get(groupId);
    if (runtimeSummary) {
      return { ...runtimeSummary };
    }

    const fallbackSummary = fallback?.items.find(item => item.groupId === groupId);
    if (fallbackSummary) {
      return { ...fallbackSummary };
    }

    return null;
  }

  public mergeDetail(detail: GroupDetail): GroupDetail {
    const mergedDetail = this.mergeJoinedGroupFieldsIntoDetail(detail);
    const group = this.getOrCreate(mergedDetail.groupId);
    group.mergeDetail(mergedDetail);
    return this.getDetailSnapshot(mergedDetail.groupId) ?? { ...mergedDetail };
  }

  public mergeDetails(items: ReadonlyArray<GroupDetail>): ReadonlyArray<GroupDetail> {
    return items.map(item => this.mergeDetail(item));
  }

  public getSummarySnapshot(groupId: string): GroupSummary | null {
    const group = this.groups.get(groupId);
    return group ? this.snapshotMapper.toSummary(group) : null;
  }

  public getDetailSnapshot(groupId: string): GroupDetail | null {
    const group = this.groups.get(groupId);
    return group ? this.snapshotMapper.toDetail(group) : null;
  }

  public hasFreshDetail(groupId: string): boolean {
    const group = this.groups.get(groupId);
    return Boolean(group && group.hasLoadedDetail() && !group.isStale());
  }

  public markStale(groupId: string): void {
    this.getOrCreate(groupId).markStale();
  }

  public delete(groupId: string): void {
    this.groups.delete(groupId);
    this.joinedGroupById.delete(groupId);
    if (!this.joinedGroupSnapshot) {
      return;
    }
    this.joinedGroupSnapshot = {
      items: this.joinedGroupSnapshot.items
        .filter(item => item.groupId !== groupId)
        .map(item => ({ ...item })),
      meta: { ...this.joinedGroupSnapshot.meta },
    };
  }

  public clear(): void {
    this.groups.clear();
    this.joinedGroupById.clear();
    this.joinedGroupSnapshot = null;
  }

  private mergeJoinedGroupFieldsIntoDetail(detail: GroupDetail): GroupDetail {
    const joinedGroup = this.joinedGroupById.get(detail.groupId);
    if (!joinedGroup || detail.joinedAt !== undefined || joinedGroup.joinedAt === undefined) {
      return detail;
    }
    return {
      ...detail,
      joinedAt: joinedGroup.joinedAt,
    };
  }

  private toGroupSummary(summary: JoinedGroupSummary): GroupSummary {
    return {
      groupId: summary.groupId,
      name: summary.name,
      description: summary.description,
      memberCount: summary.memberCount,
      role: summary.role,
      disabled: summary.disabled,
    };
  }
}
