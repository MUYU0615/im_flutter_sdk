import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMsyncContext } from '@/protocol/msync/context';

const clearDeviceStorage = (): void => {
  localStorage.clear();
};

describe('Msync context device info', () => {
  beforeEach((): void => {
    clearDeviceStorage();
    vi.useFakeTimers();
  });

  afterEach((): void => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should reuse device id when useFixedDeviceId is true', (): void => {
    vi.setSystemTime(new Date(1000));
    const first = createMsyncContext({
      appKey: 'app-key',
      userId: 'user-1',
      token: 'token-1',
      useFixedDeviceId: true,
      deviceId: 'webim',
    });

    vi.setSystemTime(new Date(2000));
    const second = createMsyncContext({
      appKey: 'app-key',
      userId: 'user-1',
      token: 'token-1',
      useFixedDeviceId: true,
      deviceId: 'webim',
    });

    expect(first.deviceId).toBe(second.deviceId);
  });

  it('should generate different device id when useFixedDeviceId is false', (): void => {
    vi.setSystemTime(new Date(1000));
    const first = createMsyncContext({
      appKey: 'app-key',
      userId: 'user-1',
      token: 'token-1',
      useFixedDeviceId: false,
      deviceId: 'webim',
    });

    vi.setSystemTime(new Date(2000));
    const second = createMsyncContext({
      appKey: 'app-key',
      userId: 'user-1',
      token: 'token-1',
      useFixedDeviceId: false,
      deviceId: 'webim',
    });

    expect(first.deviceId).not.toBe(second.deviceId);
  });

  it('should apply customOsPlatform and customDeviceName', (): void => {
    vi.setSystemTime(new Date(3000));
    const context = createMsyncContext({
      appKey: 'app-key',
      userId: 'user-1',
      token: 'token-1',
      useFixedDeviceId: true,
      deviceId: 'webim',
      customOsPlatform: 10,
      customDeviceName: 'custom-device',
    });

    expect(context.customOsPlatform).toBe(10);
    expect(context.osType).toBe(5);
    expect(context.deviceName).toBe('custom-device');
    expect(context.deviceId.startsWith('custom10_')).toBe(true);
  });
});
