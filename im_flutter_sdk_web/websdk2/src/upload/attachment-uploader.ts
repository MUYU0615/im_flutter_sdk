import type { ImageProcessor, RequestAdapter, UploadAdapter } from '../platform';
import { PLATFORM_ERROR_CODE, PLATFORM_ERROR_STAGE, createPlatformError } from '../platform/types';
import { mapUploadAdapterError } from '../platform/upload/upload-error-mapper';
import { createWebImageProcessor } from '../platform/image/web-image-processor';
import type {
  CombineMessageBody,
  FileMessageBody,
  ImageMessageBody,
  ImageType,
  Message,
  SendMessageOptions,
  VideoMessageBody,
  VoiceMessageBody,
} from '../types';
import { UPLOAD_TIMEOUT } from '../config/timeouts';
import { logger } from '../utils/logger';
import { ERROR_CODES } from '../utils/error-codes';
import { UploadError } from '../utils/errors';
import { attachmentFileStore } from './attachment-file-store';
import { copyMessageProfileVersionSidecar } from '../core/message/profile-sync/profile-version-sidecar';
import { MULTIPART_THRESHOLD } from './constants';
import { multipartUpload } from './multipart-upload';
import { simpleUpload } from './simple-upload';
import type {
  AttachmentMessageBody,
  AttachmentMessageType,
  AttachmentPrecheckResult,
  ResolvedImageCandidate,
  UploadConfig,
} from './types';
import {
  appendUrlQueryParams,
  IMAGE_TYPE_ORIGINAL,
  buildAttachmentPrecheckDecision,
  buildUploadResult,
  isRemoteUrl,
  normalizeAttachmentFile,
  parseAppKey,
  parseAttachmentPrecheckResult,
  resolveImageSendPolicy,
  shouldUploadByUrl,
  toUploadImageType,
  toUploadChatType,
} from './utils';

const DEFAULT_BIG_IMAGE_SHORT_EDGE = 720;
const DEFAULT_BIG_IMAGE_QUALITY = 0.85;
const webImageProcessor = createWebImageProcessor();

const isAttachmentType = (type: string): type is AttachmentMessageType => {
  return (
    type === 'image' ||
    type === 'video' ||
    type === 'voice' ||
    type === 'file' ||
    type === 'combine'
  );
};

type AttachmentUploadResult = ReturnType<typeof buildUploadResult>;

interface AttachmentUploaderConfig extends UploadConfig {
  uploadAdapter?: UploadAdapter;
}

interface PreparedAttachmentUpload {
  readonly body: AttachmentMessageBody;
  readonly fileInfo: ReturnType<typeof normalizeAttachmentFile>;
  readonly md5FileInfo: ReturnType<typeof normalizeAttachmentFile>;
  readonly imageType?: ImageType;
  readonly precheck?: AttachmentPrecheckResult;
  readonly originalWidth?: number;
  readonly originalHeight?: number;
}

export class AttachmentUploader {
  private config: AttachmentUploaderConfig | null;

  constructor(config?: AttachmentUploaderConfig) {
    this.config = config ?? null;
  }

  updateConfig(config: AttachmentUploaderConfig): void {
    this.config = config;
  }

  updateAuthToken(token: string): void {
    if (!this.config) {
      return;
    }
    this.config = {
      ...this.config,
      token,
    };
  }

  /**
   * 发送前统一准备附件消息。
   * 这里会串起 029 的主流程：解析本地文件、决定图片发送语义、按门槛做预检、命中则复用远端资源，未命中再进入实际上传。
   */
  async prepareMessage(message: Message, options?: SendMessageOptions): Promise<Message> {
    if (!isAttachmentType(message.type)) {
      return message;
    }

    const body = message.body as AttachmentMessageBody;
    if (this.hasUploadedRemoteResource(message.type, body)) {
      return message;
    }

    const url = this.resolveUploadUrl(message.type, body);
    const cachedFile = attachmentFileStore.get(message.msgLocalId);
    const hasFile = Boolean(cachedFile);

    if (!shouldUploadByUrl(url, hasFile)) {
      return message;
    }

    if (!cachedFile) {
      throw new UploadError('Attachment file is required', {
        code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
        details: {
          msgLocalId: message.msgLocalId,
          url,
        },
      });
    }

    if (!this.config?.restBaseUrl) {
      throw new UploadError('REST base url is required for upload', {
        code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
        details: {
          reason: 'restBaseUrl missing',
        },
      });
    }

    let prepared: PreparedAttachmentUpload;
    let uploadResult: AttachmentUploadResult;
    try {
      prepared = await this.prepareAttachmentUpload(message, body, cachedFile);
      uploadResult = prepared.precheck?.hit
        ? this.buildPrecheckedUploadResult(message, prepared, options)
        : await this.uploadAttachment(message, prepared, options);
    } catch (error) {
      const uploadError = mapUploadAdapterError(error);
      if (uploadError.code === ERROR_CODES.UPLOAD_ABORTED) {
        options?.onFileUploadCanceled?.();
      }
      options?.onFileUploadError?.(uploadError);
      throw uploadError;
    }

    return this.buildPreparedMessage(message, prepared, uploadResult);
  }

  private resolveUploadUrl(type: AttachmentMessageType, body: AttachmentMessageBody): string {
    if (type === 'image') {
      const imageBody = body as ImageMessageBody;
      return (
        (typeof imageBody.localUrl === 'string' ? imageBody.localUrl.trim() : '') ||
        (typeof imageBody.originalImageUrl === 'string' ? imageBody.originalImageUrl.trim() : '')
      );
    }

    return 'url' in body && typeof body.url === 'string' ? body.url.trim() : '';
  }

  private hasUploadedRemoteResource(
    type: AttachmentMessageType,
    body: AttachmentMessageBody
  ): boolean {
    if (type === 'image') {
      const imageBody = body as ImageMessageBody;
      return (
        typeof imageBody.originalImageUrl === 'string' && isRemoteUrl(imageBody.originalImageUrl)
      );
    }

    return 'url' in body && typeof body.url === 'string' && isRemoteUrl(body.url);
  }

  private async prepareAttachmentUpload(
    message: Message,
    body: AttachmentMessageBody,
    cachedFile: unknown
  ): Promise<PreparedAttachmentUpload> {
    // 先把缓存里的跨端文件对象标准化；图片会在此基础上继续做“大图候选资源”决策。
    const originalFileInfo = normalizeAttachmentFile(cachedFile as never, body);
    if (message.type !== 'image') {
      const precheck = await this.maybePrecheck(
        message,
        originalFileInfo,
        originalFileInfo,
        undefined
      );
      return {
        body,
        fileInfo: originalFileInfo,
        md5FileInfo: originalFileInfo,
        precheck,
      };
    }

    const imageBody = body as ImageMessageBody;
    const imageCandidate = await this.resolveImageCandidate(imageBody, originalFileInfo);
    const preparedBody: ImageMessageBody = {
      ...imageBody,
      width: imageCandidate.width,
      height: imageCandidate.height,
      isOriginalImage: imageCandidate.imagePolicy.resolvedImageType === IMAGE_TYPE_ORIGINAL,
    };
    const precheck = await this.maybePrecheck(
      message,
      imageCandidate.fileInfo,
      originalFileInfo,
      imageCandidate.imagePolicy.resolvedImageType
    );

    return {
      body: preparedBody,
      fileInfo: imageCandidate.fileInfo,
      md5FileInfo: originalFileInfo,
      imageType: imageCandidate.imagePolicy.resolvedImageType,
      precheck,
      originalWidth: imageBody.width,
      originalHeight: imageBody.height,
    };
  }

  private async resolveImageCandidate(
    body: ImageMessageBody,
    originalFileInfo: ReturnType<typeof normalizeAttachmentFile>
  ): Promise<ResolvedImageCandidate> {
    // 图片发送语义只决定“上传候选资源是谁”，不会改变后续是否分片上传的大小阈值。
    const imagePolicy = resolveImageSendPolicy(body);
    logger.debug('Image send policy resolved', {
      operation: 'upload.image.policy',
      reason: imagePolicy.reason,
      imageType: imagePolicy.resolvedImageType,
      isGif: body.isGif,
    });

    if (imagePolicy.resolvedImageType === IMAGE_TYPE_ORIGINAL) {
      let width = body.width;
      let height = body.height;
      if (!width || !height) {
        const processor = this.resolveImageProcessor(originalFileInfo.source.sourceType);
        const info = await processor.getImageInfo(originalFileInfo.source);
        width = info.width;
        height = info.height;
      }
      return {
        imagePolicy,
        sourceKind: 'origin',
        fileInfo: originalFileInfo,
        width,
        height,
      };
    }

    try {
      // 默认大图路径会在发送前即时生成压缩图；若失败则按 spec 回退为原图发送。
      const processor = this.resolveImageProcessor(originalFileInfo.source.sourceType);
      const generated = await processor.generateBigImage(originalFileInfo.source, {
        maxShortEdge: DEFAULT_BIG_IMAGE_SHORT_EDGE,
        quality: DEFAULT_BIG_IMAGE_QUALITY,
      });
      return {
        imagePolicy,
        sourceKind: 'big',
        fileInfo: {
          source: generated.source,
          fileName: generated.fileName ?? originalFileInfo.fileName,
          fileType: generated.fileType ?? originalFileInfo.fileType,
          fileSize: generated.fileSize ?? originalFileInfo.fileSize,
          webFile: generated.webFile,
        },
        width: generated.width,
        height: generated.height,
      };
    } catch (error) {
      logger.warn('Image big generation failed, fallback to original', {
        operation: 'upload.image.big-fallback',
        reason: imagePolicy.reason,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        imagePolicy: {
          resolvedImageType: IMAGE_TYPE_ORIGINAL,
          reason: 'large-fallback-origin',
        },
        sourceKind: 'origin',
        fileInfo: originalFileInfo,
        width: body.width ?? 0,
        height: body.height ?? 0,
      };
    }
  }

  private async maybePrecheck(
    message: Message,
    fileInfo: ReturnType<typeof normalizeAttachmentFile>,
    md5FileInfo: ReturnType<typeof normalizeAttachmentFile>,
    imageType: ImageType | undefined
  ): Promise<AttachmentPrecheckResult | undefined> {
    if (!isAttachmentType(message.type)) {
      return undefined;
    }

    // 预检和上传是两层独立决策：先看是否值得打 exists，再看最终走 simple 还是 multipart。
    const decision = buildAttachmentPrecheckDecision({
      messageType: message.type,
      fileSize: fileInfo.fileSize,
      imageType,
    });
    if (!decision.shouldPrecheck) {
      logger.debug('Attachment precheck skipped', {
        operation: 'upload.precheck.skip',
        messageType: message.type,
        imageType,
        fileSize: fileInfo.fileSize,
        thresholdBytes: decision.thresholdBytes,
      });
      return undefined;
    }

    const md5 = await this.computeMd5(md5FileInfo);
    const result = await this.requestPrecheck(message, decision.thresholdType, md5, imageType);
    logger.debug(result.hit ? 'Attachment precheck hit' : 'Attachment precheck miss', {
      operation: result.hit ? 'upload.precheck.hit' : 'upload.precheck.miss',
      messageType: message.type,
      imageType,
      exists: result.exists,
      existsType: result.existsType,
      uuid: result.uuid,
      hasShareSecret: typeof result.shareSecret === 'string' && result.shareSecret.length > 0,
    });
    return result;
  }

  private async computeMd5(fileInfo: ReturnType<typeof normalizeAttachmentFile>): Promise<string> {
    const processor = this.resolveImageProcessor(fileInfo.source.sourceType);
    return processor.computeMd5(fileInfo.source);
  }

  private resolveImageProcessor(sourceType: string): ImageProcessor {
    if (this.config?.imageProcessor) {
      return this.config.imageProcessor;
    }
    if (sourceType === 'web-file') {
      return webImageProcessor;
    }
    throw createPlatformError('Image processor capability is missing for current platform', {
      code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
      stage: PLATFORM_ERROR_STAGE.RUNTIME,
      retryable: false,
      details: {
        capability: 'imageProcessor',
        sourceType,
      },
    });
  }

  private async requestPrecheck(
    message: Message,
    thresholdType: string,
    md5: string,
    imageType: ImageType | undefined
  ): Promise<AttachmentPrecheckResult> {
    if (!this.config) {
      throw new UploadError('Upload config is required', {
        code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
      });
    }

    const { orgName, appName } = parseAppKey(this.config.appKey);
    // 029 之后预检只走 exists 接口，不再复用 multipart init。
    const url = appendUrlQueryParams(
      `${this.config.restBaseUrl}/${orgName}/${appName}/chatfiles/exists`,
      {
        md5,
        ...(message.type === 'image' ? { imageType: toUploadImageType(imageType) } : {}),
      }
    );
    const payload = await this.requestJson<{
      entities?: Array<Record<string, unknown>>;
      uri?: string;
    }>({
      url,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/json',
      },
      operation: 'upload.precheck',
    }).catch(error => {
      logger.warn('Attachment precheck failed, fallback to upload', {
        operation: 'upload.precheck.fail-open',
        messageType: message.type,
        imageType,
        thresholdType,
        md5,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    });

    if (!payload) {
      return {
        exists: false,
        hit: false,
      };
    }

    return parseAttachmentPrecheckResult(payload);
  }

  private async requestJson<T>(options: {
    url: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    operation: string;
  }): Promise<T> {
    if (this.config?.requestAdapter) {
      return this.requestByAdapter(this.config.requestAdapter, options);
    }
    return this.requestByFetch(options);
  }

  private async requestByAdapter<T>(
    adapter: RequestAdapter,
    options: {
      url: string;
      method: 'GET' | 'POST';
      headers: Record<string, string>;
      operation: string;
    }
  ): Promise<T> {
    const response = await adapter.request<T>({
      url: options.url,
      method: options.method,
      headers: options.headers,
      responseType: 'json',
      timeoutMs: UPLOAD_TIMEOUT,
    });
    if (response.status >= 400) {
      throw new UploadError('Upload precheck request failed', {
        code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
        details: {
          url: options.url,
          status: response.status,
          operation: options.operation,
        },
      });
    }
    return response.data;
  }

  private async requestByFetch<T>(options: {
    url: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    operation: string;
  }): Promise<T> {
    if (typeof fetch !== 'function') {
      throw createPlatformError('Request capability is missing for current platform', {
        code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
        stage: PLATFORM_ERROR_STAGE.REQUEST,
        retryable: false,
        details: {
          operation: options.operation,
        },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);
    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new UploadError('Upload precheck request failed', {
          code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
          details: {
            url: options.url,
            status: response.status,
            operation: options.operation,
          },
        });
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildPrecheckedUploadResult(
    message: Message,
    prepared: PreparedAttachmentUpload,
    options?: SendMessageOptions
  ): AttachmentUploadResult {
    if (!this.config || !prepared.precheck) {
      throw new UploadError('Precheck result is required', {
        code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
      });
    }
    if (!prepared.precheck.uuid) {
      throw new UploadError('Precheck hit missing uuid', {
        code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
        details: {
          precheck: prepared.precheck,
        },
      });
    }
    if (!isAttachmentType(message.type)) {
      throw new UploadError('Attachment message type is invalid', {
        code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
        details: {
          messageType: message.type,
        },
      });
    }
    const { orgName, appName } = parseAppKey(this.config.appKey);
    const effectivePrecheckedImageType =
      message.type === 'image' ? (prepared.precheck.existsType ?? prepared.imageType) : undefined;
    const effectiveFileInfo =
      message.type === 'image' && effectivePrecheckedImageType === IMAGE_TYPE_ORIGINAL
        ? prepared.md5FileInfo
        : prepared.fileInfo;
    const effectiveWidth =
      message.type === 'image' && effectivePrecheckedImageType === IMAGE_TYPE_ORIGINAL
        ? prepared.originalWidth
        : message.type === 'image'
          ? (prepared.body as ImageMessageBody).width
          : undefined;
    const effectiveHeight =
      message.type === 'image' && effectivePrecheckedImageType === IMAGE_TYPE_ORIGINAL
        ? prepared.originalHeight
        : message.type === 'image'
          ? (prepared.body as ImageMessageBody).height
          : undefined;
    const response = {
      entities: [
        {
          uuid: prepared.precheck.uuid,
          ...(prepared.precheck.shareSecret
            ? { 'share-secret': prepared.precheck.shareSecret }
            : {}),
        },
      ],
    };
    // 命中秒传后，统一走和真实上传相同的结果组装函数，保证图片 URL/secret 回写语义一致。
    const result = buildUploadResult({
      response,
      restBaseUrl: this.config.restBaseUrl,
      orgName,
      appName,
      fileType: effectiveFileInfo.fileType,
      fileName: effectiveFileInfo.fileName,
      fallbackSize: effectiveFileInfo.fileSize,
      messageType: message.type,
      imageType: effectivePrecheckedImageType,
      width: effectiveWidth,
      height: effectiveHeight,
      useCustomAttachmentUpload: this.config.useCustomAttachmentUpload,
    });
    options?.onFileUploadComplete?.(result);
    return result;
  }

  private async uploadAttachment(
    message: Message,
    prepared: PreparedAttachmentUpload,
    options?: SendMessageOptions
  ): Promise<AttachmentUploadResult> {
    if (!this.config) {
      throw new UploadError('Upload config is required', {
        code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
      });
    }

    if (!isAttachmentType(message.type)) {
      throw new UploadError('Attachment message type is invalid', {
        code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
        details: {
          messageType: message.type,
        },
      });
    }
    const messageType = message.type;
    // 上传请求里的 md5 固定基于原始文件计算；图片 width/height 则跟随最终上传候选资源。
    const uploadMetadata = await this.resolveUploadMetadata(messageType, prepared);

    if (this.config.uploadAdapter) {
      return this.uploadByAdapter(
        this.config.uploadAdapter,
        message,
        prepared,
        uploadMetadata,
        options
      );
    }

    if (!prepared.fileInfo.webFile) {
      throw new UploadError('Upload adapter is required for non-web file source', {
        code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
        details: {
          sourceType: prepared.fileInfo.source.sourceType,
        },
      });
    }

    const uploadRequest = {
      message,
      file: prepared.fileInfo.webFile,
      conversationId: message.conversationId,
      conversationType: message.conversationType,
      messageType,
      imageType: prepared.imageType,
      md5: uploadMetadata.md5,
      width: uploadMetadata.width,
      height: uploadMetadata.height,
      fileName: prepared.fileInfo.fileName,
      fileType: prepared.fileInfo.fileType,
      fileSize: prepared.fileInfo.fileSize,
      thumbnailWidth: this.resolveThumbnailWidth(messageType, prepared.body),
      thumbnailHeight: this.resolveThumbnailHeight(messageType, prepared.body),
      callbacks: options,
      config: this.config,
    };

    // 是否分片上传只由当前候选资源大小决定，不受 imageType=original|large 语义直接影响。
    if (prepared.fileInfo.fileSize > MULTIPART_THRESHOLD) {
      try {
        return await multipartUpload(uploadRequest);
      } catch (error) {
        const details = error instanceof UploadError ? error.details : undefined;
        if (details && typeof details === 'object' && details.stage === 'init') {
          return simpleUpload(uploadRequest);
        }
        throw error;
      }
    }

    return simpleUpload(uploadRequest);
  }

  private async uploadByAdapter(
    adapter: UploadAdapter,
    message: Message,
    prepared: PreparedAttachmentUpload,
    uploadMetadata: {
      md5: string;
      width?: number;
      height?: number;
    },
    options?: SendMessageOptions
  ): Promise<AttachmentUploadResult> {
    if (!this.config) {
      throw new UploadError('Upload config is required', {
        code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
      });
    }

    const { orgName, appName } = parseAppKey(this.config.appKey);
    const chatType = toUploadChatType(message.conversationType);
    if (!isAttachmentType(message.type)) {
      throw new UploadError('Attachment message type is invalid', {
        code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
        details: {
          messageType: message.type,
        },
      });
    }
    const messageType = message.type;
    const uploadUrl = appendUrlQueryParams(
      `${this.config.restBaseUrl}/${orgName}/${appName}/chatfiles`,
      {
        'chat-type': chatType,
        'chat-target': message.conversationId,
        md5: uploadMetadata.md5,
        ...(messageType === 'image'
          ? {
              imageType: toUploadImageType(prepared.imageType),
              width: uploadMetadata.width,
              height: uploadMetadata.height,
            }
          : {}),
      }
    );

    const fields: Record<string, string> = {};
    const headers: Record<string, string> = {
      'restrict-access': 'true',
      Accept: '*/*',
      Authorization: `Bearer ${this.config.token}`,
    };
    const thumbnailWidth = this.resolveThumbnailWidth(messageType, prepared.body);
    const thumbnailHeight = this.resolveThumbnailHeight(messageType, prepared.body);
    if (thumbnailWidth !== undefined) {
      fields['thumbnail-width'] = String(thumbnailWidth);
    }
    if (thumbnailHeight !== undefined) {
      fields['thumbnail-height'] = String(thumbnailHeight);
    }

    const uploadResponse = await adapter.upload({
      url: uploadUrl,
      headers,
      source: prepared.fileInfo.source,
      fields,
      onProgress: progress => {
        options?.onFileUploadProgress?.(progress);
      },
    });

    if (uploadResponse.status >= 400) {
      const body = uploadResponse.body ?? '';
      const code =
        uploadResponse.status === 413
          ? ERROR_CODES.FILE_TOO_LARGE
          : typeof body === 'string' && body.includes('content improper')
            ? ERROR_CODES.FILE_CONTENT_IMPROPER
            : ERROR_CODES.UPLOAD_REQUEST_FAILED;
      throw new UploadError('Upload failed', {
        code,
        details: {
          status: uploadResponse.status,
          response: uploadResponse.body,
        },
      });
    }

    let payload: { entities?: Array<Record<string, unknown>>; uri?: string };
    try {
      payload = JSON.parse(uploadResponse.body) as {
        entities?: Array<Record<string, unknown>>;
        uri?: string;
      };
    } catch (error) {
      throw new UploadError('Upload response parse failed', {
        code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
        details: {
          response: uploadResponse.body,
          cause: error instanceof Error ? error.message : String(error),
        },
      });
    }

    const result = buildUploadResult({
      response: payload,
      restBaseUrl: this.config.restBaseUrl,
      orgName,
      appName,
      fileType: prepared.fileInfo.fileType,
      fileName: prepared.fileInfo.fileName,
      fallbackSize: prepared.fileInfo.fileSize,
      messageType,
      imageType: prepared.imageType,
      width: uploadMetadata.width,
      height: uploadMetadata.height,
      useCustomAttachmentUpload: this.config.useCustomAttachmentUpload,
    });
    options?.onFileUploadComplete?.(result);
    return result;
  }

  private buildPreparedMessage(
    message: Message,
    prepared: PreparedAttachmentUpload,
    uploadResult: AttachmentUploadResult
  ): Message {
    if (message.type === 'image') {
      const imageBody = prepared.body as ImageMessageBody;
      const preparedMessage: Message = {
        ...message,
        body: {
          // 发送完成后保留本地 localUrl，并把远端原图/大图/缩略图视图统一回写到图片消息体。
          ...imageBody,
          isOriginalImage: uploadResult.isOriginalImage ?? imageBody.isOriginalImage,
          originalImageUrl: uploadResult.originalImageUrl ?? imageBody.originalImageUrl,
          bigImageUrl: uploadResult.bigImageUrl ?? imageBody.bigImageUrl,
          secret: uploadResult.secret ?? imageBody.secret,
          fileLength: uploadResult.fileLength ?? imageBody.fileLength ?? prepared.fileInfo.fileSize,
          filetype: uploadResult.filetype ?? imageBody.filetype,
          filename: uploadResult.filename ?? imageBody.filename,
          thumbnailUrl: uploadResult.thumbnailUrl ?? imageBody.thumbnailUrl,
          width: uploadResult.width ?? imageBody.width,
          height: uploadResult.height ?? imageBody.height,
        },
      };
      copyMessageProfileVersionSidecar(message, preparedMessage);
      return preparedMessage;
    }

    if (message.type === 'video') {
      const videoBody = prepared.body as VideoMessageBody;
      const preparedMessage: Message = {
        ...message,
        body: {
          ...videoBody,
          url: uploadResult.url,
          secret: uploadResult.secret ?? videoBody.secret,
          fileLength: uploadResult.fileLength ?? videoBody.fileLength ?? prepared.fileInfo.fileSize,
          filetype: uploadResult.filetype ?? videoBody.filetype,
          filename: uploadResult.filename ?? videoBody.filename,
          thumbnailUrl: uploadResult.thumbnailUrl ?? videoBody.thumbnailUrl,
        },
      };
      copyMessageProfileVersionSidecar(message, preparedMessage);
      return preparedMessage;
    }

    if (message.type === 'voice') {
      const voiceBody = prepared.body as VoiceMessageBody;
      const preparedMessage: Message = {
        ...message,
        body: {
          ...voiceBody,
          url: uploadResult.url,
          secret: uploadResult.secret ?? voiceBody.secret,
          fileLength: uploadResult.fileLength ?? voiceBody.fileLength ?? prepared.fileInfo.fileSize,
          filetype: uploadResult.filetype ?? voiceBody.filetype,
          filename: uploadResult.filename ?? voiceBody.filename,
        },
      };
      copyMessageProfileVersionSidecar(message, preparedMessage);
      return preparedMessage;
    }

    if (message.type === 'combine') {
      const combineBody = prepared.body as CombineMessageBody;
      const preparedMessage: Message = {
        ...message,
        combineLevel: combineBody.combineLevel,
        body: {
          ...combineBody,
          url: uploadResult.url,
          secret: uploadResult.secret ?? combineBody.secret,
          fileLength:
            uploadResult.fileLength ?? combineBody.fileLength ?? prepared.fileInfo.fileSize,
          filetype: uploadResult.filetype ?? combineBody.filetype,
          filename: uploadResult.filename ?? combineBody.filename,
        },
      };
      copyMessageProfileVersionSidecar(message, preparedMessage);
      return preparedMessage;
    }

    const fileBody = prepared.body as FileMessageBody;
    const preparedMessage: Message = {
      ...message,
      body: {
        ...fileBody,
        url: uploadResult.url,
        secret: uploadResult.secret ?? fileBody.secret,
        fileLength: uploadResult.fileLength ?? fileBody.fileLength ?? prepared.fileInfo.fileSize,
        filetype: uploadResult.filetype ?? fileBody.filetype,
        filename: uploadResult.filename ?? fileBody.filename,
      },
    };
    copyMessageProfileVersionSidecar(message, preparedMessage);
    return preparedMessage;
  }

  private resolveThumbnailWidth(
    type: AttachmentMessageType,
    body: AttachmentMessageBody
  ): number | undefined {
    if (type === 'video') {
      const width = 'width' in body ? body.width : undefined;
      return typeof width === 'number' && width > 0 ? width : undefined;
    }
    return undefined;
  }

  private resolveThumbnailHeight(
    type: AttachmentMessageType,
    body: AttachmentMessageBody
  ): number | undefined {
    if (type === 'video') {
      const height = 'height' in body ? body.height : undefined;
      return typeof height === 'number' && height > 0 ? height : undefined;
    }
    return undefined;
  }

  private async resolveUploadMetadata(
    type: AttachmentMessageType,
    prepared: PreparedAttachmentUpload
  ): Promise<{
    md5: string;
    width?: number;
    height?: number;
  }> {
    // 预检和上传共用同一份原图 md5，避免“压缩产物 md5”与服务端资源复用语义脱节。
    const md5 = await this.computeMd5(prepared.md5FileInfo);
    const body = prepared.body as ImageMessageBody;
    const width =
      type === 'image' && typeof body.width === 'number' && body.width > 0 ? body.width : undefined;
    const height =
      type === 'image' && typeof body.height === 'number' && body.height > 0
        ? body.height
        : undefined;
    return {
      md5,
      width,
      height,
    };
  }
}
