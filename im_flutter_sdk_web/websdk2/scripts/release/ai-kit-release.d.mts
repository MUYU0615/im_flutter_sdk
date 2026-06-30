export interface ReleasePackageInfo {
  readonly name: string;
  readonly version: string;
}

export interface AiKitVersionAlignment {
  readonly rootPackage: ReleasePackageInfo;
  readonly aiKitPackage: ReleasePackageInfo;
}

export declare const ensureAiKitVersionAligned: () => AiKitVersionAlignment;

export declare const runAiKitReleaseCheck: () => Promise<void>;

export declare const runAiKitPack: () => Promise<void>;

export declare const runAiKitPublish: () => Promise<void>;
