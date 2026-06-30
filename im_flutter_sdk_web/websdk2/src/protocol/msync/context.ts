/**
 * MSync 上下文配置
 */

import { buildDeviceInfo } from './utils';
import { CompressType, EncryptType } from './types';

export interface MsyncContextOptions {
  appKey: string;
  userId: string;
  token: string;
  domain?: string;
  version?: string;
  osType?: number;
  useReplacedMessageContents?: boolean;
  useFixedDeviceId?: boolean;
  deviceId?: string;
  customDeviceName?: string;
  customOsPlatform?: number;
  uiKitVersion?: string;
  useCustomAttachmentUpload?: boolean;
  loginExtensionInfo?: string;
}

export interface MsyncContextState {
  appKey: string;
  userId: string;
  token: string;
  domain: string;
  version: string;
  uiKitVersion?: string;
  osType: number;
  deviceId: string;
  deviceName: string;
  deviceUuid: string;
  clientResource: string;
  customOsPlatform?: number;
  loginExtensionInfo?: string;
  encryptType: number[];
  compressType: number[];
  sessionId: string;
}

export const createMsyncContext = (options: MsyncContextOptions): MsyncContextState => {
  const device = buildDeviceInfo({
    useFixedDeviceId: options.useFixedDeviceId ?? true,
    deviceId: options.deviceId ?? 'webim',
    customDeviceName: options.customDeviceName,
    customOsPlatform: options.customOsPlatform,
  });
  const sessionId = `${Date.now()}:`;
  return {
    appKey: options.appKey,
    userId: options.userId,
    token: options.token,
    domain: options.domain ?? 'easemob.com',
    version: options.version ?? '4.11.0',
    uiKitVersion: options.uiKitVersion,
    osType: options.customOsPlatform !== undefined ? 5 : (options.osType ?? 16),
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    deviceUuid: device.deviceUuid,
    clientResource: device.deviceId,
    customOsPlatform: options.customOsPlatform,
    loginExtensionInfo: options.loginExtensionInfo,
    encryptType: [EncryptType.ENCRYPT_NONE],
    compressType: [CompressType.COMPRESS_NONE],
    sessionId,
  };
};
