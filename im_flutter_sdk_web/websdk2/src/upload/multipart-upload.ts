import { UploadError } from '../utils/errors';
import { ERROR_CODES } from '../utils/error-codes';
import { UPLOAD_TIMEOUT } from '../config/timeouts';
import { DEFAULT_PART_SIZE, MAX_POOL, MULTIPART_THRESHOLD } from './constants';
import type { UploadRequest, UploadResponsePayload } from './types';
import {
  appendUrlQueryParams,
  buildUploadResult,
  parseAppKey,
  toUploadChatType,
  toUploadImageType,
} from './utils';
import { logger } from '../utils/logger'; // 日志工具

interface MultipartInitResponse {
  fileMaxSize: number;
  partMinSize: number;
  uuid: string;
}

const requestJson = async <T>(options: {
  // 发送 JSON 请求
  url: string; // 请求地址
  method: 'POST' | 'DELETE'; // 请求方法
  token: string; // 鉴权 token
  operation: string; // 操作标识
  headers?: Record<string, string>;
}): Promise<T> => {
  const controller = new AbortController(); // 创建中止控制器
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT); // 设置超时
  const startTime = Date.now(); // 记录开始时间
  logger.debug('Upload request start', { operation: options.operation, method: options.method }); // 记录请求开始
  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: 'application/json',
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });
    const duration = Date.now() - startTime; // 计算请求耗时
    if (!response.ok) {
      logger.warn('Upload response error', {
        operation: options.operation,
        method: options.method,
        status: response.status,
        duration,
      }); // 记录响应错误
      throw new UploadError('Upload request failed', {
        code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
        details: {
          url: options.url,
          status: response.status,
        },
      });
    }
    logger.debug('Upload response success', {
      operation: options.operation,
      method: options.method,
      status: response.status,
      duration,
    }); // 记录响应成功
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof UploadError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Upload request timeout', {
        operation: options.operation,
        method: options.method,
        timeout: UPLOAD_TIMEOUT,
      }); // 记录超时
      throw new UploadError('Upload timeout', {
        code: ERROR_CODES.UPLOAD_TIMEOUT,
        details: {
          url: options.url,
          timeout: UPLOAD_TIMEOUT,
        },
      });
    }
    logger.warn('Upload request failed', { operation: options.operation, method: options.method }); // 记录请求失败
    throw new UploadError('Upload request failed', {
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
      details: {
        url: options.url,
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseMultipartInit = (payload: UploadResponsePayload): MultipartInitResponse => {
  const entity = payload.entities?.[0] as Record<string, unknown> | undefined;
  const fileMaxSize = typeof entity?.file_upper_limit === 'number' ? entity.file_upper_limit : 0;
  const partMinSize =
    typeof entity?.part_lower_limit === 'number' ? entity.part_lower_limit : DEFAULT_PART_SIZE;
  const uuid = typeof entity?.uuid === 'string' ? entity.uuid : '';

  if (!uuid) {
    throw new UploadError('Multipart init failed', {
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
      details: {
        response: payload,
      },
    });
  }

  return {
    fileMaxSize,
    partMinSize,
    uuid,
  };
};

const uploadPart = (
  url: string,
  token: string,
  partNumber: string,
  part: Blob,
  onProgress?: (loaded: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startTime = Date.now(); // 记录分片开始时间
    logger.debug('Upload part start', { operation: 'upload.multipart.part', partNumber }); // 记录分片开始
    if (xhr.upload && onProgress) {
      xhr.upload.addEventListener(
        'progress',
        event => {
          onProgress(event.loaded);
        },
        false
      );
    }
    xhr.addEventListener(
      'abort',
      () => {
        logger.warn('Upload part aborted', { operation: 'upload.multipart.part', partNumber }); // 记录分片中断
        reject(
          new UploadError('Upload aborted', {
            code: ERROR_CODES.UPLOAD_ABORTED,
            details: {
              url,
              partNumber,
            },
          })
        );
      },
      false
    );
    xhr.addEventListener(
      'error',
      () => {
        logger.warn('Upload part failed', { operation: 'upload.multipart.part', partNumber }); // 记录分片失败
        reject(
          new UploadError('Upload part failed', {
            code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
            details: {
              url,
              partNumber,
            },
          })
        );
      },
      false
    );
    xhr.addEventListener(
      'timeout',
      () => {
        logger.warn('Upload part timeout', {
          operation: 'upload.multipart.part',
          partNumber,
          timeout: UPLOAD_TIMEOUT,
        }); // 记录分片超时
        reject(
          new UploadError('Upload timeout', {
            code: ERROR_CODES.UPLOAD_TIMEOUT,
            details: {
              url,
              partNumber,
            },
          })
        );
      },
      false
    );
    xhr.addEventListener(
      'load',
      () => {
        const duration = Date.now() - startTime; // 计算分片耗时
        if (xhr.status !== 200) {
          logger.warn('Upload part error', {
            operation: 'upload.multipart.part',
            partNumber,
            status: xhr.status,
            duration,
          }); // 记录分片错误
          reject(
            new UploadError('Upload part failed', {
              code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
              details: {
                url,
                partNumber,
                status: xhr.status,
              },
            })
          );
          return;
        }
        logger.debug('Upload part success', {
          operation: 'upload.multipart.part',
          partNumber,
          duration,
        }); // 记录分片成功
        resolve();
      },
      false
    );
    const formData = new FormData();
    formData.append('part_file', part);
    formData.append('part_number', partNumber);
    xhr.timeout = UPLOAD_TIMEOUT;
    xhr.open('PUT', url);
    xhr.setRequestHeader('restrict-access', 'true');
    xhr.setRequestHeader('Accept', '*/*');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};

export const multipartUpload = async (
  request: UploadRequest
): Promise<ReturnType<typeof buildUploadResult>> => {
  // 大文件分片路径：init 只负责拿 uuid/limit，真正的预检已在 AttachmentUploader 里提前完成。
  if (request.fileSize <= MULTIPART_THRESHOLD) {
    throw new UploadError('Multipart not required', {
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
      details: {
        reason: 'file size below threshold',
      },
    });
  }

  const {
    config,
    file,
    conversationId,
    conversationType,
    fileName,
    fileType,
    fileSize,
    messageType,
    imageType,
    md5,
    width,
    height,
  } = request;
  const { orgName, appName } = parseAppKey(config.appKey);

  const initUrl = `${config.restBaseUrl}/${orgName}/${appName}/sdk/chatfiles/part-upload`;
  let initPayload: UploadResponsePayload;
  try {
    initPayload = await requestJson<UploadResponsePayload>({
      url: initUrl,
      method: 'POST',
      token: config.token,
      operation: 'upload.multipart.init', // 初始化分片上传
    });
  } catch (error) {
    throw new UploadError('Multipart init failed', {
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
      details: {
        stage: 'init',
        cause: error,
        url: initUrl,
      },
    });
  }
  const initInfo = parseMultipartInit(initPayload);

  if (initInfo.fileMaxSize && fileSize > initInfo.fileMaxSize) {
    throw new UploadError('File size exceeds limit', {
      code: ERROR_CODES.UPLOAD_SIZE_EXCEEDED,
      details: {
        fileSize,
        maxSize: initInfo.fileMaxSize,
      },
    });
  }

  const partSize = initInfo.partMinSize || DEFAULT_PART_SIZE;
  const totalParts = Math.ceil(fileSize / partSize);
  const progressArr = Array.from({ length: totalParts }, (): number => 0); // 初始化进度数组

  const uploadUrl = `${config.restBaseUrl}/${orgName}/${appName}/sdk/chatfiles/part-upload/${initInfo.uuid}`;
  const tasks: Array<Promise<void>> = [];

  const updateProgress = (index: number, loaded: number): void => {
    progressArr[index] = loaded;
    const totalLoaded = progressArr.reduce((acc, current) => acc + current, 0);
    const percent = fileSize ? (totalLoaded / fileSize) * 100 : undefined;
    request.callbacks?.onFileUploadProgress?.({
      loaded: totalLoaded,
      total: fileSize,
      percent,
    });
  };

  for (let index = 0; index < totalParts; index += 1) {
    const start = index * partSize;
    const end = Math.min(fileSize, start + partSize);
    const part = file.slice(start, end);
    const partNumber = String(index + 1);

    const task = uploadPart(uploadUrl, config.token, partNumber, part, loaded =>
      updateProgress(index, loaded)
    ).finally(() => {
      const idx = tasks.indexOf(task);
      if (idx >= 0) {
        void tasks.splice(idx, 1); // 移除已完成任务
      }
    });

    tasks.push(task);

    if (tasks.length >= MAX_POOL) {
      await Promise.race(tasks);
    }
  }

  await Promise.all(tasks);

  const chatType = toUploadChatType(conversationType);
  const completeUrl = appendUrlQueryParams(
    `${config.restBaseUrl}/${orgName}/${appName}/sdk/chatfiles/part-upload/${initInfo.uuid}`,
    {
      'restrict-access': 'true',
      'chat-type': chatType,
      'chat-target': conversationId,
      'thumbnail-width': request.thumbnailWidth,
      'thumbnail-height': request.thumbnailHeight,
      md5: md5 ?? '',
      ...(messageType === 'image'
        ? {
            imageType: toUploadImageType(imageType),
            width,
            height,
          }
        : {}),
    }
  );

  const completePayload = await requestJson<UploadResponsePayload>({
    url: completeUrl,
    method: 'POST',
    token: config.token,
    operation: 'upload.multipart.complete', // 完成分片上传
  });

  const result = buildUploadResult({
    response: completePayload,
    restBaseUrl: config.restBaseUrl,
    orgName,
    appName,
    fileType,
    fileName,
    fallbackSize: fileSize,
    messageType,
    imageType,
    useCustomAttachmentUpload: config.useCustomAttachmentUpload,
  });
  request.callbacks?.onFileUploadComplete?.(result);
  return result;
};

export const multipartAbort = async (options: {
  restBaseUrl: string;
  orgName: string;
  appName: string;
  token: string;
  uuid: string;
}): Promise<void> => {
  const url = `${options.restBaseUrl}/${options.orgName}/${options.appName}/sdk/chatfiles/part-upload/${options.uuid}`;
  await requestJson({
    url,
    method: 'DELETE',
    token: options.token,
    operation: 'upload.multipart.abort', // 终止分片上传
  });
};
