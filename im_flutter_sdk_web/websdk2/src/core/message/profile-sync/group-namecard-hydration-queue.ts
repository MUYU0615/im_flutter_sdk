import { logger } from '../../../utils/logger';

export interface GroupNamecardHydrationTarget {
  readonly userId: string;
  readonly namecardUpdateTime?: number;
}

export interface GroupNamecardHydrationBatch {
  readonly groupId: string;
  readonly targets: ReadonlyArray<GroupNamecardHydrationTarget>;
}

export interface GroupNamecardHydrationQueueOptions {
  readonly windowMs: number;
  readonly minWindowMs: number;
  readonly maxBatchSize: number;
  readonly maxConcurrency: number;
  readonly onFlushGroup: (batch: GroupNamecardHydrationBatch) => Promise<void> | void;
}

export class GroupNamecardHydrationQueue {
  private readonly pendingGroups = new Map<string, Map<string, GroupNamecardHydrationTarget>>();
  private readonly readyGroups: GroupNamecardHydrationBatch[] = [];
  private readonly pendingOrder: string[] = [];
  private readonly activeGroups = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private activeGroupCount = 0;

  public constructor(private readonly options: GroupNamecardHydrationQueueOptions) {}

  public enqueue(groupId: string, userId: string, namecardUpdateTime?: number): void {
    if (!groupId || !userId) {
      return;
    }
    const groupTargets =
      this.pendingGroups.get(groupId) ?? new Map<string, GroupNamecardHydrationTarget>();
    if (!this.pendingGroups.has(groupId)) {
      this.pendingGroups.set(groupId, groupTargets);
      this.pendingOrder.push(groupId);
    }
    const existing = groupTargets.get(userId);
    groupTargets.set(userId, {
      userId,
      namecardUpdateTime: this.resolveMaxVersion(existing?.namecardUpdateTime, namecardUpdateTime),
    });
    this.schedule();
  }

  public destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingGroups.clear();
    this.pendingOrder.length = 0;
    this.readyGroups.length = 0;
    this.activeGroups.clear();
    this.activeGroupCount = 0;
  }

  public getOptions(): Omit<GroupNamecardHydrationQueueOptions, 'onFlushGroup'> {
    return {
      windowMs: this.options.windowMs,
      minWindowMs: this.options.minWindowMs,
      maxBatchSize: this.options.maxBatchSize,
      maxConcurrency: this.options.maxConcurrency,
    };
  }

  private schedule(): void {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flushWindow();
    }, this.resolveWindowDelay());
  }

  private flushWindow(): void {
    if (this.pendingOrder.length === 0) {
      return;
    }
    for (const groupId of this.pendingOrder) {
      const groupTargets = this.pendingGroups.get(groupId);
      if (!groupTargets || groupTargets.size === 0) {
        continue;
      }
      const targets = Array.from(groupTargets.values());
      const batchSize = Math.max(1, this.options.maxBatchSize);
      for (let index = 0; index < targets.length; index += batchSize) {
        this.readyGroups.push({
          groupId,
          targets: targets.slice(index, index + batchSize),
        });
      }
    }
    this.pendingGroups.clear();
    this.pendingOrder.length = 0;
    this.runReadyGroups();
  }

  private runReadyGroups(): void {
    while (this.activeGroupCount < this.options.maxConcurrency && this.readyGroups.length > 0) {
      const batchIndex = this.readyGroups.findIndex(item => !this.activeGroups.has(item.groupId));
      if (batchIndex < 0) {
        return;
      }
      const batch = this.readyGroups.splice(batchIndex, 1)[0];
      if (!batch) {
        return;
      }
      this.activeGroupCount += 1;
      this.activeGroups.add(batch.groupId);
      void Promise.resolve(this.options.onFlushGroup(batch))
        .catch(error => {
          logger.warn('Group namecard hydration queue flush failed', {
            groupId: batch.groupId,
            userIds: batch.targets.map(item => item.userId),
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          this.activeGroupCount -= 1;
          this.activeGroups.delete(batch.groupId);
          this.runReadyGroups();
        });
    }
  }

  private resolveWindowDelay(): number {
    const minWindowMs = Math.max(0, Math.min(this.options.minWindowMs, this.options.windowMs));
    const maxWindowMs = Math.max(minWindowMs, this.options.windowMs);
    const range = maxWindowMs - minWindowMs;
    if (range <= 0) {
      return maxWindowMs;
    }
    return minWindowMs + Math.floor(Math.random() * (range + 1));
  }

  private resolveMaxVersion(
    currentVersion: number | undefined,
    nextVersion: number | undefined
  ): number | undefined {
    if (typeof currentVersion !== 'number') {
      return nextVersion;
    }
    if (typeof nextVersion !== 'number') {
      return currentVersion;
    }
    return Math.max(currentVersion, nextVersion);
  }
}
