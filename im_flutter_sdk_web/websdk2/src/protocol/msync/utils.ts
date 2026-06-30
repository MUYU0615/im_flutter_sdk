/**
 * MSync 工具方法
 */

import Long from 'long';
import { KeyValueType } from './types';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceUuid: string;
}

export interface DeviceInfoOptions {
  useFixedDeviceId: boolean;
  deviceId: string;
  customOsPlatform?: number;
  customDeviceName?: string;
}

export interface Jid {
  appKey?: string;
  name: string;
  domain?: string;
  clientResource?: string;
}

const DEVICE_STORAGE_KEY = 'websdk2:device-info';
const DEFAULT_DEVICE_ID = 'webim';
const DEFAULT_DEVICE_PLATFORM = 'web';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const buildDeviceInfo = (options: DeviceInfoOptions): DeviceInfo => {
  const now = Date.now();
  const baseDeviceId = options.deviceId;
  const customOsPlatform = options.customOsPlatform;
  const customDeviceName = customOsPlatform !== undefined ? options.customDeviceName : undefined;

  const readStoredDeviceInfo = (): DeviceInfo | null => {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(DEVICE_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (
        isRecord(parsed)
        && typeof parsed.deviceId === 'string'
        && typeof parsed.deviceName === 'string'
        && typeof parsed.deviceUuid === 'string'
      ) {
        return {
          deviceId: parsed.deviceId,
          deviceName: parsed.deviceName,
          deviceUuid: parsed.deviceUuid,
        };
      }
    } catch {
      return null;
    }
    return null;
  };

  const persistDeviceInfo = (info: DeviceInfo): void => {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(info));
    } catch {
      // ignore storage errors
    }
  };

  const applyCustomPlatform = (info: DeviceInfo): DeviceInfo => {
    if (customOsPlatform === undefined) {
      return info;
    }
    return {
      deviceId: `custom${customOsPlatform}_${info.deviceUuid}`,
      deviceName: customDeviceName ?? baseDeviceId,
      deviceUuid: info.deviceUuid,
    };
  };

  if (options.useFixedDeviceId) {
    const stored = readStoredDeviceInfo();
    if (stored) {
      return applyCustomPlatform(stored);
    }

    if (baseDeviceId === DEFAULT_DEVICE_ID) {
      const deviceUuid = `${DEFAULT_DEVICE_PLATFORM}_${now}`;
      const deviceInfo = applyCustomPlatform({
        deviceId: `${baseDeviceId}_${deviceUuid}`,
        deviceName: baseDeviceId,
        deviceUuid,
      });
      persistDeviceInfo(deviceInfo);
      return deviceInfo;
    }

    if (customOsPlatform !== undefined) {
      const deviceUuid = `${DEFAULT_DEVICE_PLATFORM}_${now}`;
      const deviceInfo = applyCustomPlatform({
        deviceId: `webim_${DEFAULT_DEVICE_PLATFORM}_${baseDeviceId}`,
        deviceName: baseDeviceId,
        deviceUuid,
      });
      persistDeviceInfo(deviceInfo);
      return deviceInfo;
    }

    const deviceInfo = {
      deviceId: `webim_${DEFAULT_DEVICE_PLATFORM}_${baseDeviceId}`,
      deviceName: `webim_${DEFAULT_DEVICE_PLATFORM}_${baseDeviceId}`,
      deviceUuid: `webim_${DEFAULT_DEVICE_PLATFORM}_${baseDeviceId}`,
    };
    persistDeviceInfo(deviceInfo);
    return deviceInfo;
  }

  if (baseDeviceId === DEFAULT_DEVICE_ID) {
    const deviceUuid = `random_${DEFAULT_DEVICE_PLATFORM}_${now}`;
    return applyCustomPlatform({
      deviceId: `${baseDeviceId}_${deviceUuid}`,
      deviceName: baseDeviceId,
      deviceUuid,
    });
  }

  if (customOsPlatform !== undefined) {
    const deviceUuid = `random_${DEFAULT_DEVICE_PLATFORM}_${now}`;
    return applyCustomPlatform({
      deviceId: `webim_${DEFAULT_DEVICE_PLATFORM}_${baseDeviceId}`,
      deviceName: baseDeviceId,
      deviceUuid,
    });
  }

  return {
    deviceId: `webim_${DEFAULT_DEVICE_PLATFORM}_${baseDeviceId}`,
    deviceName: `webim_${DEFAULT_DEVICE_PLATFORM}_${baseDeviceId}`,
    deviceUuid: `webim_${DEFAULT_DEVICE_PLATFORM}_${baseDeviceId}`,
  };
};

export const buildJid = (params: Jid): Jid => ({
  appKey: params.appKey,
  name: params.name,
  domain: params.domain,
  clientResource: params.clientResource,
});

export const toNumericId = (value: string): string => {
  if (/^\d+$/.test(value)) {
    return value;
  }
  let hash = 1469598103934665603n;
  const prime = 1099511628211n;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= BigInt(value.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  if (hash === 0n) {
    return '1';
  }
  return hash.toString();
};

export const longToString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `${value}` : '';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (
    value
    && typeof value === 'object'
    && 'low' in value
    && 'high' in value
    && typeof (value as { low: number }).low === 'number'
    && typeof (value as { high: number }).high === 'number'
  ) {
    const record = value as { low: number; high: number; unsigned?: boolean };
    return new Long(record.low, record.high, Boolean(record.unsigned)).toString();
  }
  if (value && typeof (value as { toString?: () => string }).toString === 'function') {
    return (value as { toString: () => string }).toString();
  }
  return '';
};

export const encodeKeyValueRecord = (record: Record<string, unknown>): Array<Record<string, unknown>> => {
  const entries: Array<Record<string, unknown>> = [];
  for (const [key, raw] of Object.entries(record)) {
    if (raw === undefined) {
      continue;
    }
    if (typeof raw === 'boolean') {
      entries.push({ key, type: KeyValueType.BOOL, varintValue: raw ? 1 : 0 });
      continue;
    }
    if (typeof raw === 'number') {
      if (Number.isInteger(raw)) {
        entries.push({ key, type: KeyValueType.INT, varintValue: raw });
      } else {
        entries.push({ key, type: KeyValueType.DOUBLE, doubleValue: raw });
      }
      continue;
    }
    if (typeof raw === 'string') {
      entries.push({ key, type: KeyValueType.STRING, stringValue: raw });
      continue;
    }
    try {
      entries.push({ key, type: KeyValueType.JSON_STRING, stringValue: JSON.stringify(raw) });
    } catch {
      entries.push({
        key,
        type: KeyValueType.STRING,
        stringValue: Object.prototype.toString.call(raw),
      });
    }
  }
  return entries;
};

export const decodeKeyValueList = (list?: Array<Record<string, unknown>>): Record<string, unknown> => {
  if (!list || list.length === 0) {
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const item of list) {
    const key = typeof item.key === 'string' ? item.key : '';
    if (!key) {
      continue;
    }
    const type = typeof item.type === 'number' ? item.type : KeyValueType.STRING;
    if (type === KeyValueType.BOOL) {
      result[key] = Boolean(item.varintValue);
      continue;
    }
    if (type === KeyValueType.INT || type === KeyValueType.UINT || type === KeyValueType.LLINT) {
      result[key] = Number(item.varintValue ?? 0);
      continue;
    }
    if (type === KeyValueType.FLOAT) {
      result[key] = Number(item.floatValue ?? 0);
      continue;
    }
    if (type === KeyValueType.DOUBLE) {
      result[key] = Number(item.doubleValue ?? 0);
      continue;
    }
    if (type === KeyValueType.JSON_STRING) {
      if (typeof item.stringValue === 'string') {
        try {
          result[key] = JSON.parse(item.stringValue);
        } catch {
          result[key] = item.stringValue;
        }
      }
      continue;
    }
    result[key] = typeof item.stringValue === 'string' ? item.stringValue : '';
  }
  return result;
};
