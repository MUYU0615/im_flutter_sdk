import { useState } from 'react'; // 引入 React hooks
import { formatError, safeJsonStringify, withTimeout } from '../utils'; // 引入工具方法
import type { DemoClient, LogType, MessageRecord } from '../types'; // 引入消息类型

export interface MessagePanelProps {
  // 消息面板属性
  readonly messages: ReadonlyArray<MessageRecord>; // 消息列表
  readonly client: DemoClient | null; // SDK 实例
  readonly onAddLog: (type: LogType, message: string) => void; // 日志回调
  readonly onClear: () => void; // 清空回调
} // 接口结束

const COMBINE_DETAIL_TIMEOUT = 15000;

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  // 消息类型文案
  text: '文本', // 文本
  image: '图片', // 图片
  voice: '语音', // 语音
  video: '视频', // 视频
  file: '文件', // 文件
  location: '位置', // 位置
  cmd: '命令', // 命令
  custom: '自定义', // 自定义
  combine: '合并', // 合并
}; // 文案结束

const isRecord = (value: unknown): value is Record<string, unknown> => {
  // 判断是否为对象
  return typeof value === 'object' && value !== null && !Array.isArray(value); // 校验对象
}; // 函数结束

const readString = (record: Record<string, unknown>, key: string): string | undefined => {
  // 读取字符串字段
  const value = record[key]; // 读取字段
  if (typeof value === 'string' && value.trim()) {
    // 校验字符串
    return value; // 返回值
  } // 判断结束
  return undefined; // 返回空
}; // 函数结束

const readNumber = (record: Record<string, unknown>, key: string): number | undefined => {
  // 读取数字字段
  const value = record[key]; // 读取字段
  if (typeof value === 'number' && Number.isFinite(value)) {
    // 校验数字
    return value; // 返回值
  } // 判断结束
  return undefined; // 返回空
}; // 函数结束

const readBoolean = (record: Record<string, unknown>, key: string): boolean | undefined => {
  // 读取布尔字段
  const value = record[key]; // 读取字段
  if (typeof value === 'boolean') {
    // 校验布尔值
    return value; // 返回值
  } // 判断结束
  return undefined; // 返回空
}; // 函数结束

const readRecord = (
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined => {
  // 读取对象字段
  const value = record[key]; // 读取字段
  if (isRecord(value)) {
    // 校验对象
    return value; // 返回对象
  } // 判断结束
  return undefined; // 返回空
}; // 函数结束

const readStringArray = (
  record: Record<string, unknown>,
  key: string
): ReadonlyArray<string> | undefined => {
  // 读取字符串数组
  const value = record[key]; // 读取字段
  if (Array.isArray(value) && value.every((item): boolean => typeof item === 'string')) {
    // 校验数组
    return value as ReadonlyArray<string>; // 返回数组
  } // 判断结束
  return undefined; // 返回空
}; // 函数结束

const formatFileSize = (value?: number): string => {
  // 格式化文件大小
  if (value === undefined) {
    // 未提供大小
    return '未知'; // 返回未知
  } // 判断结束
  if (!Number.isFinite(value)) {
    // 非法数值
    return '未知'; // 返回未知
  } // 判断结束
  if (value < 1024) {
    // 小于 1KB
    return `${value} B`; // 返回字节
  } // 判断结束
  const kb = value / 1024; // 转换 KB
  if (kb < 1024) {
    // 小于 1MB
    return `${kb.toFixed(1)} KB`; // 返回 KB
  } // 判断结束
  const mb = kb / 1024; // 转换 MB
  return `${mb.toFixed(1)} MB`; // 返回 MB
}; // 函数结束

const formatMessageTime = (timestamp: number): string => {
  // 格式化时间
  const date = new Date(timestamp); // 创建时间对象
  return date.toLocaleString(); // 返回本地时间
}; // 函数结束

const resolveTypeLabel = (type: string): string => {
  // 解析消息类型文案
  return MESSAGE_TYPE_LABELS[type] ?? `未知(${type})`; // 返回文案
}; // 函数结束

const getMessageId = (message: MessageRecord): string => {
  return message.msgServerId || message.msgLocalId;
};

const renderEmptyBody = (label: string): JSX.Element => {
  // 渲染空内容
  return <div className="message-empty">{label}</div>; // 返回占位
}; // 函数结束

const renderImageVariant = (label: string, url?: string, isPreview = false): JSX.Element | null => {
  if (!url) {
    return null;
  }
  return (
    <div className="image-variant-card">
      <div className="image-variant-header">
        <span className="image-variant-title">{label}</span>
        <a className="message-link" href={url} target="_blank" rel="noreferrer">
          打开
        </a>
      </div>
      <div className="image-variant-url">{url}</div>
      <img
        className={
          isPreview
            ? 'image-variant-preview image-variant-preview-thumbnail'
            : 'image-variant-preview'
        }
        src={url}
        alt={label}
      />
    </div>
  );
};

const renderTextContent = (body: Record<string, unknown>): JSX.Element => {
  // 渲染文本内容
  const message = readString(body, 'content') ?? readString(body, 'message'); // 优先读 content，兼容旧字段 message
  const targetLanguages = readStringArray(body, 'targetLanguages'); // 读取目标语言
  const translations = readRecord(body, 'translations'); // 读取翻译内容
  return (
    // 返回文本内容
    <div className="message-block">
      {' '}
      {/* 文本块 */}
      <div className="message-line">{message ?? '（空文本）'}</div> {/* 文本内容 */}
      {targetLanguages ? ( // 目标语言
        <div className="message-line">
          目标语言: {targetLanguages.join(', ')}
        </div> /* 目标语言内容 */
      ) : null}{' '}
      {/* 目标语言结束 */}
      {translations ? ( // 翻译内容
        <div className="message-line">
          翻译内容: {safeJsonStringify(translations)}
        </div> /* 翻译内容 */
      ) : null}{' '}
      {/* 翻译结束 */}
    </div> // 文本块结束
  ); // 返回结束
}; // 函数结束

const renderImageContent = (body: Record<string, unknown>): JSX.Element => {
  // 渲染图片内容
  const originalImageUrl = readString(body, 'originalImageUrl') ?? readString(body, 'url');
  const bigImageUrl = readString(body, 'bigImageUrl') ?? readString(body, 'largeImageUrl');
  const thumbnailUrl = readString(body, 'thumbnailUrl') ?? readString(body, 'thumb'); // 读取缩略图
  const previewUrl = thumbnailUrl ?? bigImageUrl ?? originalImageUrl; // 预览地址
  const filename = readString(body, 'filename'); // 读取文件名
  const filetype = readString(body, 'filetype'); // 读取文件类型
  const width = readNumber(body, 'width'); // 读取宽度
  const height = readNumber(body, 'height'); // 读取高度
  const fileLength = readNumber(body, 'fileLength'); // 读取大小
  const isGif = readBoolean(body, 'isGif'); // 读取 GIF 标记
  const isOriginalImage = readBoolean(body, 'isOriginalImage'); // 读取发送语义
  return (
    // 返回图片内容
    <div className="message-block">
      {' '}
      {/* 图片块 */}
      {previewUrl ? ( // 图片预览
        <img
          className="message-media-image"
          src={previewUrl}
          alt={filename ?? '图片消息'}
        /> /* 图片 */
      ) : (
        // 无预览
        renderEmptyBody('图片地址缺失') /* 空占位 */
      )}{' '}
      {/* 预览结束 */}
      <div className="message-line">文件名: {filename ?? '未知'}</div> {/* 文件名 */}
      <div className="message-line">文件类型: {filetype ?? '未知'}</div> {/* 文件类型 */}
      <div className="message-line">
        尺寸: {width ?? '-'} x {height ?? '-'}
      </div>{' '}
      {/* 尺寸 */}
      <div className="message-line">大小: {formatFileSize(fileLength)}</div>
      <div className="message-line">
        发送语义: {isOriginalImage === undefined ? '未知' : isOriginalImage ? '原图' : '大图'}
      </div>
      <div className="message-line">是否 GIF: {isGif ? '是' : '否'}</div> {/* GIF */}
      <div className="image-variant-grid">
        {renderImageVariant('原图', originalImageUrl)}
        {renderImageVariant('大图', bigImageUrl)}
        {renderImageVariant('缩略图', thumbnailUrl, true)}
      </div>
    </div> // 图片块结束
  ); // 返回结束
}; // 函数结束

const renderVoiceContent = (body: Record<string, unknown>): JSX.Element => {
  // 渲染语音内容
  const url = readString(body, 'url'); // 读取语音地址
  const filename = readString(body, 'filename'); // 读取文件名
  const filetype = readString(body, 'filetype'); // 读取文件类型
  const duration = readNumber(body, 'duration'); // 读取时长
  const fileSize = readNumber(body, 'fileLength'); // 读取大小
  return (
    // 返回语音内容
    <div className="message-block">
      {' '}
      {/* 语音块 */}
      {url ? ( // 有音频地址
        <audio className="message-media-audio" controls src={url} /> /* 语音播放器 */
      ) : (
        // 无音频地址
        renderEmptyBody('语音地址缺失') /* 空占位 */
      )}{' '}
      {/* 预览结束 */}
      <div className="message-line">文件名: {filename ?? '未知'}</div> {/* 文件名 */}
      <div className="message-line">文件类型: {filetype ?? '未知'}</div> {/* 文件类型 */}
      <div className="message-line">时长: {duration ?? '-'} 秒</div> {/* 时长 */}
      <div className="message-line">大小: {formatFileSize(fileSize)}</div> {/* 文件大小 */}
    </div> // 语音块结束
  ); // 返回结束
}; // 函数结束

const renderVideoContent = (body: Record<string, unknown>): JSX.Element => {
  // 渲染视频内容
  const url = readString(body, 'url'); // 读取视频地址
  const thumbnailUrl = readString(body, 'thumbnailUrl') ?? readString(body, 'thumb'); // 读取缩略图
  const filename = readString(body, 'filename'); // 读取文件名
  const filetype = readString(body, 'filetype'); // 读取文件类型
  const duration = readNumber(body, 'duration'); // 读取时长
  const width = readNumber(body, 'width'); // 读取宽度
  const height = readNumber(body, 'height'); // 读取高度
  const fileSize = readNumber(body, 'fileLength'); // 读取大小
  return (
    // 返回视频内容
    <div className="message-block">
      {' '}
      {/* 视频块 */}
      {url ? ( // 有视频地址
        <video
          className="message-media-video"
          controls
          src={url}
          poster={thumbnailUrl ?? undefined}
        /> /* 视频播放器 */
      ) : (
        // 无视频地址
        renderEmptyBody('视频地址缺失') /* 空占位 */
      )}{' '}
      {/* 预览结束 */}
      <div className="message-line">文件名: {filename ?? '未知'}</div> {/* 文件名 */}
      <div className="message-line">文件类型: {filetype ?? '未知'}</div> {/* 文件类型 */}
      <div className="message-line">时长: {duration ?? '-'} 秒</div> {/* 时长 */}
      <div className="message-line">
        尺寸: {width ?? '-'} x {height ?? '-'}
      </div>{' '}
      {/* 尺寸 */}
      <div className="message-line">大小: {formatFileSize(fileSize)}</div> {/* 文件大小 */}
    </div> // 视频块结束
  ); // 返回结束
}; // 函数结束

const renderFileContent = (body: Record<string, unknown>): JSX.Element => {
  // 渲染文件内容
  const url = readString(body, 'url'); // 读取文件地址
  const filename = readString(body, 'filename'); // 读取文件名
  const filetype = readString(body, 'filetype'); // 读取文件类型
  const fileSize = readNumber(body, 'fileSize') ?? readNumber(body, 'fileLength'); // 读取大小
  return (
    // 返回文件内容
    <div className="message-block">
      {' '}
      {/* 文件块 */}
      <div className="message-line">文件名: {filename ?? '未知'}</div> {/* 文件名 */}
      <div className="message-line">文件类型: {filetype ?? '未知'}</div> {/* 文件类型 */}
      <div className="message-line">大小: {formatFileSize(fileSize)}</div> {/* 文件大小 */}
      {url ? ( // 有地址
        <a className="message-link" href={url} target="_blank" rel="noreferrer">
          下载文件
        </a> /* 下载链接 */
      ) : (
        // 无地址
        renderEmptyBody('文件地址缺失') /* 空占位 */
      )}{' '}
      {/* 链接结束 */}
    </div> // 文件块结束
  ); // 返回结束
}; // 函数结束

const renderLocationContent = (body: Record<string, unknown>): JSX.Element => {
  // 渲染位置内容
  const latitude = readNumber(body, 'latitude'); // 读取纬度
  const longitude = readNumber(body, 'longitude'); // 读取经度
  const address = readString(body, 'address'); // 读取地址
  const buildingName = readString(body, 'buildingName'); // 读取建筑名
  if (latitude === undefined || longitude === undefined) {
    // 缺少坐标
    return renderEmptyBody('位置坐标缺失'); // 返回占位
  } // 判断结束
  return (
    // 返回位置内容
    <div className="message-block">
      {' '}
      {/* 位置块 */}
      <div className="message-line">
        坐标: {latitude}, {longitude}
      </div>{' '}
      {/* 坐标 */}
      <div className="message-line">地址: {address ?? '未知'}</div> {/* 地址 */}
      <div className="message-line">建筑: {buildingName ?? '未知'}</div> {/* 建筑 */}
    </div> // 位置块结束
  ); // 返回结束
}; // 函数结束

const renderCmdContent = (body: Record<string, unknown>): JSX.Element => {
  // 渲染命令内容
  const action = readString(body, 'action'); // 读取命令动作
  const params = readRecord(body, 'params'); // 读取命令参数
  const deliverOnlineOnly = readBoolean(body, 'deliverOnlineOnly'); // 读取投递标记
  return (
    // 返回命令内容
    <div className="message-block">
      {' '}
      {/* 命令块 */}
      <div className="message-line">动作: {action ?? '未知'}</div> {/* 动作 */}
      <div className="message-line">参数: {params ? safeJsonStringify(params) : '无'}</div>{' '}
      {/* 参数 */}
      <div className="message-line">仅在线投递: {deliverOnlineOnly ? '是' : '否'}</div>{' '}
      {/* 投递标记 */}
    </div> // 命令块结束
  ); // 返回结束
}; // 函数结束

const renderCustomContent = (body: Record<string, unknown>): JSX.Element => {
  // 渲染自定义内容
  const event = readString(body, 'event'); // 读取事件
  const params = readRecord(body, 'params'); // 读取参数
  return (
    // 返回自定义内容
    <div className="message-block">
      {' '}
      {/* 自定义块 */}
      <div className="message-line">事件: {event ?? '未知'}</div> {/* 事件 */}
      <div className="message-line">参数: {params ? safeJsonStringify(params) : '无'}</div>{' '}
      {/* 参数 */}
    </div> // 自定义块结束
  ); // 返回结束
}; // 函数结束

const renderCombineDetailList = (messages: ReadonlyArray<MessageRecord>): JSX.Element => {
  if (messages.length === 0) {
    return <div className="message-empty">合并详情为空</div>;
  }
  return (
    <div className="combine-detail-list">
      {messages.map((item): JSX.Element => {
        const itemBody = isRecord(item.body) ? item.body : {};
        const text = readString(itemBody, 'message');
        const title = readString(itemBody, 'title');
        const summary = readString(itemBody, 'summary');
        const preview = text ?? summary ?? title ?? safeJsonStringify(itemBody);
        return (
          <div
            className="combine-detail-item"
            key={getMessageId(item) || `${item.timestamp}-${item.type}`}
          >
            <div className="message-line">
              [{resolveTypeLabel(item.type)}] {item.sender.userId || '未知用户'}
            </div>
            <div className="message-line">{preview}</div>
          </div>
        );
      })}
    </div>
  );
};

const renderCombineContent = (
  message: MessageRecord,
  body: Record<string, unknown>,
  options: {
    readonly loading: boolean;
    readonly expanded: boolean;
    readonly details?: ReadonlyArray<MessageRecord>;
    readonly error?: string;
    readonly onToggleDetails: (message: MessageRecord) => void;
  }
): JSX.Element => {
  // 渲染合并内容
  const title = readString(body, 'title'); // 读取标题
  const summary = readString(body, 'summary'); // 读取摘要
  const compatibleText = readString(body, 'compatibleText'); // 读取兼容文本
  const url = readString(body, 'url'); // 读取地址
  const filename = readString(body, 'filename'); // 读取文件名
  const fileLength = readNumber(body, 'fileLength'); // 读取大小
  const combineLevel = readNumber(body, 'combineLevel'); // 读取层级
  return (
    // 返回合并内容
    <div className="message-block">
      {' '}
      {/* 合并块 */}
      <div className="message-line">标题: {title ?? '未知'}</div> {/* 标题 */}
      <div className="message-line">摘要: {summary ?? '未知'}</div> {/* 摘要 */}
      <div className="message-line">兼容文本: {compatibleText ?? '[聊天记录]'}</div>{' '}
      {/* 兼容文本 */}
      <div className="message-line">文件名: {filename ?? 'combine'}</div> {/* 文件名 */}
      <div className="message-line">大小: {formatFileSize(fileLength)}</div> {/* 文件大小 */}
      <div className="message-line">层级: {combineLevel ?? 0}</div> {/* 层级 */}
      {url ? (
        <button
          className="btn btn-primary"
          onClick={(): void => {
            options.onToggleDetails(message);
          }}
          disabled={options.loading}
        >
          {options.loading ? '加载中...' : options.expanded ? '收起合并详情' : '查看合并详情'}
        </button>
      ) : (
        <div className="message-empty">合并详情地址缺失</div>
      )}
      {options.error ? <div className="message-empty">{options.error}</div> : null}
      {options.expanded && options.details ? renderCombineDetailList(options.details) : null}
    </div> // 合并块结束
  ); // 返回结束
}; // 函数结束

const renderMessageContent = (
  message: MessageRecord,
  combineState: {
    readonly loadingMap: Readonly<Record<string, boolean>>;
    readonly expandedMap: Readonly<Record<string, boolean>>;
    readonly detailMap: Readonly<Record<string, ReadonlyArray<MessageRecord>>>;
    readonly errorMap: Readonly<Record<string, string>>;
    readonly onToggleDetails: (message: MessageRecord) => void;
  }
): JSX.Element => {
  // 渲染消息内容
  if (!isRecord(message.body)) {
    // 消息体非对象
    return renderEmptyBody('消息体为空'); // 返回占位
  } // 判断结束
  const body = message.body; // 读取消息体
  switch (
    message.type // 判断类型
  ) {
    case 'text': {
      // 文本
      return renderTextContent(body); // 返回文本内容
    } // 分支结束
    case 'image': {
      // 图片
      return renderImageContent(body); // 返回图片内容
    } // 分支结束
    case 'voice': {
      // 语音
      return renderVoiceContent(body); // 返回语音内容
    } // 分支结束
    case 'video': {
      // 视频
      return renderVideoContent(body); // 返回视频内容
    } // 分支结束
    case 'file': {
      // 文件
      return renderFileContent(body); // 返回文件内容
    } // 分支结束
    case 'location': {
      // 位置
      return renderLocationContent(body); // 返回位置内容
    } // 分支结束
    case 'cmd': {
      // 命令
      return renderCmdContent(body); // 返回命令内容
    } // 分支结束
    case 'custom': {
      // 自定义
      return renderCustomContent(body); // 返回自定义内容
    } // 分支结束
    case 'combine': {
      // 合并
      const messageId = getMessageId(message);
      return renderCombineContent(message, body, {
        loading: Boolean(combineState.loadingMap[messageId]),
        expanded: Boolean(combineState.expandedMap[messageId]),
        details: combineState.detailMap[messageId],
        error: combineState.errorMap[messageId],
        onToggleDetails: combineState.onToggleDetails,
      }); // 返回合并内容
    } // 分支结束
    default: {
      // 其他类型
      return <div className="message-line">{safeJsonStringify(body)}</div>; // 返回原始内容
    } // 分支结束
  } // switch 结束
}; // 函数结束

export const MessagePanel = (props: MessagePanelProps): JSX.Element => {
  // 消息面板组件
  const { messages, client, onAddLog, onClear } = props; // 读取属性
  const [combineLoadingMap, setCombineLoadingMap] = useState<Record<string, boolean>>({});
  const [combineExpandedMap, setCombineExpandedMap] = useState<Record<string, boolean>>({});
  const [combineDetailMap, setCombineDetailMap] = useState<
    Record<string, ReadonlyArray<MessageRecord>>
  >({});
  const [combineErrorMap, setCombineErrorMap] = useState<Record<string, string>>({});

  const handleToggleCombineDetails = async (message: MessageRecord): Promise<void> => {
    const messageId = getMessageId(message);
    if (!messageId) {
      onAddLog('warn', '消息 ID 缺失，无法加载合并详情');
      return;
    }

    if (combineExpandedMap[messageId]) {
      setCombineExpandedMap(prev => ({
        ...prev,
        [messageId]: false,
      }));
      return;
    }

    if (combineDetailMap[messageId]) {
      setCombineExpandedMap(prev => ({
        ...prev,
        [messageId]: true,
      }));
      return;
    }

    if (!client) {
      onAddLog('warn', '请先初始化 SDK');
      return;
    }

    setCombineLoadingMap(prev => ({
      ...prev,
      [messageId]: true,
    }));
    setCombineErrorMap(prev => ({
      ...prev,
      [messageId]: '',
    }));

    try {
      const detailList = await withTimeout(
        client.chatManager.downloadAndParseCombineMessage({
          message,
        }),
        COMBINE_DETAIL_TIMEOUT,
        '加载合并详情'
      );
      setCombineDetailMap(prev => ({
        ...prev,
        [messageId]: detailList,
      }));
      setCombineExpandedMap(prev => ({
        ...prev,
        [messageId]: true,
      }));
      onAddLog('success', `合并详情加载完成: ${messageId} (${detailList.length} 条)`);
    } catch (error) {
      const errorMessage = formatError(error);
      setCombineErrorMap(prev => ({
        ...prev,
        [messageId]: `合并详情加载失败: ${errorMessage}`,
      }));
      onAddLog('error', `合并详情加载失败: ${errorMessage}`);
    } finally {
      setCombineLoadingMap(prev => ({
        ...prev,
        [messageId]: false,
      }));
    }
  };

  const renderMessages = (): JSX.Element => {
    // 渲染消息列表
    if (messages.length === 0) {
      // 无消息
      return (
        <div className="message-item" data-testid="message-item">
          暂无消息
        </div>
      ); // 返回空状态
    } // 判断结束
    return (
      // 返回消息列表
      <>
        {' '}
        {/* 消息列表片段 */}
        {messages.map(
          (message): JSX.Element => (
            // 遍历消息
            <div
              className="message-item"
              data-testid="message-item"
              key={message.msgServerId || message.msgLocalId}
            >
              {' '}
              {/* 消息项 */}
              <div className="from" data-testid="message-item-from">
                发送者: {message.sender.userId || '未知用户'}
              </div>{' '}
              {/* 发送者 */}
              <div className="meta" data-testid="message-item-meta">
                类型: {resolveTypeLabel(message.type)} | 状态: {message.status} | 会话:{' '}
                {message.conversationType}:{message.conversationId}
              </div>{' '}
              {/* 元信息 */}
              <div className="content" data-testid="message-item-content">
                {renderMessageContent(message, {
                  loadingMap: combineLoadingMap,
                  expandedMap: combineExpandedMap,
                  detailMap: combineDetailMap,
                  errorMap: combineErrorMap,
                  onToggleDetails: nextMessage => {
                    void handleToggleCombineDetails(nextMessage);
                  },
                })}
                {/* 内容 */}
              </div>
              <div className="time">
                时间: {formatMessageTime(message.timestamp)} | ID:{' '}
                {message.msgServerId || message.msgLocalId}
              </div>{' '}
              {/* 时间 */}
              {/* 消息项结束 */}
            </div>
          )
        )}{' '}
        {/* 遍历结束 */}
        {/* 消息列表片段结束 */}
      </>
    ); // 返回结束
  }; // 函数结束

  return (
    // 返回 UI
    <div className="card">
      {' '}
      {/* 消息卡片 */}
      <div className="card-title">
        {' '}
        {/* 标题 */}
        消息列表 {/* 标题文本 */}
        <button className="btn btn-warning" onClick={onClear}>
          清空消息{/* 清空按钮 */}
        </button>
        {/* 标题结束 */}
      </div>
      <div className="message-list" data-testid="message-list">
        {' '}
        {/* 列表容器 */}
        {renderMessages()} {/* 渲染消息 */}
        {/* 列表容器结束 */}
      </div>
      {/* 消息卡片结束 */}
    </div>
  ); // 返回结束
}; // 组件结束
