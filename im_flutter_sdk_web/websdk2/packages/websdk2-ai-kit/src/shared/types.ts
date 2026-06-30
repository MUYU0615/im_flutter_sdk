export type SupportedTool = 'cursor' | 'codex' | 'agent';
export type RequestedTool = SupportedTool | 'all' | 'auto';

export interface GeneratedFile {
  readonly tool: SupportedTool;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly content: string;
}

export interface InitCommandOptions {
  readonly tool: RequestedTool;
  readonly cwd?: string;
  readonly dryRun: boolean;
  readonly force: boolean;
}

export interface UpdateCommandOptions {
  readonly tool: RequestedTool;
  readonly cwd?: string;
  readonly dryRun: boolean;
}

export interface RemoveCommandOptions {
  readonly tool: RequestedTool;
  readonly cwd?: string;
  readonly dryRun: boolean;
}

export interface InstallAction {
  readonly tool: SupportedTool;
  readonly relativePath: string;
  readonly status: 'create' | 'overwrite' | 'skip';
}

export interface InstallResult {
  readonly projectRoot: string;
  readonly manifestPath: string;
  readonly dryRun: boolean;
  readonly resolvedTools: ReadonlyArray<SupportedTool>;
  readonly actions: ReadonlyArray<InstallAction>;
  readonly installedFileCount: number;
}

export interface RemoveAction {
  readonly tool: SupportedTool;
  readonly relativePath: string;
  readonly status: 'remove' | 'missing' | 'skip';
}

export interface RemoveResult {
  readonly projectRoot: string;
  readonly manifestPath: string;
  readonly dryRun: boolean;
  readonly resolvedTools: ReadonlyArray<SupportedTool>;
  readonly actions: ReadonlyArray<RemoveAction>;
  readonly removedFileCount: number;
}

export interface ToolManifestEntry {
  readonly tool: SupportedTool;
  readonly files: ReadonlyArray<string>;
}

export interface AiKitManifest {
  readonly packageName: string;
  readonly packageVersion: string;
  readonly installedAt: string;
  readonly projectRoot: string;
  readonly tools: ReadonlyArray<ToolManifestEntry>;
}

export interface DoctorOptions {
  readonly cwd?: string;
}

export interface DoctorFileStatus {
  readonly path: string;
  readonly exists: boolean;
}

export interface DoctorToolStatus {
  readonly tool: SupportedTool;
  readonly detected: boolean;
  readonly installed: boolean;
  readonly files: ReadonlyArray<DoctorFileStatus>;
}

export interface DoctorResult {
  readonly projectRoot: string;
  readonly manifestPath: string;
  readonly manifestExists: boolean;
  readonly manifest: AiKitManifest | null;
  readonly detectedTools: ReadonlyArray<SupportedTool>;
  readonly tools: ReadonlyArray<DoctorToolStatus>;
}

export interface CommandIO {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

export interface ParsedCliCommand {
  readonly name: 'init' | 'update' | 'remove' | 'doctor' | 'help';
  readonly initOptions?: InitCommandOptions;
  readonly updateOptions?: UpdateCommandOptions;
  readonly removeOptions?: RemoveCommandOptions;
  readonly doctorOptions?: DoctorOptions;
}
