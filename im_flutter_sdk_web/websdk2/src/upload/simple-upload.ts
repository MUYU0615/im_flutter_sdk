import { UploadError } from '../utils/errors';
import { ERROR_CODES } from '../utils/error-codes';
import { UPLOAD_TIMEOUT } from '../config/timeouts';
import type { UploadRequest, UploadResponsePayload } from './types';
import {
  appendUrlQueryParams,
  buildUploadResult,
  parseAppKey,
  toUploadChatType,
  toUploadImageType,
} from './utils';
import { logger } from '../utils/logger'; // 日志工具

export const simpleUpload = (
  request: UploadRequest
): Promise<ReturnType<typeof buildUploadResult>> => {
  // 小文件直传路径：一次 POST 上传文件，并把 029 新增的 md5 / imagetype / width / height 一并带上。
  return new Promise((resolve, reject) => {
    const {
      config,
      file,
      conversationId,
      conversationType,
      messageType,
      imageType,
      md5,
      width,
      height,
      fileName,
      fileType,
      fileSize,
    } = request;
    const { orgName, appName } = parseAppKey(config.appKey);
    const chatType = toUploadChatType(conversationType);
    const uploadUrl = appendUrlQueryParams(
      `${config.restBaseUrl}/${orgName}/${appName}/chatfiles`,
      {
        'chat-type': chatType,
        'chat-target': conversationId,
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
    const startTime = Date.now(); // 记录上传开始时间
    logger.debug('Upload request start', {
      operation: 'upload.simple',
      method: 'POST',
      fileSize,
      messageType,
    }); // 记录上传开始

    const xhr = new XMLHttpRequest();

    if (xhr.upload && request.callbacks?.onFileUploadProgress) {
      xhr.upload.addEventListener(
        'progress',
        event => {
          if (!event.lengthComputable) {
            request.callbacks?.onFileUploadProgress?.({ loaded: event.loaded });
            return;
          }
          const percent = event.total ? (event.loaded / event.total) * 100 : undefined;
          request.callbacks?.onFileUploadProgress?.({
            loaded: event.loaded,
            total: event.total,
            percent,
          });
        },
        false
      );
    }

    xhr.addEventListener(
      'abort',
      () => {
        logger.warn('Upload request aborted', { operation: 'upload.simple' }); // 记录上传中断
        request.callbacks?.onFileUploadCanceled?.();
        reject(
          new UploadError('Upload canceled', {
            code: ERROR_CODES.UPLOAD_ABORTED,
            details: {
              url: uploadUrl,
            },
          })
        );
      },
      false
    );

    xhr.addEventListener(
      'error',
      () => {
        logger.warn('Upload request failed', { operation: 'upload.simple' }); // 记录上传失败
        reject(
          new UploadError('Upload failed', {
            code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
            details: {
              url: uploadUrl,
            },
          })
        );
      },
      false
    );

    xhr.addEventListener(
      'timeout',
      () => {
        logger.warn('Upload request timeout', {
          operation: 'upload.simple',
          timeout: UPLOAD_TIMEOUT,
        }); // 记录上传超时
        reject(
          new UploadError('Upload timeout', {
            code: ERROR_CODES.UPLOAD_TIMEOUT,
            details: {
              url: uploadUrl,
              timeout: UPLOAD_TIMEOUT,
            },
          })
        );
      },
      false
    );

    xhr.addEventListener(
      'load',
      () => {
        try {
          const duration = Date.now() - startTime; // 计算上传耗时
          const response = JSON.parse(xhr.responseText) as UploadResponsePayload;
          // TODO: 详细处理错误
          if (xhr.status >= 400) {
            logger.warn('Upload response error', {
              operation: 'upload.simple',
              status: xhr.status,
              duration,
            }); // 记录响应错误
            throw new UploadError('Upload failed', {
              code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
              details: {
                status: xhr.status,
                response,
              },
            });
          }
          logger.debug('Upload response success', {
            operation: 'upload.simple',
            status: xhr.status,
            duration,
          }); // 记录响应成功
          const result = buildUploadResult({
            response,
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
          resolve(result);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
      false
    );

    xhr.timeout = UPLOAD_TIMEOUT;
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('restrict-access', 'true');
    xhr.setRequestHeader('Accept', '*/*');
    xhr.setRequestHeader('Authorization', `Bearer ${config.token}`);

    const formData = new FormData();
    formData.append('file', file);
    if (request.thumbnailWidth !== undefined) {
      formData.append('thumbnail-width', String(request.thumbnailWidth));
    }
    if (request.thumbnailHeight !== undefined) {
      formData.append('thumbnail-height', String(request.thumbnailHeight));
    }
    xhr.send(formData);
  });
};
