import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMiniAppImageProcessor } from '@/platform/image/miniapp-image-processor';
import { createWebImageProcessor } from '@/platform/image/web-image-processor';

describe('web image processor capability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('getImageInfo 应优先使用 createImageBitmap', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 640,
        height: 320,
        close,
      }))
    );

    const processor = createWebImageProcessor();
    const file = new File(['abc'], 'demo.png', { type: 'image/png' });

    await expect(
      processor.getImageInfo({
        sourceType: 'web-file',
        file,
        name: 'demo.png',
        mimeType: 'image/png',
        size: file.size,
      })
    ).resolves.toEqual({
      width: 640,
      height: 320,
      mimeType: 'image/png',
      fileSize: file.size,
      isGif: false,
    });

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('generateBigImage 应通过 canvas 生成缩略图并回退为 jpeg', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 1200,
        height: 600,
        close: vi.fn(),
      }))
    );
    vi.stubGlobal('OffscreenCanvas', undefined);
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
        })),
        toBlob: (callback: (blob: Blob | null) => void): void => {
          callback(new Blob(['big'], { type: 'image/jpeg' }));
        },
      };
      return canvas as unknown as HTMLCanvasElement;
    });

    const processor = createWebImageProcessor();
    const file = new File(['abc'], 'demo.heic', { type: 'image/heic' });

    const result = await processor.generateBigImage(
      {
        sourceType: 'web-file',
        file,
        name: 'demo.heic',
        mimeType: 'image/heic',
        size: file.size,
      },
      {
        maxShortEdge: 300,
        quality: 0.8,
      }
    );

    expect(result.width).toBe(600);
    expect(result.height).toBe(300);
    expect(result.fileType).toBe('image/jpeg');
    expect(result.source.mimeType).toBe('image/jpeg');
  });

  it('缺少 2d context 或 FileReader 失败时应抛平台错误', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 100,
        height: 100,
        close: vi.fn(),
      }))
    );
    vi.stubGlobal('OffscreenCanvas', undefined);
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      return {
        getContext: () => null,
      } as unknown as HTMLCanvasElement;
    });

    const processor = createWebImageProcessor();
    const file = new File(['abc'], 'demo.png', { type: 'image/png' });

    await expect(
      processor.generateBigImage(
        {
          sourceType: 'web-file',
          file,
          name: 'demo.png',
          mimeType: 'image/png',
          size: file.size,
        },
        {
          maxShortEdge: 50,
          quality: 0.8,
        }
      )
    ).rejects.toMatchObject({
      code: 'PLATFORM_MISSING_CAPABILITY',
    });

    const blob = new Blob(['abc'], { type: 'text/plain' });
    Object.defineProperty(blob, 'arrayBuffer', {
      value: undefined,
      configurable: true,
    });
    class ErrorFileReader {
      public onerror: (() => void) | null = null;
      public onload: (() => void) | null = null;
      public result: ArrayBuffer | null = null;

      readAsArrayBuffer(): void {
        this.onerror?.();
      }
    }
    vi.stubGlobal('FileReader', ErrorFileReader);

    await expect(
      createWebImageProcessor().computeMd5({
        sourceType: 'web-file',
        file: blob,
        name: 'abc.txt',
        mimeType: 'text/plain',
        size: blob.size,
      })
    ).rejects.toMatchObject({
      code: 'PLATFORM_UPLOAD_FAILED',
    });
  });

  it('computeMd5 应返回稳定摘要', async () => {
    const processor = createWebImageProcessor();
    const file = new File(['abc'], 'abc.txt', { type: 'text/plain' });

    const result = await processor.computeMd5({
      sourceType: 'web-file',
      file,
      name: 'abc.txt',
      mimeType: 'text/plain',
      size: file.size,
    });

    expect(result).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it('blob.arrayBuffer 不可用时应回退到 FileReader', async () => {
    const processor = createWebImageProcessor();
    const blob = new Blob(['abc'], { type: 'text/plain' });
    Object.defineProperty(blob, 'arrayBuffer', {
      value: undefined,
      configurable: true,
    });

    class MockFileReader {
      public result: ArrayBuffer | null = null;
      public onerror: (() => void) | null = null;
      public onload: (() => void) | null = null;

      readAsArrayBuffer(): void {
        const buffer = new ArrayBuffer(3);
        new Uint8Array(buffer).set([97, 98, 99]);
        this.result = buffer;
        this.onload?.();
      }
    }

    vi.stubGlobal('FileReader', MockFileReader);

    const result = await processor.computeMd5({
      sourceType: 'web-file',
      file: blob,
      name: 'abc.txt',
      mimeType: 'text/plain',
      size: blob.size,
    });

    expect(result).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it('非 web-file 源应抛出缺失能力错误', async () => {
    const processor = createWebImageProcessor();

    await expect(
      processor.computeMd5({
        sourceType: 'miniapp-path',
        path: '/tmp/demo.png',
        name: 'demo.png',
        mimeType: 'image/png',
        size: 10,
      })
    ).rejects.toMatchObject({
      code: 'PLATFORM_MISSING_CAPABILITY',
    });
  });
});

describe('miniapp image processor capability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('getImageInfo 应归一化 mimeType 与 gif 标识', async () => {
    const processor = createMiniAppImageProcessor({
      getImageInfo(options) {
        options.success({
          width: 300,
          height: 200,
          type: 'gif',
        });
      },
    });

    await expect(
      processor.getImageInfo({
        sourceType: 'miniapp-path',
        path: '/tmp/demo.gif',
        name: 'demo.gif',
        mimeType: undefined,
        size: 8,
      })
    ).resolves.toEqual({
      width: 300,
      height: 200,
      mimeType: 'image/gif',
      fileSize: 8,
      isGif: true,
    });
  });

  it('computeMd5 应基于小程序文件系统返回稳定摘要', async () => {
    const processor = createMiniAppImageProcessor({
      getImageInfo(options) {
        options.success({
          width: 320,
          height: 240,
          type: 'png',
        });
      },
      getFileSystemManager() {
        return {
          readFile(options) {
            options.success({
              data: new Uint8Array([1, 2, 3, 4]).buffer,
            });
          },
          getFileInfo(options) {
            options.success({
              size: 4,
            });
          },
        };
      },
    });

    const result = await processor.computeMd5({
      sourceType: 'miniapp-path',
      path: '/tmp/demo.png',
      name: 'demo.png',
      mimeType: 'image/png',
      size: 4,
    });

    expect(result).toBe('08d6c05a21512a79a1dfeb9d2a8f262f');
  });

  it('generateBigImage 应复用小程序压缩与文件信息能力', async () => {
    const processor = createMiniAppImageProcessor({
      getImageInfo(options) {
        if (options.src.endsWith('.compressed')) {
          options.success({
            width: 720,
            height: 1280,
            type: 'jpeg',
          });
          return;
        }
        options.success({
          width: 1080,
          height: 1920,
          type: 'png',
        });
      },
      compressImage(options) {
        options.success?.({
          tempFilePath: `${options.src}.compressed`,
        });
      },
      getFileSystemManager() {
        return {
          readFile(options) {
            options.success({
              data: new Uint8Array([1, 2, 3, 4]).buffer,
            });
          },
          getFileInfo(options) {
            options.success({
              size: options.filePath.endsWith('.compressed') ? 3 : 4,
            });
          },
        };
      },
    });

    const result = await processor.generateBigImage(
      {
        sourceType: 'miniapp-path',
        path: '/tmp/demo.png',
        name: 'demo.png',
        mimeType: 'image/png',
        size: 4,
      },
      {
        maxShortEdge: 720,
        quality: 0.8,
      }
    );

    expect(result).toEqual({
      source: {
        sourceType: 'miniapp-path',
        path: '/tmp/demo.png.compressed',
        name: 'demo.png',
        mimeType: 'image/jpeg',
        size: 3,
      },
      width: 720,
      height: 1280,
      fileName: 'demo.png',
      fileType: 'image/jpeg',
      fileSize: 3,
    });
  });

  it('缺少 compressImage、文件系统或运行时失败时应抛出稳定平台错误', async () => {
    const source = {
      sourceType: 'miniapp-path' as const,
      path: '/tmp/demo.png',
      name: 'demo.png',
      mimeType: 'image/png',
      size: 4,
    };

    await expect(
      createMiniAppImageProcessor({
        getImageInfo(options) {
          options.success({
            width: 100,
            height: 100,
            type: 'png',
          });
        },
      }).generateBigImage(source, {
        maxShortEdge: 50,
        quality: 0.6,
      })
    ).rejects.toMatchObject({
      code: 'PLATFORM_MISSING_CAPABILITY',
    });

    await expect(
      createMiniAppImageProcessor({
        getImageInfo(options) {
          options.fail?.({ errMsg: 'read fail' });
        },
      }).getImageInfo(source)
    ).rejects.toMatchObject({
      code: 'PLATFORM_UPLOAD_FAILED',
    });

    await expect(
      createMiniAppImageProcessor({
        getImageInfo(options) {
          options.success({
            width: 100,
            height: 100,
            type: 'png',
          });
        },
      }).computeMd5(source)
    ).rejects.toMatchObject({
      code: 'PLATFORM_MISSING_CAPABILITY',
    });
  });

  it('http tmp 路径应先归一化成本地路径，并允许缺少 getFileInfo 时回退到 source.size', async () => {
    const imageInfoCalls: string[] = [];
    const processor = createMiniAppImageProcessor({
      getImageInfo(options) {
        imageInfoCalls.push(options.src);
        if (options.src.startsWith('http')) {
          options.success({
            width: 400,
            height: 300,
            type: 'png',
            path: '/tmp/local.png',
          });
          return;
        }
        options.success({
          width: 200,
          height: 100,
          type: 'jpeg',
        });
      },
      compressImage(options) {
        options.success?.({
          tempFilePath: 'https://tmp/compressed.png',
        });
      },
      getFileSystemManager() {
        return {
          readFile(options) {
            options.success({
              data: 'abc',
            });
          },
        };
      },
    });

    const result = await processor.generateBigImage(
      {
        sourceType: 'miniapp-path',
        path: 'https://tmp/original.png',
        name: 'demo.png',
        mimeType: 'image/png',
        size: 9,
      },
      {
        maxShortEdge: 100,
        quality: 0.9,
      }
    );
    const md5 = await processor.computeMd5({
      sourceType: 'miniapp-path',
      path: 'https://tmp/original.png',
      name: 'demo.png',
      mimeType: 'image/png',
      size: 9,
    });

    expect(result.source.path).toBe('/tmp/local.png');
    expect(result.fileSize).toBe(9);
    expect(imageInfoCalls).toEqual([
      'https://tmp/original.png',
      'https://tmp/compressed.png',
      '/tmp/local.png',
      'https://tmp/original.png',
    ]);
    expect(md5).toBe('900150983cd24fb0d6963f7d28e17f72');
  });
});
