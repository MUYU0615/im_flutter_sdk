import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/029-image-attachment-upload-optimization/contracts/image-attachment-upload.openapi.yaml'
);

describe('image-attachment-upload contract', () => {
  it('应包含发送图片与预检协商核心路径', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('openapi: 3.0.3');
    expect(content).toContain('/sdk/messages/image:');
    expect(content).toContain('/{orgName}/{appName}/chatfiles/exists:');
    expect(content).toContain('operationId: sendImageMessage');
    expect(content).toContain('operationId: precheckAttachment');
  });

  it('应约束上传 imageType、预检字段和图片视图字段', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('enum: [origin, large]');
    expect(content).toContain('name: md5');
    expect(content).toContain('name: imageType');
    expect(content).toContain('name: width');
    expect(content).toContain('name: height');
    expect(content).toContain('exists:');
    expect(content).toContain('exists-type:');
    expect(content).toContain('share-secret:');
    expect(content).toContain('localUrl:');
    expect(content).toContain('isOriginalImage:');
    expect(content).toContain('originalImageUrl:');
    expect(content).toContain('bigImageUrl:');
    expect(content).toContain('thumbnailUrl:');
  });
});
