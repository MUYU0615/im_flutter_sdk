import { describe, expect, it } from 'vitest';

import {
  ATTACHMENT_PRECHECK_THRESHOLD,
  IMAGE_PRECHECK_ORIGINAL_THRESHOLD,
  IMAGE_TYPE_LARGE,
  IMAGE_TYPE_ORIGINAL,
  buildAttachmentPrecheckDecision,
  deriveImageUrls,
  parseAttachmentPrecheckResult,
  resolveImageSendPolicy,
} from '@/upload/utils';

describe('image upload utils', () => {
  it('默认图片消息应解析为大图发送策略', () => {
    const policy = resolveImageSendPolicy({
      localUrl: 'blob:image',
      filename: 'image.png',
      filetype: 'image/png',
      width: 1080,
      height: 1920,
      isGif: false,
      isOriginalImage: false,
    });

    expect(policy).toEqual({
      resolvedImageType: IMAGE_TYPE_LARGE,
      reason: 'default-large',
    });
  });

  it('GIF 应强制走原图发送策略', () => {
    const policy = resolveImageSendPolicy({
      localUrl: 'blob:image',
      filename: 'image.gif',
      filetype: 'image/gif',
      width: 320,
      height: 240,
      isGif: true,
      isOriginalImage: false,
    });

    expect(policy).toEqual({
      resolvedImageType: IMAGE_TYPE_ORIGINAL,
      reason: 'gif-force-origin',
    });
  });

  it('应按原图与大图分别计算预检门槛', () => {
    const originalDecision = buildAttachmentPrecheckDecision({
      messageType: 'image',
      imageType: IMAGE_TYPE_ORIGINAL,
      fileSize: IMAGE_PRECHECK_ORIGINAL_THRESHOLD + 1,
    });
    const bigDecision = buildAttachmentPrecheckDecision({
      messageType: 'image',
      imageType: IMAGE_TYPE_LARGE,
      fileSize: ATTACHMENT_PRECHECK_THRESHOLD + 1,
    });

    expect(originalDecision.shouldPrecheck).toBe(true);
    expect(originalDecision.thresholdType).toBe('image-origin');
    expect(originalDecision.thresholdBytes).toBe(IMAGE_PRECHECK_ORIGINAL_THRESHOLD);
    expect(bigDecision.shouldPrecheck).toBe(true);
    expect(bigDecision.thresholdType).toBe('image-big');
    expect(bigDecision.thresholdBytes).toBe(ATTACHMENT_PRECHECK_THRESHOLD);
  });

  it('应根据规范派生图片视图地址', () => {
    expect(deriveImageUrls('https://example.com/chatfiles/uuid-1')).toEqual({
      originalImageUrl: 'https://example.com/chatfiles/uuid-1',
      bigImageUrl: 'https://example.com/chatfiles/uuid-1?size=large',
      thumbnailUrl: 'https://example.com/chatfiles/uuid-1?size=small',
    });

    expect(deriveImageUrls('https://example.com/chatfiles/uuid-1?size=large')).toEqual({
      originalImageUrl: 'https://example.com/chatfiles/uuid-1',
      bigImageUrl: 'https://example.com/chatfiles/uuid-1?size=large',
      thumbnailUrl: 'https://example.com/chatfiles/uuid-1?size=small',
    });
  });

  it('自有上传模式下不应自动派生 large/thumbnail 地址', () => {
    expect(
      deriveImageUrls('https://cdn.example.com/custom/image.jpg?token=1', {
        deriveVariants: false,
      })
    ).toEqual({
      originalImageUrl: 'https://cdn.example.com/custom/image.jpg?token=1',
    });
  });

  it('exists=true 且 uuid 存在时才算预检命中，share-secret 仅为可选字段', () => {
    expect(
      parseAttachmentPrecheckResult({
        entities: [
          {
            exists: true,
            uuid: 'uuid-1',
            'share-secret': 'secret-1',
            'exists-type': 'origin',
          },
        ],
      })
    ).toMatchObject({
      hit: true,
      existsType: 'original',
    });

    expect(
      parseAttachmentPrecheckResult({
        entities: [
          {
            exists: true,
            uuid: 'uuid-2',
          },
        ],
      }).hit
    ).toBe(true);

    expect(
      parseAttachmentPrecheckResult({
        entities: [
          {
            exists: false,
            type: 'chatfile',
            'exists-type': 'large',
          },
        ],
      }).hit
    ).toBe(false);
  });
});
