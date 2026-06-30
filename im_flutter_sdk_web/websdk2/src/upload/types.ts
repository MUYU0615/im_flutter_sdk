import type {
  ChatConversationType,
  FileUploadProgress,
  FileUploadResult,
  ImageType,
  Message,
  MessageType,
  SendMessageOptions,
  CombineMessageBody,
  FileMessageBody,
  ImageMessageBody,
  VideoMessageBody,
  VoiceMessageBody,
} from '../types';
import type { ImageProcessor, NormalizedUploadSource, RequestAdapter } from '../platform';

export type AttachmentMessageType = Extract<
  MessageType,
  'image' | 'video' | 'voice' | 'file' | 'combine'
>;

export type ImagePolicyReason =
  | 'explicit-original'
  | 'default-large'
  | 'gif-force-origin'
  | 'large-fallback-origin';

export type ImageCandidateSourceKind = 'origin' | 'big';

export type AttachmentPrecheckThresholdType = 'image-origin' | 'image-big' | 'attachment';

export type AttachmentMessageBody =
  | ImageMessageBody
  | VideoMessageBody
  | VoiceMessageBody
  | FileMessageBody
  | CombineMessageBody;

export interface UploadConfig {
  restBaseUrl: string;
  token: string;
  appKey: string;
  useCustomAttachmentUpload?: boolean;
  requestAdapter?: RequestAdapter;
  imageProcessor?: ImageProcessor;
}

export interface UploadRequest {
  message: Message;
  file: File;
  conversationId: string;
  conversationType: ChatConversationType;
  messageType: AttachmentMessageType;
  imageType?: ImageType;
  md5?: string;
  width?: number;
  height?: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  callbacks?: SendMessageOptions;
  config: UploadConfig;
}

export interface UploadResponseEntity {
  uuid?: string;
  uri?: string;
  exists?: boolean;
  type?: string;
  ['exists-type']?: 'origin' | 'large';
  ['share-secret']?: string;
  ['file-metadata']?: Record<string, unknown>;
}

export interface UploadResponsePayload {
  entities?: UploadResponseEntity[];
  uri?: string;
}

export interface ImageSendPolicy {
  readonly resolvedImageType: ImageType;
  readonly reason: ImagePolicyReason;
}

export interface ResolvedImageCandidate {
  readonly imagePolicy: ImageSendPolicy;
  readonly sourceKind: ImageCandidateSourceKind;
  readonly fileInfo: NormalizedUploadSource;
  readonly width: number;
  readonly height: number;
  readonly localUrl?: string;
  readonly md5?: string;
}

export interface AttachmentPrecheckDecision {
  readonly shouldPrecheck: boolean;
  readonly thresholdType: AttachmentPrecheckThresholdType;
  readonly thresholdBytes: number;
  readonly actualBytes: number;
  readonly reason: 'below-threshold' | 'threshold-exceeded';
}

export interface AttachmentPrecheckResult {
  readonly uuid?: string;
  readonly exists: boolean;
  readonly existsType?: ImageType;
  readonly shareSecret?: string;
  readonly hit: boolean;
}

export type UploadProgressEvent = FileUploadProgress;
export type UploadResult = FileUploadResult;
