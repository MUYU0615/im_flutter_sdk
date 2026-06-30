import { useState } from 'react';
import type { ChatConversationType } from 'im-sdk-web';
import { formatError, safeJsonStringify, withTimeout } from '../utils';
import type { DemoClient, LogType, MessageRecord } from '../types';

export interface ChatManagerPanelProps {
  readonly client: DemoClient | null;
  readonly onAddLog: (type: LogType, message: string) => void;
  readonly defaultTargetId?: string;
}

const T = 10000;

const log = (onAddLog: (t: LogType, m: string) => void, api: string, result: unknown): void => {
  const json = safeJsonStringify(result);
  onAddLog('success', `${api} ✅\n${json}`);
  console.log(`[ChatManager] ${api}`, result);
};

const logErr = (onAddLog: (t: LogType, m: string) => void, api: string, err: unknown): void => {
  onAddLog('error', `${api} ❌ ${formatError(err)}`);
  console.error(`[ChatManager] ${api}`, err);
};

export const ChatManagerPanel = (props: ChatManagerPanelProps): JSX.Element => {
  const { client, onAddLog, defaultTargetId } = props;
  const [targetId, setTargetId] = useState(defaultTargetId ?? '');
  const [messageId, setMessageId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [convType, setConvType] = useState<ChatConversationType>('singleChat');
  const [reaction, setReaction] = useState('👍');
  const [editText, setEditText] = useState('');
  const [translateLang, setTranslateLang] = useState('zh-Hans');
  const [pageSize, setPageSize] = useState('20');
  const [cursor, setCursor] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentSecret, setAttachmentSecret] = useState('');
  const [attachmentFilename, setAttachmentFilename] = useState('attachment.bin');
  const [attachmentFiletype, setAttachmentFiletype] = useState('application/octet-stream');
  const [combineUrl, setCombineUrl] = useState('');
  const [combineSecret, setCombineSecret] = useState('');
  const [combineFilename, setCombineFilename] = useState('combine.json');
  const [loading, setLoading] = useState(false);

  const cm = client?.chatManager;

  const resolveConversationId = (): string => {
    if (convType === 'groupChat' && groupId.trim()) {
      return groupId.trim();
    }
    return targetId.trim();
  };

  const createBaseMessage = (): Omit<MessageRecord, 'type' | 'body'> => ({
    msgServerId: messageId.trim(),
    msgLocalId: '',
    from: client?.getCurrentUserId() ?? 'demo-user',
    to: resolveConversationId(),
    sender: { userId: client?.getCurrentUserId() ?? 'demo-user' },
    conversationId: resolveConversationId(),
    conversationType: convType,
    status: 'sent',
    ext: {},
    timestamp: Date.now(),
    direct: 'SEND',
  });

  const createReadAckMessage = (): MessageRecord => ({
    ...createBaseMessage(),
    from: resolveConversationId(),
    to: client?.getCurrentUserId() ?? 'demo-user',
    sender: { userId: resolveConversationId() },
    status: 'sent',
    direct: 'RECEIVE',
    type: 'text',
    body: { content: editText.trim() || 'read ack target' },
  });

  const createAttachmentMessage = (): MessageRecord => ({
    ...createBaseMessage(),
    type: 'file',
    body: {
      url: attachmentUrl.trim() || undefined,
      filename: attachmentFilename.trim() || 'attachment.bin',
      filetype: attachmentFiletype.trim() || 'application/octet-stream',
      secret: attachmentSecret.trim() || undefined,
    },
  });

  const guard = (): boolean => {
    if (!client || !cm) {
      onAddLog('warn', '请先初始化 SDK 并登录');
      return false;
    }
    return true;
  };

  const run = async (api: string, fn: () => Promise<unknown>): Promise<void> => {
    if (!guard()) return;
    setLoading(true);
    try {
      const result = await withTimeout(fn(), T, api);
      log(onAddLog, api, result);
    } catch (err) {
      logErr(onAddLog, api, err);
    } finally {
      setLoading(false);
    }
  };

  const input = (label: string, value: string, set: (v: string) => void, ph?: string) => (
    <label style={{ display: 'block', margin: '4px 0' }}>
      {label}
      <input
        value={value}
        onChange={e => set(e.target.value)}
        placeholder={ph}
        style={{ marginLeft: 4, width: 200 }}
      />
    </label>
  );

  const sel = (label: string, value: string, set: (v: string) => void, opts: string[]) => (
    <label style={{ display: 'block', margin: '4px 0' }}>
      {label}
      <select value={value} onChange={e => set(e.target.value)} style={{ marginLeft: 4 }}>
        {opts.map(o => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );

  const btn = (label: string, fn: () => void) => (
    <button onClick={fn} disabled={loading} style={{ margin: '2px 4px 2px 0' }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: 12 }}>
      <h3>ChatManager API 测试</h3>

      <fieldset style={{ margin: '8px 0' }}>
        <legend>公共参数</legend>
        {input('目标 ID', targetId, setTargetId, 'userId / groupId / chatRoomId')}
        {input('消息 ID', messageId, setMessageId, 'messageId')}
        {input('群组 ID', groupId, setGroupId, 'groupId (群已读/Reaction)')}
        {sel('会话类型', convType, v => setConvType(v as typeof convType), [
          'singleChat',
          'groupChat',
          'chatRoom',
        ])}
        {input('分页大小', pageSize, setPageSize)}
        {input('分页游标', cursor, setCursor)}
      </fieldset>

      <fieldset style={{ margin: '8px 0' }}>
        <legend>已读回执</legend>
        {btn('markConversationRead', () =>
          run('markConversationRead', () =>
            cm!.markConversationRead({ conversationId: targetId, conversationType: convType })
          )
        )}
        {btn('markMessageRead', () =>
          run('markMessageRead', () =>
            cm!.markMessageRead({
              messages: [
                {
                  message: createReadAckMessage(),
                  ackContent: convType === 'groupChat' ? editText.trim() || undefined : undefined,
                },
              ],
            })
          )
        )}
      </fieldset>

      <fieldset style={{ margin: '8px 0' }}>
        <legend>撤回 / 编辑</legend>
        {input('编辑文本', editText, setEditText, '新的消息内容')}
        {btn('recallMessage', () =>
          run('recallMessage', () =>
            cm!.recallMessage({ messageId, conversationId: targetId, conversationType: convType })
          )
        )}
        {btn('modifyMessage', () =>
          run('modifyMessage', () =>
            cm!.modifyMessage({
              messageId,
              conversationId: targetId,
              conversationType: convType,
              message: {
                type: 'text',
                body: { content: editText },
                ext: {},
              },
            })
          )
        )}
      </fieldset>

      <fieldset style={{ margin: '8px 0' }}>
        <legend>历史消息</legend>
        {btn('getHistoryMessages', () =>
          run('getHistoryMessages', () =>
            cm!.getHistoryMessages({
              conversationId: targetId,
              conversationType: convType,
              pageSize: Number(pageSize),
              cursor: cursor || undefined,
            })
          )
        )}
        {btn('removeHistoryMessages (by ID)', () =>
          run('removeHistoryMessages', () =>
            cm!.removeHistoryMessages({
              conversationId: targetId,
              conversationType: convType,
              messageIds: [messageId],
            })
          )
        )}
      </fieldset>

      <fieldset style={{ margin: '8px 0' }}>
        <legend>群已读</legend>
        {btn('getGroupMessageReadUsers', () =>
          run('getGroupMessageReadUsers', () =>
            cm!.getGroupMessageReadUsers({
              groupId: groupId || targetId,
              messageId,
              pageSize: Number(pageSize),
            })
          )
        )}
      </fieldset>

      <fieldset style={{ margin: '8px 0' }}>
        <legend>附件下载</legend>
        {input('附件 URL', attachmentUrl, setAttachmentUrl, '文件消息的远端 url')}
        {input('附件 Secret', attachmentSecret, setAttachmentSecret, '可选')}
        {input('附件文件名', attachmentFilename, setAttachmentFilename, 'attachment.bin')}
        {input('附件 MIME', attachmentFiletype, setAttachmentFiletype, 'application/octet-stream')}
        {input('合并消息 URL', combineUrl, setCombineUrl, 'combine 消息下载地址')}
        {input('合并消息 Secret', combineSecret, setCombineSecret, '可选')}
        {input('合并消息文件名', combineFilename, setCombineFilename, 'combine.json')}
        {btn('downloadAttachment', () =>
          run('downloadAttachment', () =>
            cm!.downloadAttachment({ message: createAttachmentMessage() })
          )
        )}
        {btn('downloadAndParseCombineMessage', () =>
          run('downloadAndParseCombineMessage', () =>
            cm!.downloadAndParseCombineMessage({
              url: combineUrl.trim(),
              secret: combineSecret.trim() || undefined,
            })
          )
        )}
      </fieldset>

      <fieldset style={{ margin: '8px 0' }}>
        <legend>Reaction</legend>
        {input('Reaction', reaction, setReaction, '表情符号')}
        {btn('addReaction', () =>
          run('addReaction', () => cm!.addReaction({ messageId, reaction }))
        )}
        {btn('removeReaction', () =>
          run('removeReaction', () => cm!.removeReaction({ messageId, reaction }))
        )}
        {btn('getReactionList', () =>
          run('getReactionList', () =>
            convType === 'chatRoom'
              ? Promise.reject(new Error('getReactionList 仅支持 singleChat / groupChat'))
              : cm!.getReactionList({
                  messageId,
                  conversationType: convType,
                  groupId: convType === 'groupChat' ? groupId || targetId : undefined,
                })
          )
        )}
        {btn('getReactionDetail', () =>
          run('getReactionDetail', () =>
            cm!.getReactionDetail({
              messageId,
              reaction,
              pageSize: Number(pageSize),
              cursor: cursor || undefined,
            })
          )
        )}
      </fieldset>

      <fieldset style={{ margin: '8px 0' }}>
        <legend>消息置顶</legend>
        {btn('pinMessage', () =>
          run('pinMessage', () =>
            cm!.pinMessage({ messageId, conversationId: targetId, conversationType: convType })
          )
        )}
        {btn('unpinMessage', () =>
          run('unpinMessage', () =>
            cm!.unpinMessage({ messageId, conversationId: targetId, conversationType: convType })
          )
        )}
        {btn('getPinnedMessageList', () =>
          run('getPinnedMessageList', () =>
            cm!.getPinnedMessageList({
              conversationId: targetId,
              conversationType: convType,
            })
          )
        )}
      </fieldset>


      <fieldset style={{ margin: '8px 0' }}>
        <legend>翻译</legend>
        {input('目标语言', translateLang, setTranslateLang, 'zh-Hans, en, ja...')}
        {btn('getSupportedTranslationLanguages', () =>
          run('getSupportedTranslationLanguages', () => cm!.getSupportedTranslationLanguages())
        )}
        {btn('translateMessage', () =>
          run('translateMessage', () =>
            cm!.translateMessage({
              message: {
                id: messageId,
                type: 'text',
                body: { content: editText || 'hello' },
              } as never,
              targetLanguages: translateLang.split(',').map(s => s.trim()),
            })
          )
        )}
      </fieldset>
    </div>
  );
};
