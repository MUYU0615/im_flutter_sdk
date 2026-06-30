import { describe, it, expect, beforeEach } from 'vitest';
import { attachmentFileStore } from '@/upload/attachment-file-store';

describe('AttachmentFileStore', () => {
  beforeEach(() => {
    attachmentFileStore.clear();
  });

  it('should set and get cached file', () => {
    const file = new File(['demo'], 'demo.txt', { type: 'text/plain' });
    attachmentFileStore.set('local-1', file);
    expect(attachmentFileStore.get('local-1')).toBe(file);
  });

  it('should overwrite cached file with same msgLocalId', () => {
    const first = new File(['a'], 'a.txt', { type: 'text/plain' });
    const second = new File(['b'], 'b.txt', { type: 'text/plain' });
    attachmentFileStore.set('local-2', first);
    attachmentFileStore.set('local-2', second);
    expect(attachmentFileStore.get('local-2')).toBe(second);
  });

  it('should consume cached file', () => {
    const file = new File(['demo'], 'demo.txt', { type: 'text/plain' });
    attachmentFileStore.set('local-3', file);
    expect(attachmentFileStore.consume('local-3')).toBe(file);
    expect(attachmentFileStore.get('local-3')).toBeUndefined();
  });
});
