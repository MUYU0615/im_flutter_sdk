/**
 * 消息本地 ID 与本地 URL 生成工具
 */

import type { CompatibleFile, MiniAppFile } from '../types'; // 引入文件类型

const hasCreateObjectUrl = (): boolean => { // 判断是否支持 ObjectURL
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'; // 检查 API 可用性
};

const isBrowserFile = (file: CompatibleFile): file is File => { // 判断是否为 H5 File
  return typeof File !== 'undefined' && file instanceof File; // 使用 instanceof 校验
};

const isMiniAppFile = (file: CompatibleFile): file is MiniAppFile => { // 判断是否为小程序文件对象
  return typeof file === 'object' && file !== null && 'path' in file && typeof file.path === 'string'; // 校验 path 字段
};

/**
 * 生成本地可用的文件 URL
 */
export const createLocalFileUrl = (file: CompatibleFile): string | undefined => { // 生成本地 URL
  if (isBrowserFile(file)) { // H5 File 分支
    if (!hasCreateObjectUrl()) { // 检查是否支持 ObjectURL
      return undefined; // 无法生成
    }
    return URL.createObjectURL(file); // 生成本地 URL
  }

  if (isMiniAppFile(file)) { // 小程序文件分支
    return file.path; // 使用本地 path
  }

  return undefined; // 无法识别的文件对象
};

/**
 * 生成本地消息 ID
 */
export const generateMsgLocalId = (): string => { // 生成消息 ID
  const cryptoApi = globalThis.crypto; // 读取全局 crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') { // 优先使用 randomUUID
    return cryptoApi.randomUUID(); // 返回 UUID
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`; // 回退到时间戳 + 随机数
};
