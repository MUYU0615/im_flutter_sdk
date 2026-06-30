---
id: generated/api-reference/src-platform-types-ts
title: websdk2 API Reference - 平台适配类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/platform/types.ts API Reference 分段。
---

## src/platform/types.ts

### PlatformAdapterError

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| code | `PlatformErrorCode` | - |
| stage | `PlatformErrorStage` | - |
| retryable | `boolean` | - |
| details | `Record<string, unknown>` | - |

### PlatformErrorOptions

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| code | `PlatformErrorCode` | - |
| stage | `PlatformErrorStage` | - |
| retryable | `boolean` | - |
| details | `Record<string, unknown>` | - |

### RequestConfig

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| method | `HttpMethod` | - |
| headers | `Record<string, string>` | - |
| body | `string | Record<string, unknown> | Uint8Array` | - |
| responseType | `'json' | 'text' | 'arraybuffer'` | - |
| timeoutMs | `number` | - |
| signal | `AbortSignal` | - |

### RequestResponse

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| status | `number` | - |
| headers | `Record<string, string>` | - |
| data | `TData` | - |

### RequestAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### UploadSource

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| sourceType | `UploadSourceType` | - |
| file | `File | Blob` | - |
| path | `string` | - |
| uri | `string` | - |
| name | `string` | - |
| mimeType | `string` | - |
| size | `number` | - |

### ImageInfoResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| width | `number` | - |
| height | `number` | - |
| mimeType | `string` | - |
| fileSize | `number` | - |
| isGif | `boolean` | - |

### ImageGenerateOptions

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| maxShortEdge | `number` | - |
| quality | `number` | - |

### GeneratedImageResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| source | `UploadSource` | - |
| width | `number` | - |
| height | `number` | - |
| fileName | `string` | - |
| fileType | `string` | - |
| fileSize | `number` | - |
| webFile | `File` | - |

### ImageProcessor

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### UploadProgress

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| loaded | `number` | - |
| total | `number` | - |
| percent | `number` | - |

### UploadConfig

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| headers | `Record<string, string>` | - |
| source | `UploadSource` | - |
| fields | `Record<string, string>` | - |
| timeoutMs | `number` | - |
| signal | `AbortSignal` | - |
| onProgress | `(progress: UploadProgress) => void` | - |

### UploadResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| status | `number` | - |
| body | `string` | - |

### UploadAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### SocketConnectConfig

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| protocols | `string | string[]` | - |

### SocketLike

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| readyState | `number` | - |

### SocketAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### RuntimeAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### StorageAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### ProtoAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### PlatformAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| platform | `RuntimePlatform` | - |
| request | `RequestAdapter` | - |
| upload | `UploadAdapter` | - |
| socket | `SocketAdapter` | - |
| runtime | `RuntimeAdapter` | - |
| proto | `ProtoAdapter` | - |
| storage | `StorageAdapter` | - |
| imageProcessor | `ImageProcessor` | - |

### PlatformCapability

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| request | `boolean` | - |
| upload | `boolean` | - |
| socket | `boolean` | - |
| runtime | `boolean` | - |
| proto | `boolean` | - |
| storage | `boolean` | - |
| imageProcessor | `boolean` | - |

### PlatformAdapterProfile

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| platformId | `RuntimePlatform` | - |
| capability | `PlatformCapability` | - |

### PlatformAdapterOverrides

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| request | `RequestAdapter` | - |
| upload | `UploadAdapter` | - |
| socket | `SocketAdapter` | - |
| runtime | `RuntimeAdapter` | - |
| proto | `ProtoAdapter` | - |
| storage | `StorageAdapter` | - |
| imageProcessor | `ImageProcessor` | - |

### CreatePlatformAdapterOptions

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| prefer | `RuntimePlatform` | - |
| overrides | `PlatformAdapterOverrides | PlatformAdapterOverridesResolver` | - |
