import type { GroupDetail, GroupSummary } from '../../../types/group';

const cloneSummary = (summary: GroupSummary): GroupSummary => ({
  ...summary,
});

const cloneDetail = (detail: GroupDetail): GroupDetail => ({
  ...detail,
  owner: detail.owner ? { ...detail.owner } : undefined,
});

export class InternalGroup {
  // Internal runtime truth for a single group within one client session.
  public readonly groupId: string;

  private summarySnapshot: GroupSummary | null = null;
  private detailSnapshot: GroupDetail | null = null;
  private loadedSummary = false;
  private stale = false;
  private loadedDetail = false;
  private lastPatchedAt: number | null = null;
  private lastHydratedAt: number | null = null;

  public constructor(groupId: string) {
    this.groupId = groupId;
  }

  public mergeSummary(summary: GroupSummary): void {
    if (summary.groupId !== this.groupId) {
      return;
    }

    this.summarySnapshot = cloneSummary({
      ...(this.summarySnapshot ?? {}),
      ...summary,
      groupId: this.groupId,
    });
    this.loadedSummary = true;
    this.lastPatchedAt = Date.now();
  }

  public mergeDetail(detail: GroupDetail): void {
    if (detail.groupId !== this.groupId) {
      return;
    }

    this.detailSnapshot = cloneDetail({
      ...(this.detailSnapshot ?? this.summarySnapshot ?? { groupId: this.groupId, name: '' }),
      ...detail,
      groupId: this.groupId,
    });
    this.summarySnapshot = cloneSummary(this.toSummaryFromDetail(this.detailSnapshot));
    this.loadedSummary = true;
    this.loadedDetail = true;
    this.stale = false;
    this.lastPatchedAt = Date.now();
    this.lastHydratedAt = Date.now();
  }

  public markStale(): void {
    this.stale = true;
    this.lastPatchedAt = Date.now();
  }

  public clear(): void {
    this.summarySnapshot = null;
    this.detailSnapshot = null;
    this.loadedSummary = false;
    this.stale = false;
    this.loadedDetail = false;
    this.lastPatchedAt = null;
    this.lastHydratedAt = null;
  }

  public getSummarySnapshot(): GroupSummary | null {
    if (this.summarySnapshot) {
      return cloneSummary(this.summarySnapshot);
    }
    if (this.detailSnapshot) {
      return cloneSummary(this.toSummaryFromDetail(this.detailSnapshot));
    }
    return null;
  }

  public getDetailSnapshot(): GroupDetail | null {
    return this.detailSnapshot ? cloneDetail(this.detailSnapshot) : null;
  }

  public isStale(): boolean {
    return this.stale;
  }

  public hasLoadedSummary(): boolean {
    return this.loadedSummary;
  }

  public hasLoadedDetail(): boolean {
    return this.loadedDetail;
  }

  public getLastPatchedAt(): number | null {
    return this.lastPatchedAt;
  }

  public getLastHydratedAt(): number | null {
    return this.lastHydratedAt;
  }

  private toSummaryFromDetail(detail: GroupDetail): GroupSummary {
    return {
      groupId: detail.groupId,
      name: detail.name,
      description: detail.description,
      memberCount: detail.memberCount,
      public: detail.public,
      joinApprovalRequired: detail.joinApprovalRequired,
      allowInvites: detail.allowInvites,
      maxMembers: detail.maxMembers,
      role: detail.role,
      disabled: detail.disabled,
    };
  }
}
