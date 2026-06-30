/**
 * ChatClient 参数与 DNSConfig 校验
 */

import { z } from './validator';

export const initConfigSchema = z
  .object({
    appKey: z.string().min(1, 'appKey is required'),
    enableUserInfoSync: z.boolean().optional(),
    enableSyncData: z.array(z.enum(['conversation', 'contact', 'group'])).optional(),
    enableDeliveryReceipt: z.boolean().optional(),
    syncConversationListConfig: z
      .object({
        includeEmpty: z.boolean().optional(),
      })
      .strict()
      .optional(),
    useCustomAttachmentUpload: z.boolean().optional(),
    useFixedDeviceId: z.boolean().optional(),
    deviceId: z.string().min(1, 'deviceId is required').optional(),
    serviceConfig: z
      .object({
        dnsConfigUrls: z.array(z.string().url()).nonempty().optional(),
        serverUrls: z
          .object({
            restApiUrl: z
              .string()
              .url('serviceConfig.serverUrls.restApiUrl must be a valid URL')
              .optional(),
            wsUrl: z
              .string()
              .url('serviceConfig.serverUrls.wsUrl must be a valid URL')
              .optional(),
            syncRestApiUrl: z
              .string()
              .url('serviceConfig.serverUrls.syncRestApiUrl must be a valid URL')
              .optional(),
            syncWsUrl: z
              .string()
              .url('serviceConfig.serverUrls.syncWsUrl must be a valid URL')
              .optional(),
          })
          .optional(),
      })
      .optional(),
    useReplacedMessageContents: z.boolean().optional(),
    customDeviceName: z.string().min(1, 'customDeviceName is required').optional(),
    customOsPlatform: z
      .number()
      .int('customOsPlatform must be an integer')
      .min(1, 'customOsPlatform must be between 1 and 100')
      .max(100, 'customOsPlatform must be between 1 and 100')
      .optional(),
    uiKitVersion: z.string().min(1, 'uiKitVersion is required').optional(),
    loginExtensionInfo: z
      .string()
      .max(1024, 'loginExtensionInfo must be at most 1024 characters')
      .optional(),
    managers: z.array(z.unknown()).optional(),
  })
  .passthrough()
  .superRefine((value, context) => {
    if ('enableHttpDns' in value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enableHttpDns'],
        message: 'enableHttpDns is removed; configure serviceConfig.serverUrls for fixed URLs',
      });
    }
    if ('dnsConfigUrls' in value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dnsConfigUrls'],
        message: 'dnsConfigUrls is moved to serviceConfig.dnsConfigUrls',
      });
    }
    if ('serverUrls' in value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['serverUrls'],
        message: 'serverUrls is moved to serviceConfig.serverUrls',
      });
    }
    if ('platformAdapterOptions' in value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['platformAdapterOptions'],
        message: 'platformAdapterOptions is internal; platform adapters are resolved automatically',
      });
    }
    if ('profileSync' in value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['profileSync'],
        message: 'profileSync is internal; profile sync scheduling uses SDK defaults',
      });
    }
    if ('cacheEncryptionMode' in value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cacheEncryptionMode'],
        message: 'cacheEncryptionMode is internal; cache encryption defaults to auto',
      });
    }
    if ('enableAutoSyncContacts' in value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enableAutoSyncContacts'],
        message: "enableAutoSyncContacts is removed; use enableSyncData: ['contact']",
      });
    }

    const serviceConfig =
      value.serviceConfig && typeof value.serviceConfig === 'object'
        ? value.serviceConfig
        : undefined;
    const serverUrls =
      serviceConfig?.serverUrls && typeof serviceConfig.serverUrls === 'object'
        ? serviceConfig.serverUrls
        : undefined;
    if (serviceConfig?.dnsConfigUrls && serverUrls) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['serviceConfig'],
        message: 'serviceConfig.dnsConfigUrls and serviceConfig.serverUrls cannot be used together',
      });
    }
    if (serverUrls) {
      if (!serverUrls?.restApiUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['serviceConfig', 'serverUrls', 'restApiUrl'],
          message: 'serviceConfig.serverUrls.restApiUrl is required when serverUrls is configured',
        });
      }
      if (!serverUrls?.wsUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['serviceConfig', 'serverUrls', 'wsUrl'],
          message: 'serviceConfig.serverUrls.wsUrl is required when serverUrls is configured',
        });
      }
    }
  });

export const authContextSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  token: z.string().min(1, 'token is required'),
});

export const renewTokenSchema = z.string().trim().min(1, 'token is required');

export const getRTCTokenInfoParamsSchema = z
  .object({
    channelName: z.string().trim().min(1, 'channelName is required').optional(),
  })
  .optional();

export const rtcUidListSchema = z
  .array(
    z
      .number({
        invalid_type_error: 'rtcUid must be a number',
      })
      .int('rtcUid must be an integer')
      .min(0, 'rtcUid must be greater than or equal to 0')
      .max(Number.MAX_SAFE_INTEGER, 'rtcUid must be a safe integer')
  )
  .nonempty('rtcUids is required')
  .transform((items) => {
    return Array.from(new Set(items));
  });

export const dnsHostSchema = z
  .object({
    protocol: z.string(),
    domain: z.string().optional(),
    ip: z.string().optional(),
    port: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export const dnsConfigResponseSchema = z
  .object({
    rest: z.object({
      hosts: z.array(dnsHostSchema).nonempty(),
    }),
    'msync-wx': z.object({
      hosts: z.array(dnsHostSchema).nonempty(),
    }),
    'sync-ws': z
      .object({
        hosts: z.array(dnsHostSchema).nonempty(),
      })
      .optional(),
    enableReportLogs: z.enum(['true', 'false']).optional(), // DNS 日志上报开关
  })
  .passthrough();
