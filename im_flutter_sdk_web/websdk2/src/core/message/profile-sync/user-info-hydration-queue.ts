import { logger } from '../../../utils/logger';

export interface UserInfoHydrationTarget {
  readonly userId: string;
  readonly userInfoUpdateTime?: number;
}

export interface UserInfoHydrationQueueOptions {
  readonly windowMs: number;
  readonly batchSize: number;
  readonly onFlush: (targets: ReadonlyArray<UserInfoHydrationTarget>) => Promise<void> | void;
}

export class UserInfoHydrationQueue {
  private readonly pendingTargets = new Map<string, UserInfoHydrationTarget>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  public constructor(private readonly options: UserInfoHydrationQueueOptions) {}

  public enqueue(userId: string, userInfoUpdateTime?: number): void {
    if (!userId) {
      return;
    }
    const existing = this.pendingTargets.get(userId);
    this.pendingTargets.set(userId, {
      userId,
      userInfoUpdateTime: this.resolveMaxVersion(
        existing?.userInfoUpdateTime,
        userInfoUpdateTime
      ),
    });

    if (this.pendingTargets.size >= this.options.batchSize) {
      this.flush();
      return;
    }

    this.schedule();
  }

  public destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingTargets.clear();
  }

  public getOptions(): Omit<UserInfoHydrationQueueOptions, 'onFlush'> {
    return {
      windowMs: this.options.windowMs,
      batchSize: this.options.batchSize,
    };
  }

  private schedule(): void {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.options.windowMs);
  }

  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pendingTargets.size === 0) {
      return;
    }
    const targets = Array.from(this.pendingTargets.values());
    this.pendingTargets.clear();
    void Promise.resolve(this.options.onFlush(targets)).catch(error => {
      logger.warn('User info hydration queue flush failed', {
        targets: targets.map(item => item.userId),
        error: error instanceof Error ? error.message : String(error),
      });
    });
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
