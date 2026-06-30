import { useState } from 'react'; // 引入 React hooks
import { formatError, withTimeout } from '../utils'; // 引入工具方法
import type { ChangeEvent } from 'react'; // 引入事件类型
import type {
  ChannelTypeOption,
  DemoClient,
  LogType,
  MessageRecord,
  MessageTypeOption,
  ParamsRecord,
} from '../types'; // 引入 demo 类型

export interface SendPanelProps {
  // 发送面板属性
  readonly client: DemoClient | null; // SDK 实例
  readonly onAddLog: (type: LogType, message: string) => void; // 日志回调
  readonly onAddMessage: (message: MessageRecord) => void; // 消息回调
  readonly defaultTargetId?: string; // 默认目标 ID
  readonly defaultChannelType?: ChannelTypeOption; // 默认会话类型
  readonly defaultMessage?: string; // 默认消息内容
} // 接口结束

const SEND_TIMEOUT = 15000; // 发送超时
const METADATA_TIMEOUT = 3000; // 元数据读取超时
const ACTION_TIMEOUT = 10000;

const toConversationType = (
  channelType: ChannelTypeOption
): 'singleChat' | 'groupChat' | 'chatRoom' => {
  if (channelType === 'group') {
    return 'groupChat';
  }
  if (channelType === 'room') {
    return 'chatRoom';
  }
  return 'singleChat';
};

export const SendPanel = (props: SendPanelProps): JSX.Element => {
  // 发送面板组件
  const { client, onAddLog, onAddMessage, defaultTargetId, defaultChannelType, defaultMessage } =
    props; // 读取属性
  const [messageType, setMessageType] = useState<MessageTypeOption>('text'); // 消息类型
  const [channelType, setChannelType] = useState<ChannelTypeOption>(defaultChannelType ?? 'single'); // 会话类型
  const [targetId, setTargetId] = useState(defaultTargetId ?? ''); // 目标 ID
  const [messageEnv, setMessageEnv] = useState(''); // 出站 env
  const [textMessage, setTextMessage] = useState(defaultMessage ?? ''); // 文本消息内容
  const [imageUrl, setImageUrl] = useState(''); // 图片 URL
  const [imageFilename, setImageFilename] = useState(''); // 图片文件名
  const [imageFiletype, setImageFiletype] = useState(''); // 图片类型
  const [imageWidth, setImageWidth] = useState(''); // 图片宽度
  const [imageHeight, setImageHeight] = useState(''); // 图片高度
  const [imageIsGif, setImageIsGif] = useState(false); // GIF 标记
  const [imageSendOriginal, setImageSendOriginal] = useState(false); // 是否发送原图
  const [imageThumbnailUrl, setImageThumbnailUrl] = useState(''); // 缩略图 URL
  const [imageFile, setImageFile] = useState<File | null>(null); // 图片文件
  const [voiceUrl, setVoiceUrl] = useState(''); // 语音 URL
  const [voiceFilename, setVoiceFilename] = useState(''); // 语音文件名
  const [voiceFiletype, setVoiceFiletype] = useState(''); // 语音类型
  const [voiceDuration, setVoiceDuration] = useState(''); // 语音时长
  const [voiceFile, setVoiceFile] = useState<File | null>(null); // 语音文件
  const [videoUrl, setVideoUrl] = useState(''); // 视频 URL
  const [videoFilename, setVideoFilename] = useState(''); // 视频文件名
  const [videoFiletype, setVideoFiletype] = useState(''); // 视频类型
  const [videoDuration, setVideoDuration] = useState(''); // 视频时长
  const [videoWidth, setVideoWidth] = useState(''); // 视频宽度
  const [videoHeight, setVideoHeight] = useState(''); // 视频高度
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState(''); // 视频缩略图
  const [videoFile, setVideoFile] = useState<File | null>(null); // 视频文件
  const [fileUrl, setFileUrl] = useState(''); // 文件 URL
  const [fileFilename, setFileFilename] = useState(''); // 文件名
  const [fileFiletype, setFileFiletype] = useState(''); // 文件类型
  const [fileSize, setFileSize] = useState(''); // 文件大小
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null); // 附件文件
  const [customEvent, setCustomEvent] = useState(''); // 自定义事件
  const [customParamsJson, setCustomParamsJson] = useState(''); // 自定义参数 JSON
  const [cmdAction, setCmdAction] = useState(''); // 命令动作
  const [cmdDeliverOnlineOnly, setCmdDeliverOnlineOnly] = useState(false); // 命令在线投递
  const [locationLatitude, setLocationLatitude] = useState(''); // 纬度
  const [locationLongitude, setLocationLongitude] = useState(''); // 经度
  const [locationAddress, setLocationAddress] = useState(''); // 地址
  const [locationBuildingName, setLocationBuildingName] = useState(''); // 建筑名称
  const [loading, setLoading] = useState(false); // 发送状态
  const [actionLoading, setActionLoading] = useState(false);

  const logBuiltMessageToConsole = (message: MessageRecord): void => {
    // eslint-disable-next-line no-console -- demo 需要把发消息时构建出的原始消息对象输出到控制台，便于联调
    console.log('[demo:message] built', {
      type: message.type,
      msgLocalId: message.msgLocalId,
      status: message.status,
      body: message.body,
      message,
    });
  };

  const logSendLifecycleToConsole = (
    stage: 'sending' | 'success' | 'failed',
    payload: MessageRecord,
    error?: unknown
  ): void => {
    // eslint-disable-next-line no-console -- demo 需要直接打印单次发送生命周期，便于联调发送结果
    console.log(`[demo:send] ${stage}`, {
      type: payload.type,
      msgServerId: payload.msgServerId,
      msgLocalId: payload.msgLocalId,
      status: payload.status,
      body: payload.body,
      message: payload,
      error: error ? formatError(error) : undefined,
    });
  };

  const handleMessageTypeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    // 处理消息类型选择
    setMessageType(event.target.value as MessageTypeOption); // 更新消息类型
  }; // 函数结束

  const handleChannelTypeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    // 处理会话类型选择
    setChannelType(event.target.value as ChannelTypeOption); // 更新会话类型
  }; // 函数结束

  const handleTargetIdChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理目标 ID
    setTargetId(event.target.value); // 更新目标 ID
  }; // 函数结束

  const handleMessageEnvChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理出站 env
    setMessageEnv(event.target.value); // 更新 env
  }; // 函数结束

  const handleTextMessageChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    // 处理文本内容
    setTextMessage(event.target.value); // 更新文本内容
  }; // 函数结束

  const handleImageUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理图片 URL
    setImageUrl(event.target.value); // 更新图片 URL
  }; // 函数结束

  const handleImageFilenameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理图片文件名
    setImageFilename(event.target.value); // 更新图片文件名
  }; // 函数结束

  const handleImageFiletypeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理图片类型
    setImageFiletype(event.target.value); // 更新图片类型
  }; // 函数结束

  const handleImageWidthChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理图片宽度
    setImageWidth(event.target.value); // 更新图片宽度
  }; // 函数结束

  const handleImageHeightChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理图片高度
    setImageHeight(event.target.value); // 更新图片高度
  }; // 函数结束

  const handleImageIsGifChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理 GIF 选择
    setImageIsGif(event.target.checked); // 更新 GIF 标记
  }; // 函数结束

  const handleImageSendOriginalChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理原图发送选择
    setImageSendOriginal(event.target.checked); // 更新原图发送标记
  }; // 函数结束

  const handleImageThumbnailUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理缩略图 URL
    setImageThumbnailUrl(event.target.value); // 更新缩略图 URL
  }; // 函数结束

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理图片文件选择
    const file = event.target.files?.[0] ?? null; // 读取文件
    setImageFile(file); // 更新图片文件
  }; // 函数结束

  const handleVoiceUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理语音 URL
    setVoiceUrl(event.target.value); // 更新语音 URL
  }; // 函数结束

  const handleVoiceFilenameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理语音文件名
    setVoiceFilename(event.target.value); // 更新语音文件名
  }; // 函数结束

  const handleVoiceFiletypeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理语音类型
    setVoiceFiletype(event.target.value); // 更新语音类型
  }; // 函数结束

  const handleVoiceDurationChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理语音时长
    setVoiceDuration(event.target.value); // 更新语音时长
  }; // 函数结束

  const handleVoiceFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理语音文件选择
    const file = event.target.files?.[0] ?? null; // 读取文件
    setVoiceFile(file); // 更新语音文件
  }; // 函数结束

  const handleVideoUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理视频 URL
    setVideoUrl(event.target.value); // 更新视频 URL
  }; // 函数结束

  const handleVideoFilenameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理视频文件名
    setVideoFilename(event.target.value); // 更新视频文件名
  }; // 函数结束

  const handleVideoFiletypeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理视频类型
    setVideoFiletype(event.target.value); // 更新视频类型
  }; // 函数结束

  const handleVideoDurationChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理视频时长
    setVideoDuration(event.target.value); // 更新视频时长
  }; // 函数结束

  const handleVideoWidthChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理视频宽度
    setVideoWidth(event.target.value); // 更新视频宽度
  }; // 函数结束

  const handleVideoHeightChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理视频高度
    setVideoHeight(event.target.value); // 更新视频高度
  }; // 函数结束

  const handleVideoThumbnailUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理视频缩略图
    setVideoThumbnailUrl(event.target.value); // 更新视频缩略图
  }; // 函数结束

  const handleVideoFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理视频文件选择
    const file = event.target.files?.[0] ?? null; // 读取文件
    setVideoFile(file); // 更新视频文件
  }; // 函数结束

  const handleFileUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理文件 URL
    setFileUrl(event.target.value); // 更新文件 URL
  }; // 函数结束

  const handleFileFilenameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理文件名
    setFileFilename(event.target.value); // 更新文件名
  }; // 函数结束

  const handleFileFiletypeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理文件类型
    setFileFiletype(event.target.value); // 更新文件类型
  }; // 函数结束

  const handleFileSizeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理文件大小
    setFileSize(event.target.value); // 更新文件大小
  }; // 函数结束

  const handleAttachmentFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理附件文件选择
    const file = event.target.files?.[0] ?? null; // 读取文件
    setAttachmentFile(file); // 更新附件文件
  }; // 函数结束

  const handleCustomEventChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理自定义事件
    setCustomEvent(event.target.value); // 更新自定义事件
  }; // 函数结束

  const handleCustomParamsChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    // 处理自定义参数
    setCustomParamsJson(event.target.value); // 更新自定义参数
  }; // 函数结束

  const handleCmdActionChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理命令动作
    setCmdAction(event.target.value); // 更新命令动作
  }; // 函数结束

  const handleCmdDeliverOnlineOnlyChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理在线投递
    setCmdDeliverOnlineOnly(event.target.checked); // 更新在线投递
  }; // 函数结束

  const handleLocationLatitudeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理纬度
    setLocationLatitude(event.target.value); // 更新纬度
  }; // 函数结束

  const handleLocationLongitudeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理经度
    setLocationLongitude(event.target.value); // 更新经度
  }; // 函数结束

  const handleLocationAddressChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理地址
    setLocationAddress(event.target.value); // 更新地址
  }; // 函数结束

  const handleLocationBuildingNameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理建筑名称
    setLocationBuildingName(event.target.value); // 更新建筑名称
  }; // 函数结束

  const requireText = (value: string, label: string): string | null => {
    // 必填文本校验
    const trimmed = value.trim(); // 去除空格
    if (!trimmed) {
      // 内容为空
      onAddLog('warn', `请输入${label}`); // 记录日志
      return null; // 返回空
    } // 判断结束
    return trimmed; // 返回文本
  }; // 函数结束

  const parseRequiredNumber = (value: string, label: string): number | null => {
    // 解析必填数字
    const trimmed = value.trim(); // 去除空格
    if (!trimmed) {
      // 内容为空
      onAddLog('warn', `请输入${label}`); // 记录日志
      return null; // 返回空
    } // 判断结束
    const numberValue = Number(trimmed); // 转换数字
    if (Number.isNaN(numberValue)) {
      // 非数字
      onAddLog('warn', `${label}格式不正确`); // 记录日志
      return null; // 返回空
    } // 判断结束
    return numberValue; // 返回数字
  }; // 函数结束

  const parseOptionalNumber = (value: string, label: string): number | null | undefined => {
    // 解析可选数字
    const trimmed = value.trim(); // 去除空格
    if (!trimmed) {
      // 内容为空
      return undefined; // 返回空值
    } // 判断结束
    const numberValue = Number(trimmed); // 转换数字
    if (Number.isNaN(numberValue)) {
      // 非数字
      onAddLog('warn', `${label}格式不正确`); // 记录日志
      return null; // 返回空
    } // 判断结束
    return numberValue; // 返回数字
  }; // 函数结束

  const parseParamsJson = (value: string, label: string): ParamsRecord | null | undefined => {
    // 解析 JSON 参数
    const trimmed = value.trim(); // 去除空格
    if (!trimmed) {
      // 为空
      return undefined; // 返回空
    } // 判断结束
    let parsed: unknown; // 解析结果
    try {
      // 尝试解析
      parsed = JSON.parse(trimmed); // 解析 JSON
    } catch {
      // 解析失败
      onAddLog('warn', `${label}不是有效 JSON`); // 记录日志
      return null; // 返回空
    } // 解析结束
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      // 校验对象
      onAddLog('warn', `${label}需要对象格式`); // 记录日志
      return null; // 返回空
    } // 判断结束
    const record = parsed as Record<string, unknown>; // 转换为对象
    const output: ParamsRecord = {}; // 初始化输出
    for (const [key, entry] of Object.entries(record)) {
      // 遍历条目
      if (typeof entry !== 'string') {
        // 非字符串
        onAddLog('warn', `${label}的值必须是字符串`); // 记录日志
        return null; // 返回空
      } // 判断结束
      output[key] = entry; // 写入输出
    } // 遍历结束
    return output; // 返回结果
  }; // 函数结束

  const inferFileType = (file: File): string => {
    // 推断文件类型
    if (file.type) {
      // MIME 类型存在
      return file.type; // 返回 MIME 类型
    } // 判断结束
    const name = file.name; // 获取文件名
    const lastDotIndex = name.lastIndexOf('.'); // 获取最后一个点的位置
    if (lastDotIndex >= 0 && lastDotIndex < name.length - 1) {
      // 存在扩展名
      return name.slice(lastDotIndex + 1); // 返回扩展名
    } // 判断结束
    return 'application/octet-stream'; // 返回兜底类型
  }; // 函数结束

  const resolveImageDimensions = async (
    file: File
  ): Promise<{ width: number; height: number } | null> => {
    // 解析图片尺寸
    return await new Promise(resolve => {
      // 返回 Promise
      const objectUrl = URL.createObjectURL(file); // 创建临时 URL
      let settled = false; // 是否已结束
      const timeoutId = setTimeout(() => {
        // 启动超时
        if (settled) {
          // 已结束
          return; // 结束
        } // 判断结束
        settled = true; // 标记结束
        URL.revokeObjectURL(objectUrl); // 释放临时 URL
        resolve(null); // 返回空
      }, METADATA_TIMEOUT); // 超时结束
      const image = new Image(); // 创建图片对象
      const cleanup = (): void => {
        // 清理资源
        clearTimeout(timeoutId); // 清理超时
        URL.revokeObjectURL(objectUrl); // 释放临时 URL
      }; // 清理结束
      image.onload = (): void => {
        // 加载成功
        if (settled) {
          // 已结束
          return; // 结束
        } // 判断结束
        settled = true; // 标记结束
        const width = image.naturalWidth; // 读取宽度
        const height = image.naturalHeight; // 读取高度
        cleanup(); // 清理资源
        if (width > 0 && height > 0) {
          // 校验尺寸
          resolve({ width, height }); // 返回尺寸
          return; // 结束
        } // 判断结束
        resolve(null); // 返回空
      }; // 事件结束
      image.onerror = (): void => {
        // 加载失败
        if (settled) {
          // 已结束
          return; // 结束
        } // 判断结束
        settled = true; // 标记结束
        cleanup(); // 清理资源
        resolve(null); // 返回空
      }; // 事件结束
      image.src = objectUrl; // 设置图片地址
    }); // Promise 结束
  }; // 函数结束

  const resolveAudioDuration = async (file: File): Promise<number | null> => {
    // 解析语音时长
    return await new Promise(resolve => {
      // 返回 Promise
      const objectUrl = URL.createObjectURL(file); // 创建临时 URL
      const audio = new Audio(); // 创建音频对象
      let settled = false; // 是否已结束
      const timeoutId = setTimeout(() => {
        // 启动超时
        if (settled) {
          // 已结束
          return; // 结束
        } // 判断结束
        settled = true; // 标记结束
        URL.revokeObjectURL(objectUrl); // 释放临时 URL
        resolve(null); // 返回空
      }, METADATA_TIMEOUT); // 超时结束
      const cleanup = (): void => {
        // 清理资源
        clearTimeout(timeoutId); // 清理超时
        URL.revokeObjectURL(objectUrl); // 释放临时 URL
      }; // 清理结束
      const finalize = (duration: number | null): void => {
        // 完成处理
        if (settled) {
          // 已结束
          return; // 结束
        } // 判断结束
        settled = true; // 标记结束
        cleanup(); // 清理资源
        resolve(duration); // 返回结果
      }; // 完成结束
      audio.addEventListener(
        'loadedmetadata',
        () => {
          // 元数据加载
          const durationValue = Number.isFinite(audio.duration) ? Math.ceil(audio.duration) : null; // 读取时长
          finalize(durationValue); // 返回时长
        },
        { once: true }
      ); // 事件结束
      audio.addEventListener(
        'error',
        () => {
          // 加载失败
          finalize(null); // 返回空
        },
        { once: true }
      ); // 事件结束
      audio.preload = 'metadata'; // 设置预加载
      audio.src = objectUrl; // 设置音频地址
    }); // Promise 结束
  }; // 函数结束

  const resolveVideoMetadata = async (
    file: File
  ): Promise<{ duration: number | null; width: number | null; height: number | null }> => {
    // 解析视频元数据
    return await new Promise(resolve => {
      // 返回 Promise
      const objectUrl = URL.createObjectURL(file); // 创建临时 URL
      const video = document.createElement('video'); // 创建视频对象
      let settled = false; // 是否已结束
      const timeoutId = setTimeout(() => {
        // 启动超时
        if (settled) {
          // 已结束
          return; // 结束
        } // 判断结束
        settled = true; // 标记结束
        URL.revokeObjectURL(objectUrl); // 释放临时 URL
        resolve({ duration: null, width: null, height: null }); // 返回空
      }, METADATA_TIMEOUT); // 超时结束
      const cleanup = (): void => {
        // 清理资源
        clearTimeout(timeoutId); // 清理超时
        URL.revokeObjectURL(objectUrl); // 释放临时 URL
      }; // 清理结束
      const finalize = (payload: {
        duration: number | null;
        width: number | null;
        height: number | null;
      }): void => {
        // 完成处理
        if (settled) {
          // 已结束
          return; // 结束
        } // 判断结束
        settled = true; // 标记结束
        cleanup(); // 清理资源
        resolve(payload); // 返回结果
      }; // 完成结束
      video.addEventListener(
        'loadedmetadata',
        () => {
          // 元数据加载
          const durationValue = Number.isFinite(video.duration) ? Math.ceil(video.duration) : null; // 读取时长
          const widthValue = video.videoWidth > 0 ? video.videoWidth : null; // 读取宽度
          const heightValue = video.videoHeight > 0 ? video.videoHeight : null; // 读取高度
          finalize({ duration: durationValue, width: widthValue, height: heightValue }); // 返回结果
        },
        { once: true }
      ); // 事件结束
      video.addEventListener(
        'error',
        () => {
          // 加载失败
          finalize({ duration: null, width: null, height: null }); // 返回空
        },
        { once: true }
      ); // 事件结束
      video.preload = 'metadata'; // 设置预加载
      video.src = objectUrl; // 设置视频地址
    }); // Promise 结束
  }; // 函数结束

  const handleSend = async (): Promise<void> => {
    // 处理发送
    if (!client) {
      // 未初始化
      onAddLog('warn', '请先初始化 SDK'); // 记录日志
      return; // 结束
    } // 判断结束
    const connectionState = client.getConnectionState(); // 读取 SDK 连接状态
    if (connectionState !== 'connected') {
      // 未连接
      onAddLog('warn', `请先登录（当前状态: ${connectionState}）`); // 记录日志
      return; // 结束
    } // 判断结束
    const trimmedTargetId = requireText(targetId, '目标 ID'); // 校验目标 ID
    if (!trimmedTargetId) {
      // 校验失败
      return; // 结束
    } // 判断结束
    const conversationLocator = {
      conversationId: trimmedTargetId,
      conversationType: toConversationType(channelType),
    } as const; // 构造消息目标
    const commonMessageParams = {
      ...conversationLocator,
      env: messageEnv,
    } as const; // 构造消息公共参数
    let message: MessageRecord | null = null; // 消息对象
    try {
      // 尝试创建消息
      switch (
        messageType // 判断消息类型
      ) {
        case 'text': {
          // 文本消息
          const trimmedMessage = requireText(textMessage, '消息内容'); // 校验消息内容
          if (!trimmedMessage) {
            // 校验失败
            return; // 结束
          } // 判断结束
          message = client.chatManager.createTextMessage({
            content: trimmedMessage,
            ...commonMessageParams,
          }); // 创建消息
          break; // 结束分支
        } // 分支结束
        case 'image': {
          // 图片消息
          const selectedFile = imageFile; // 读取图片文件
          const url = selectedFile ? undefined : requireText(imageUrl, '图片 URL'); // 校验 URL
          const filename = selectedFile
            ? selectedFile.name
            : requireText(imageFilename, '图片文件名'); // 读取文件名
          const filetype = selectedFile
            ? inferFileType(selectedFile)
            : requireText(imageFiletype, '图片类型'); // 读取类型
          const widthInput = parseOptionalNumber(imageWidth, '图片宽度'); // 解析宽度
          const heightInput = parseOptionalNumber(imageHeight, '图片高度'); // 解析高度
          if (widthInput === null || heightInput === null) {
            // 校验输入
            return; // 结束
          } // 判断结束
          let width = widthInput; // 图片宽度
          let height = heightInput; // 图片高度
          if (selectedFile) {
            // 使用本地文件
            const resolved = await resolveImageDimensions(selectedFile); // 解析尺寸
            if (resolved) {
              // 解析成功
              width = resolved.width; // 读取宽度
              height = resolved.height; // 读取高度
            } // 判断结束
          } // 判断结束
          if (!selectedFile && (!url || !filename || !filetype)) {
            // 校验必填
            return; // 结束
          } // 判断结束
          if (width === undefined || height === undefined) {
            // 缺少尺寸
            onAddLog('warn', '无法读取图片尺寸，请补充宽高'); // 记录日志
            return; // 结束
          } // 判断结束
          const normalizedFilename = filename ?? ''; // 兜底文件名
          const normalizedFiletype = filetype ?? ''; // 兜底文件类型
          if (!normalizedFilename || !normalizedFiletype) {
            // 缺少关键字段
            onAddLog('warn', '请提供图片文件名和类型'); // 记录日志
            return; // 结束
          } // 判断结束
          const isGif = selectedFile
            ? imageIsGif ||
              selectedFile.type === 'image/gif' ||
              selectedFile.name.toLowerCase().endsWith('.gif')
            : imageIsGif; // 解析 GIF
          const params = {
            // 构造参数
            originalImageUrl: url ?? undefined, // 图片原图 URL（将 null 转换为 undefined）
            filename: normalizedFilename, // 图片文件名
            filetype: normalizedFiletype, // 图片类型
            width, // 图片宽度
            height, // 图片高度
            isGif, // GIF 标记
            isOriginalImage: imageSendOriginal || undefined, // 原图开关
            data: selectedFile ?? undefined, // 本地文件
            thumbnailUrl: imageThumbnailUrl.trim() || undefined, // 缩略图
          }; // 参数结束
          message = client.chatManager.createImageMessage({ ...params, ...commonMessageParams }); // 创建消息
          break; // 结束分支
        } // 分支结束
        case 'voice': {
          // 语音消息
          const selectedFile = voiceFile; // 读取语音文件
          const url = selectedFile ? undefined : requireText(voiceUrl, '语音 URL'); // 校验 URL
          const filename = selectedFile
            ? selectedFile.name
            : requireText(voiceFilename, '语音文件名'); // 读取文件名
          const filetype = selectedFile
            ? inferFileType(selectedFile)
            : requireText(voiceFiletype, '语音类型'); // 读取类型
          const durationInput = parseOptionalNumber(voiceDuration, '语音时长'); // 解析时长
          if (durationInput === null) {
            // 校验输入
            return; // 结束
          } // 判断结束
          let duration = durationInput; // 语音时长
          if (selectedFile && duration === undefined) {
            // 尝试读取元数据
            const resolvedDuration = await resolveAudioDuration(selectedFile); // 读取时长
            if (resolvedDuration !== null) {
              // 读取成功
              duration = resolvedDuration; // 更新时长
            } // 判断结束
          } // 判断结束
          if (!selectedFile && (!url || !filename || !filetype)) {
            // 校验必填
            return; // 结束
          } // 判断结束
          if (duration === undefined) {
            // 缺少时长
            onAddLog('warn', '无法读取语音时长，请补充时长'); // 记录日志
            return; // 结束
          } // 判断结束
          const normalizedFilename = filename ?? ''; // 兜底文件名
          const normalizedFiletype = filetype ?? ''; // 兜底文件类型
          if (!normalizedFilename || !normalizedFiletype) {
            // 缺少关键字段
            onAddLog('warn', '请提供语音文件名和类型'); // 记录日志
            return; // 结束
          } // 判断结束
          message = client.chatManager.createVoiceMessage({
            // 创建消息
            originalUrl: url ?? undefined, // 语音 URL（将 null 转换为 undefined）
            filename: normalizedFilename, // 语音文件名
            filetype: normalizedFiletype, // 语音类型
            duration, // 语音时长
            data: selectedFile ?? undefined, // 本地文件
            ...commonMessageParams,
          }); // 创建结束
          break; // 结束分支
        } // 分支结束
        case 'video': {
          // 视频消息
          const selectedFile = videoFile; // 读取视频文件
          const url = selectedFile ? undefined : requireText(videoUrl, '视频 URL'); // 校验 URL
          const filename = selectedFile
            ? selectedFile.name
            : requireText(videoFilename, '视频文件名'); // 读取文件名
          const filetype = selectedFile
            ? inferFileType(selectedFile)
            : requireText(videoFiletype, '视频类型'); // 读取类型
          const durationInput = parseOptionalNumber(videoDuration, '视频时长'); // 解析时长
          const widthInput = parseOptionalNumber(videoWidth, '视频宽度'); // 解析宽度
          const heightInput = parseOptionalNumber(videoHeight, '视频高度'); // 解析高度
          if (durationInput === null || widthInput === null || heightInput === null) {
            // 校验输入
            return; // 结束
          } // 判断结束
          let duration = durationInput; // 视频时长
          let width = widthInput; // 视频宽度
          let height = heightInput; // 视频高度
          if (selectedFile) {
            // 尝试读取元数据
            const metadata = await resolveVideoMetadata(selectedFile); // 读取元数据
            if (duration === undefined && metadata.duration !== null) {
              // 读取时长
              duration = metadata.duration; // 更新时长
            } // 判断结束
            if (width === undefined && metadata.width !== null) {
              // 读取宽度
              width = metadata.width; // 更新宽度
            } // 判断结束
            if (height === undefined && metadata.height !== null) {
              // 读取高度
              height = metadata.height; // 更新高度
            } // 判断结束
          } // 判断结束
          if (!selectedFile && (!url || !filename || !filetype)) {
            // 校验必填
            return; // 结束
          } // 判断结束
          if (duration === undefined) {
            // 缺少时长
            onAddLog('warn', '无法读取视频时长，请补充时长'); // 记录日志
            return; // 结束
          } // 判断结束
          const normalizedFilename = filename ?? ''; // 兜底文件名
          const normalizedFiletype = filetype ?? ''; // 兜底文件类型
          if (!normalizedFilename || !normalizedFiletype) {
            // 缺少关键字段
            onAddLog('warn', '请提供视频文件名和类型'); // 记录日志
            return; // 结束
          } // 判断结束
          const params = {
            // 构造参数
            originalUrl: url ?? undefined, // 视频 URL（将 null 转换为 undefined）
            filename: normalizedFilename, // 视频文件名
            filetype: normalizedFiletype, // 视频类型
            duration, // 视频时长
            width, // 视频宽度
            height, // 视频高度
            data: selectedFile ?? undefined, // 本地文件
            thumbnailUrl: videoThumbnailUrl.trim() || undefined, // 缩略图
          }; // 参数结束
          message = client.chatManager.createVideoMessage({ ...params, ...commonMessageParams }); // 创建消息
          break; // 结束分支
        } // 分支结束
        case 'file': {
          // 文件消息
          const selectedFile = attachmentFile; // 读取附件文件
          const url = selectedFile ? undefined : requireText(fileUrl, '文件 URL'); // 校验 URL
          const filename = selectedFile ? selectedFile.name : requireText(fileFilename, '文件名'); // 读取文件名
          const filetype = selectedFile
            ? inferFileType(selectedFile)
            : requireText(fileFiletype, '文件类型'); // 读取类型
          const sizeInput = parseOptionalNumber(fileSize, '文件大小'); // 解析大小
          if (sizeInput === null) {
            // 校验输入
            return; // 结束
          } // 判断结束
          if (!selectedFile && (!url || !filename || !filetype)) {
            // 校验必填
            return; // 结束
          } // 判断结束
          const normalizedFilename = filename ?? ''; // 兜底文件名
          const normalizedFiletype = filetype ?? ''; // 兜底文件类型
          if (!normalizedFilename || !normalizedFiletype) {
            // 缺少关键字段
            onAddLog('warn', '请提供文件名和类型'); // 记录日志
            return; // 结束
          } // 判断结束
          const fileSizeValue = selectedFile ? selectedFile.size : sizeInput; // 读取大小
          const params = {
            // 构造参数
            originalUrl: url ?? undefined, // 文件 URL（将 null 转换为 undefined）
            filename: normalizedFilename, // 文件名
            filetype: normalizedFiletype, // 文件类型
            fileSize: fileSizeValue, // 文件大小
            data: selectedFile ?? undefined, // 本地文件
          }; // 参数结束
          message = client.chatManager.createFileMessage({ ...params, ...commonMessageParams }); // 创建消息
          break; // 结束分支
        } // 分支结束
        case 'custom': {
          // 自定义消息
          const event = requireText(customEvent, '自定义事件'); // 校验事件
          const params = parseParamsJson(customParamsJson, '自定义参数'); // 解析参数
          if (!event || params === null) {
            // 校验失败
            return; // 结束
          } // 判断结束
          message = client.chatManager.createCustomMessage({ event, params, ...commonMessageParams }); // 创建消息
          break; // 结束分支
        } // 分支结束
        case 'cmd': {
          // 命令消息
          const action = requireText(cmdAction, '命令动作'); // 校验动作
          if (!action) {
            // 校验失败
            return; // 结束
          } // 判断结束
          const payload = { action, deliverOnlineOnly: cmdDeliverOnlineOnly || undefined }; // 构造参数
          message = client.chatManager.createCmdMessage({ ...payload, ...commonMessageParams }); // 创建消息
          break; // 结束分支
        } // 分支结束
        case 'location': {
          // 位置消息
          const latitude = parseRequiredNumber(locationLatitude, '纬度'); // 校验纬度
          const longitude = parseRequiredNumber(locationLongitude, '经度'); // 校验经度
          if (latitude === null || longitude === null) {
            // 校验失败
            return; // 结束
          } // 判断结束
          const params = {
            latitude,
            longitude,
            address: locationAddress.trim() || undefined,
            buildingName: locationBuildingName.trim() || undefined,
          }; // 构造参数
          message = client.chatManager.createLocationMessage({ ...params, ...commonMessageParams }); // 创建消息
          break; // 结束分支
        } // 分支结束
        default: {
          // 默认分支
          onAddLog('warn', '未知消息类型'); // 记录日志
          return; // 结束
        } // 默认结束
      } // switch 结束
    } catch (error) {
      // 捕获异常
      onAddLog('error', `创建消息失败: ${formatError(error)}`); // 记录日志
      return; // 结束
    } // try-catch 结束

    if (!message) {
      // 消息为空
      return; // 结束
    } // 判断结束

    logBuiltMessageToConsole(message); // 输出构建结果
    onAddMessage(message); // 添加本地消息
    onAddLog('info', `已创建消息: ${message.msgLocalId}`); // 记录日志

    setLoading(true); // 设置发送中
    try {
      // 尝试发送
      const sentMessage = await withTimeout(
        client.chatManager.sendMessage(message, {
          onSending: (sendingMessage): void => {
            onAddMessage(sendingMessage);
            logSendLifecycleToConsole('sending', sendingMessage);
            onAddLog('info', `本次发送进入 sending: ${sendingMessage.msgLocalId}`);
          },
          onSuccess: (successMessage): void => {
            onAddMessage(successMessage);
            logSendLifecycleToConsole('success', successMessage);
            onAddLog(
              'success',
              `本次发送成功: ${successMessage.msgServerId || successMessage.msgLocalId}`
            );
          },
          onFailed: (failedMessage, error): void => {
            onAddMessage(failedMessage);
            logSendLifecycleToConsole('failed', failedMessage, error);
            onAddLog('error', `本次发送失败: ${failedMessage.msgLocalId} (${formatError(error)})`);
          },
        }),
        SEND_TIMEOUT,
        '发送消息'
      ); // 发送消息
      onAddMessage(sentMessage); // 立即回写发送完成状态，避免页面列表依赖异步事件更新导致抖动
      onAddLog(
        'success',
        `sendMessage 返回成功: ${sentMessage.msgServerId || sentMessage.msgLocalId}`
      ); // 记录日志
      if (messageType === 'text') {
        // 文本消息
        setTextMessage(''); // 清空文本
      } // 判断结束
    } catch (error) {
      // 捕获异常
      onAddLog('error', `发送失败: ${formatError(error)}`); // 记录日志
    } finally {
      // 最终处理
      setLoading(false); // 清理状态
    } // 最终处理结束
  }; // 函数结束

  const handleMarkConversationRead = async (): Promise<void> => {
    if (!client) {
      onAddLog('warn', '请先初始化 SDK');
      return;
    }
    const connectionState = client.getConnectionState();
    if (connectionState !== 'connected') {
      onAddLog('warn', `请先登录（当前状态: ${connectionState}）`);
      return;
    }
    const trimmedTargetId = requireText(targetId, '目标 ID');
    if (!trimmedTargetId) {
      return;
    }

    setActionLoading(true);
    try {
      await withTimeout(
        client.chatManager.markConversationRead({
          conversationId: trimmedTargetId,
          conversationType: toConversationType(channelType),
        }),
        ACTION_TIMEOUT,
        '标记会话已读'
      );
      onAddLog('success', `会话已读标记成功: ${trimmedTargetId}`);
    } catch (error) {
      onAddLog('error', `会话已读标记失败: ${formatError(error)}`);
    } finally {
      setActionLoading(false);
    }
  };

  const renderTypeFields = (): JSX.Element => {
    // 渲染类型字段
    switch (
      messageType // 判断类型
    ) {
      case 'text': {
        // 文本
        return (
          // 返回文本表单
          <>
            {' '}
            {/* 文本表单 */}
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>消息内容{/* 标签 */}</label>
              <textarea
                data-testid="send-text-input"
                value={textMessage}
                onChange={handleTextMessageChange}
                placeholder="请输入消息内容"
                rows={3}
              />{' '}
              {/* 文本输入 */}
              {/* 表单组结束 */}
            </div>
            {/* 文本表单结束 */}
          </>
        ); // 返回结束
      } // 分支结束
      case 'image': {
        // 图片
        return (
          // 返回图片表单
          <>
            {' '}
            {/* 图片表单 */}
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>选择图片文件（可选）{/* 标签 */}</label>
              <input type="file" accept="image/*" onChange={handleImageFileChange} />{' '}
              {/* 图片文件 */}
              {imageFile /* 已选择文件 */ ? (
                <p style={{ color: '#999', marginTop: 4 }}>
                  已选择文件: {imageFile.name}
                  {/* 文件名 */}
                </p>
              ) : null}
              {/* 结束判断 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>图片 URL{/* 标签 */}</label>
              <input
                type="text"
                value={imageUrl}
                onChange={handleImageUrlChange}
                placeholder="https://example.com/image.png"
              />{' '}
              {/* 图片 URL */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>图片文件名{/* 标签 */}</label>
              <input
                type="text"
                value={imageFilename}
                onChange={handleImageFilenameChange}
                placeholder="image.png"
              />{' '}
              {/* 图片文件名 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>图片类型{/* 标签 */}</label>
              <input
                type="text"
                value={imageFiletype}
                onChange={handleImageFiletypeChange}
                placeholder="image/png"
              />{' '}
              {/* 图片类型 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>图片宽度{/* 标签 */}</label>
              <input
                type="number"
                value={imageWidth}
                onChange={handleImageWidthChange}
                placeholder="800"
              />{' '}
              {/* 图片宽度 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>图片高度{/* 标签 */}</label>
              <input
                type="number"
                value={imageHeight}
                onChange={handleImageHeightChange}
                placeholder="600"
              />{' '}
              {/* 图片高度 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>是否 GIF{/* 标签 */}</label>
              <input type="checkbox" checked={imageIsGif} onChange={handleImageIsGifChange} />{' '}
              {/* GIF 勾选 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>发送原图{/* 标签 */}</label>
              <input
                type="checkbox"
                checked={imageSendOriginal}
                onChange={handleImageSendOriginalChange}
              />{' '}
              {/* 原图勾选 */}
              <p style={{ color: '#999', marginTop: 4 }}>
                默认关闭。关闭时本地图片文件按大图语义发送；开启后按原图语义发送。GIF
                仍会强制按原图发送。
              </p>
              <p style={{ color: '#666', marginTop: 4 }}>
                当前发送语义: {imageSendOriginal ? '原图' : '大图'}
              </p>
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>缩略图 URL（可选）{/* 标签 */}</label>
              <input
                type="text"
                value={imageThumbnailUrl}
                onChange={handleImageThumbnailUrlChange}
                placeholder="https://example.com/thumb.png"
              />{' '}
              {/* 缩略图 URL */}
              {/* 表单组结束 */}
            </div>
            {/* 图片表单结束 */}
          </>
        ); // 返回结束
      } // 分支结束
      case 'voice': {
        // 语音
        return (
          // 返回语音表单
          <>
            {' '}
            {/* 语音表单 */}
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>选择语音文件（可选）{/* 标签 */}</label>
              <input
                data-testid="send-voice-file-input"
                type="file"
                accept="audio/*"
                onChange={handleVoiceFileChange}
              />{' '}
              {/* 语音文件 */}
              {voiceFile /* 已选择文件 */ ? (
                <p style={{ color: '#999', marginTop: 4 }}>
                  已选择文件: {voiceFile.name}
                  {/* 文件名 */}
                </p>
              ) : null}
              {/* 结束判断 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>语音 URL{/* 标签 */}</label>
              <input
                data-testid="send-voice-url-input"
                type="text"
                value={voiceUrl}
                onChange={handleVoiceUrlChange}
                placeholder="https://example.com/audio.mp3"
              />{' '}
              {/* 语音 URL */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>语音文件名{/* 标签 */}</label>
              <input
                data-testid="send-voice-filename-input"
                type="text"
                value={voiceFilename}
                onChange={handleVoiceFilenameChange}
                placeholder="audio.mp3"
              />{' '}
              {/* 语音文件名 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>语音类型{/* 标签 */}</label>
              <input
                data-testid="send-voice-filetype-input"
                type="text"
                value={voiceFiletype}
                onChange={handleVoiceFiletypeChange}
                placeholder="audio/mpeg"
              />{' '}
              {/* 语音类型 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>语音时长（秒）{/* 标签 */}</label>
              <input
                data-testid="send-voice-duration-input"
                type="number"
                value={voiceDuration}
                onChange={handleVoiceDurationChange}
                placeholder="8"
              />{' '}
              {/* 语音时长 */}
              {/* 表单组结束 */}
            </div>
            {/* 语音表单结束 */}
          </>
        ); // 返回结束
      } // 分支结束
      case 'video': {
        // 视频
        return (
          // 返回视频表单
          <>
            {' '}
            {/* 视频表单 */}
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>选择视频文件（可选）{/* 标签 */}</label>
              <input type="file" accept="video/*" onChange={handleVideoFileChange} />{' '}
              {/* 视频文件 */}
              {videoFile /* 已选择文件 */ ? (
                <p style={{ color: '#999', marginTop: 4 }}>
                  已选择文件: {videoFile.name}
                  {/* 文件名 */}
                </p>
              ) : null}
              {/* 结束判断 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>视频 URL{/* 标签 */}</label>
              <input
                type="text"
                value={videoUrl}
                onChange={handleVideoUrlChange}
                placeholder="https://example.com/video.mp4"
              />{' '}
              {/* 视频 URL */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>视频文件名{/* 标签 */}</label>
              <input
                type="text"
                value={videoFilename}
                onChange={handleVideoFilenameChange}
                placeholder="video.mp4"
              />{' '}
              {/* 视频文件名 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>视频类型{/* 标签 */}</label>
              <input
                type="text"
                value={videoFiletype}
                onChange={handleVideoFiletypeChange}
                placeholder="video/mp4"
              />{' '}
              {/* 视频类型 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>视频时长（秒）{/* 标签 */}</label>
              <input
                type="number"
                value={videoDuration}
                onChange={handleVideoDurationChange}
                placeholder="20"
              />{' '}
              {/* 视频时长 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>视频宽度（可选）{/* 标签 */}</label>
              <input
                type="number"
                value={videoWidth}
                onChange={handleVideoWidthChange}
                placeholder="1280"
              />{' '}
              {/* 视频宽度 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>视频高度（可选）{/* 标签 */}</label>
              <input
                type="number"
                value={videoHeight}
                onChange={handleVideoHeightChange}
                placeholder="720"
              />{' '}
              {/* 视频高度 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>缩略图 URL（可选）{/* 标签 */}</label>
              <input
                type="text"
                value={videoThumbnailUrl}
                onChange={handleVideoThumbnailUrlChange}
                placeholder="https://example.com/video-thumb.png"
              />{' '}
              {/* 缩略图 */}
              {/* 表单组结束 */}
            </div>
            {/* 视频表单结束 */}
          </>
        ); // 返回结束
      } // 分支结束
      case 'file': {
        // 文件
        return (
          // 返回文件表单
          <>
            {' '}
            {/* 文件表单 */}
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>选择附件文件（可选）{/* 标签 */}</label>
              <input type="file" onChange={handleAttachmentFileChange} /> {/* 附件文件 */}
              {attachmentFile /* 已选择文件 */ ? (
                <p style={{ color: '#999', marginTop: 4 }}>
                  已选择文件: {attachmentFile.name}
                  {/* 文件名 */}
                </p>
              ) : null}
              {/* 结束判断 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>文件 URL{/* 标签 */}</label>
              <input
                type="text"
                value={fileUrl}
                onChange={handleFileUrlChange}
                placeholder="https://example.com/file.pdf"
              />{' '}
              {/* 文件 URL */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>文件名{/* 标签 */}</label>
              <input
                type="text"
                value={fileFilename}
                onChange={handleFileFilenameChange}
                placeholder="file.pdf"
              />{' '}
              {/* 文件名 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>文件类型{/* 标签 */}</label>
              <input
                type="text"
                value={fileFiletype}
                onChange={handleFileFiletypeChange}
                placeholder="application/pdf"
              />{' '}
              {/* 文件类型 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>文件大小（可选）{/* 标签 */}</label>
              <input
                type="number"
                value={fileSize}
                onChange={handleFileSizeChange}
                placeholder="1024"
              />{' '}
              {/* 文件大小 */}
              {/* 表单组结束 */}
            </div>
            {/* 文件表单结束 */}
          </>
        ); // 返回结束
      } // 分支结束
      case 'custom': {
        // 自定义
        return (
          // 返回自定义表单
          <>
            {' '}
            {/* 自定义表单 */}
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>事件名称{/* 标签 */}</label>
              <input
                type="text"
                value={customEvent}
                onChange={handleCustomEventChange}
                placeholder="custom_event"
              />{' '}
              {/* 事件名称 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>参数 JSON（可选）{/* 标签 */}</label>
              <textarea
                value={customParamsJson}
                onChange={handleCustomParamsChange}
                placeholder='{"key":"value"}'
                rows={3}
              />{' '}
              {/* 参数 JSON */}
              {/* 表单组结束 */}
            </div>
            {/* 自定义表单结束 */}
          </>
        ); // 返回结束
      } // 分支结束
      case 'cmd': {
        // 命令
        return (
          // 返回命令表单
          <>
            {' '}
            {/* 命令表单 */}
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>命令动作{/* 标签 */}</label>
              <input
                type="text"
                value={cmdAction}
                onChange={handleCmdActionChange}
                placeholder="cmd_action"
              />{' '}
              {/* 命令动作 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>仅在线投递{/* 标签 */}</label>
              <input
                type="checkbox"
                checked={cmdDeliverOnlineOnly}
                onChange={handleCmdDeliverOnlineOnlyChange}
              />{' '}
              {/* 在线投递 */}
              {/* 表单组结束 */}
            </div>
            {/* 命令表单结束 */}
          </>
        ); // 返回结束
      } // 分支结束
      case 'location': {
        // 位置
        return (
          // 返回位置表单
          <>
            {' '}
            {/* 位置表单 */}
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>纬度{/* 标签 */}</label>
              <input
                type="number"
                value={locationLatitude}
                onChange={handleLocationLatitudeChange}
                placeholder="39.909"
              />{' '}
              {/* 纬度 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>经度{/* 标签 */}</label>
              <input
                type="number"
                value={locationLongitude}
                onChange={handleLocationLongitudeChange}
                placeholder="116.397"
              />{' '}
              {/* 经度 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>地址（可选）{/* 标签 */}</label>
              <input
                type="text"
                value={locationAddress}
                onChange={handleLocationAddressChange}
                placeholder="北京市"
              />{' '}
              {/* 地址 */}
              {/* 表单组结束 */}
            </div>
            <div className="form-group">
              {' '}
              {/* 表单组 */}
              <label>建筑名称（可选）{/* 标签 */}</label>
              <input
                type="text"
                value={locationBuildingName}
                onChange={handleLocationBuildingNameChange}
                placeholder="某某大厦"
              />{' '}
              {/* 建筑名称 */}
              {/* 表单组结束 */}
            </div>
            {/* 位置表单结束 */}
          </>
        ); // 返回结束
      } // 分支结束
      default: {
        // 默认分支
        return <div className="form-group">暂无字段</div>; // 返回空状态
      } // 默认结束
    } // switch 结束
  }; // 函数结束

  return (
    // 返回 UI
    <div className="card">
      {' '}
      {/* 发送卡片 */}
      <div className="card-title">发送消息{/* 标题 */}</div>
      <div className="form-group">
        {' '}
        {/* 表单组 */}
        <label>消息类型{/* 标签 */}</label>
        <select
          data-testid="send-message-type-select"
          value={messageType}
          onChange={handleMessageTypeChange}
        >
          {' '}
          {/* 类型选择 */}
          <option value="text">文本{/* 文本 */}</option>
          <option value="image">图片{/* 图片 */}</option>
          <option value="voice">语音{/* 语音 */}</option>
          <option value="video">视频{/* 视频 */}</option>
          <option value="file">文件{/* 文件 */}</option>
          <option value="custom">自定义{/* 自定义 */}</option>
          <option value="cmd">命令{/* 命令 */}</option>
          <option value="location">位置{/* 位置 */}</option>
          {/* 类型选择结束 */}
        </select>
        {/* 表单组结束 */}
      </div>
      <div className="form-group">
        {' '}
        {/* 表单组 */}
        <label>会话类型{/* 标签 */}</label>
        <select
          data-testid="send-channel-type-select"
          value={channelType}
          onChange={handleChannelTypeChange}
        >
          {' '}
          {/* 会话选择 */}
          <option value="single">单聊{/* 单聊 */}</option>
          <option value="group">群聊{/* 群聊 */}</option>
          <option value="room">聊天室{/* 聊天室 */}</option>
          {/* 会话选择结束 */}
        </select>
        {/* 表单组结束 */}
      </div>
      <div className="form-group">
        {' '}
        {/* 表单组 */}
        <label>目标 ID{/* 标签 */}</label>
        <input
          data-testid="send-targetid-input"
          type="text"
          value={targetId}
          onChange={handleTargetIdChange}
          placeholder="请输入目标 ID"
        />{' '}
        {/* 目标 ID */}
        {/* 表单组结束 */}
      </div>
      <div className="form-group">
        {' '}
        {/* 表单组 */}
        <label>消息 env（可选）{/* 标签 */}</label>
        <input
          data-testid="send-env-input"
          type="text"
          value={messageEnv}
          onChange={handleMessageEnvChange}
          placeholder="请输入可选 env"
        />
        {/* 表单组结束 */}
      </div>
      {renderTypeFields()} {/* 渲染类型字段 */}
      <button
        data-testid="send-submit-button"
        className="btn btn-success"
        type="button"
        onClick={() => {
          void handleSend();
        }}
        disabled={loading}
      >
        {' '}
        {/* 发送按钮 */}
        {loading ? '发送中...' : '发送消息'} {/* 按钮文本 */}
        {/* 发送按钮结束 */}
      </button>
      <div className="card-title" style={{ marginTop: 24 }}>
        消息动作 Smoke
      </div>
      <p style={{ color: '#666', marginTop: 8 }}>
        复用当前目标 ID 和会话类型，提供一条浏览器端
        <code> chatManager.markConversationRead(...)</code> 校验路径。
      </p>
      <button
        data-testid="send-mark-conversation-read-button"
        type="button"
        className="btn"
        onClick={() => {
          void handleMarkConversationRead();
        }}
        disabled={actionLoading}
      >
        {actionLoading ? '处理中...' : '标记当前会话已读'}
      </button>
      {/* 发送卡片结束 */}
    </div>
  ); // 返回结束
}; // 组件结束
