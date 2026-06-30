import type { CompatibleFile } from '../types';

class AttachmentFileStore {
  private readonly store = new Map<string, CompatibleFile>();

  set(msgLocalId: string, file: CompatibleFile): void {
    if (!msgLocalId) {
      return;
    }
    this.store.set(msgLocalId, file);
  }

  get(msgLocalId: string): CompatibleFile | undefined {
    if (!msgLocalId) {
      return undefined;
    }
    return this.store.get(msgLocalId);
  }

  consume(msgLocalId: string): CompatibleFile | undefined {
    const file = this.get(msgLocalId);
    if (file) {
      this.store.delete(msgLocalId);
    }
    return file;
  }

  delete(msgLocalId: string): void {
    if (!msgLocalId) {
      return;
    }
    this.store.delete(msgLocalId);
  }

  clear(): void {
    this.store.clear();
  }
}

export const attachmentFileStore = new AttachmentFileStore();
export type { AttachmentFileStore };
