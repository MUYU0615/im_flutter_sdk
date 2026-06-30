import type { GroupDetail, GroupSummary } from '../../../types/group';
import { InternalGroup } from './internal-group';

const cloneSummary = (summary: GroupSummary): GroupSummary => ({
  ...summary,
});

const cloneDetail = (detail: GroupDetail): GroupDetail => ({
  ...detail,
  owner: detail.owner ? { ...detail.owner } : undefined,
});

export class GroupSnapshotMapper {
  public toSummary(group: InternalGroup): GroupSummary | null {
    const summary = group.getSummarySnapshot();
    return summary ? cloneSummary(summary) : null;
  }

  public toDetail(group: InternalGroup): GroupDetail | null {
    const detail = group.getDetailSnapshot();
    return detail ? cloneDetail(detail) : null;
  }
}
