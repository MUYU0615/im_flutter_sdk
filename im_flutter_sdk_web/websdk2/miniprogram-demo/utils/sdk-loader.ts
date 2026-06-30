import type { ChatClient } from '../../src/chat-client';
import type { RUNTIME_PLATFORMS } from '../../src/platform';

export const DIST_SDK_ENTRY = '../../dist/index.js';
export const MINI_PROGRAM_SDK_MODE = 'dist';

export interface MiniProgramSdkModule {
  readonly ChatClient: typeof ChatClient;
  readonly RUNTIME_PLATFORMS: typeof RUNTIME_PLATFORMS;
}

export type MiniProgramSdkLoader = () => Promise<MiniProgramSdkModule>;

export const loadSdkModule = async (
  loader: MiniProgramSdkLoader = async (): Promise<MiniProgramSdkModule> => {
    const sdkEntry: string = DIST_SDK_ENTRY;
    return (await import(sdkEntry)) as unknown as MiniProgramSdkModule;
  }
): Promise<MiniProgramSdkModule> => {
  return loader();
};

export const getMiniProgramSdkMode = (): 'dist' => {
  return MINI_PROGRAM_SDK_MODE;
};
