import type { InitConfig } from '../../src/types/chat-client';
import type { MiniAppInitForm, MiniAppLoginForm } from './env';

export const validateInitForm = (form: MiniAppInitForm): string | null => {
  if (!form.appKey.trim()) {
    return '请输入 AppKey';
  }
  if (!form.restApiUrl.trim()) {
    return '请输入 REST 地址';
  }
  if (!form.wsUrl.trim()) {
    return '请输入 WebSocket 地址';
  }
  return null;
};

export const validateLoginForm = (form: MiniAppLoginForm): string | null => {
  if (!form.userId.trim()) {
    return '请输入用户 ID';
  }
  if (!form.token.trim()) {
    return '请输入 Token';
  }
  return null;
};

export const buildInitSignature = (form: MiniAppInitForm): string => {
  return JSON.stringify({
    appKey: form.appKey.trim(),
    restApiUrl: form.restApiUrl.trim(),
    wsUrl: form.wsUrl.trim(),
  });
};

export const buildInitConfig = (form: MiniAppInitForm): InitConfig => {
  return {
    appKey: form.appKey.trim(),
    enableSyncData: [],
    serviceConfig: {
      serverUrls: {
        restApiUrl: form.restApiUrl.trim(),
        wsUrl: form.wsUrl.trim(),
      },
    },
  };
};
