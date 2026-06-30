import { useMemo, useState } from 'react';
import { formatError, safeJsonStringify, withTimeout } from '../utils';
import type { VoiceParams } from 'im-sdk-web';
import type { DemoClient, LogType, MessageRecord } from '../types';
import { selectRecentVoiceMessages } from './voice-to-text-helpers';

export interface VoiceToTextPanelProps {
  readonly client: DemoClient | null;
  readonly messages: ReadonlyArray<MessageRecord>;
  readonly onAddLog: (type: LogType, message: string) => void;
}

const VOICE_TO_TEXT_TIMEOUT = 20000;

const parseNumberInput = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildVoiceParams = (form: {
  readonly format: string;
  readonly sampleRate: string;
  readonly bitsPerSample: string;
  readonly channels: string;
}): VoiceParams | undefined => {
  const voiceParams: VoiceParams = {
    ...(form.format.trim() ? { format: form.format.trim() } : {}),
    ...(parseNumberInput(form.sampleRate) !== undefined
      ? { sampleRate: parseNumberInput(form.sampleRate) }
      : {}),
    ...(parseNumberInput(form.bitsPerSample) !== undefined
      ? { bitsPerSample: parseNumberInput(form.bitsPerSample) }
      : {}),
    ...(parseNumberInput(form.channels) !== undefined
      ? { channels: parseNumberInput(form.channels) }
      : {}),
  };
  return Object.keys(voiceParams).length > 0 ? voiceParams : undefined;
};

export const VoiceToTextPanel = (props: VoiceToTextPanelProps): JSX.Element => {
  const { client, messages, onAddLog } = props;
  const [selectedVoiceMessageId, setSelectedVoiceMessageId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [format, setFormat] = useState('');
  const [sampleRate, setSampleRate] = useState('');
  const [bitsPerSample, setBitsPerSample] = useState('');
  const [channels, setChannels] = useState('');
  const [loadingAction, setLoadingAction] = useState<'message' | 'file' | null>(null);
  const [resultText, setResultText] = useState<string>('');
  const [resultMeta, setResultMeta] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');

  const recentVoiceMessages = useMemo(() => selectRecentVoiceMessages(messages), [messages]);

  const selectedVoiceMessage = useMemo(() => {
    return recentVoiceMessages.find(item => item.id === selectedVoiceMessageId) ?? null;
  }, [recentVoiceMessages, selectedVoiceMessageId]);

  const resetFeedback = (): void => {
    setResultText('');
    setResultMeta('');
    setErrorText('');
  };

  const guardClient = (): DemoClient | null => {
    if (!client) {
      const message = '请先初始化 SDK 并登录';
      setErrorText(message);
      onAddLog('warn', message);
      return null;
    }
    return client;
  };

  const voiceParams = buildVoiceParams({
    format,
    sampleRate,
    bitsPerSample,
    channels,
  });

  const handleMessageToText = async (): Promise<void> => {
    const runtimeClient = guardClient();
    if (!runtimeClient) {
      return;
    }
    if (!selectedVoiceMessage) {
      const message = '请选择最近语音消息';
      setErrorText(message);
      onAddLog('warn', message);
      return;
    }
    resetFeedback();
    setLoadingAction('message');
    try {
      const result = await withTimeout(
        runtimeClient.chatManager.voiceMessageToText(selectedVoiceMessage.message, voiceParams),
        VOICE_TO_TEXT_TIMEOUT,
        'voiceMessageToText'
      );
      setResultText(result.text);
      setResultMeta(
        safeJsonStringify({
          api: 'voiceMessageToText',
          source: selectedVoiceMessage.message.filename,
          voiceParams,
        })
      );
      onAddLog('success', `voiceMessageToText ✅ ${safeJsonStringify(result)}`);
    } catch (error) {
      const formatted = formatError(error);
      setErrorText(formatted);
      onAddLog('error', `voiceMessageToText ❌ ${formatted}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFileToText = async (): Promise<void> => {
    const runtimeClient = guardClient();
    if (!runtimeClient) {
      return;
    }
    if (!selectedFile) {
      const message = '请选择本地语音文件';
      setErrorText(message);
      onAddLog('warn', message);
      return;
    }
    resetFeedback();
    setLoadingAction('file');
    try {
      const result = await withTimeout(
        runtimeClient.chatManager.voiceFileToText(selectedFile, voiceParams),
        VOICE_TO_TEXT_TIMEOUT,
        'voiceFileToText'
      );
      setResultText(result.text);
      setResultMeta(
        safeJsonStringify({
          api: 'voiceFileToText',
          source: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          voiceParams,
        })
      );
      onAddLog('success', `voiceFileToText ✅ ${safeJsonStringify(result)}`);
    } catch (error) {
      const formatted = formatError(error);
      setErrorText(formatted);
      onAddLog('error', `voiceFileToText ❌ ${formatted}`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="card" data-testid="voice-to-text-panel">
      <div className="card-title">语音转文字</div>
      <p className="voice-to-text-note">
        保留旧方法名 `voiceMessageToText` / `voiceFileToText`，成功返回 `{'{ text }'}`， 失败展示
        SDKError 与旧兼容错误码。
      </p>

      <div className="voice-to-text-grid">
        <section className="voice-to-text-section">
          <h3>最近语音消息</h3>
          <div className="form-group">
            <label htmlFor="voice-to-text-message-select">选择一条最近语音消息</label>
            <select
              id="voice-to-text-message-select"
              data-testid="voice-to-text-message-select"
              value={selectedVoiceMessageId}
              onChange={event => setSelectedVoiceMessageId(event.target.value)}
            >
              <option value="">请选择</option>
              {recentVoiceMessages.map(item => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <p className="voice-to-text-subtle">
            {recentVoiceMessages.length > 0
              ? `当前可选 ${recentVoiceMessages.length} 条语音消息`
              : '当前消息列表里还没有可转写的语音消息'}
          </p>
          <button
            className="btn btn-primary"
            data-testid="voice-to-text-message-button"
            disabled={loadingAction !== null}
            onClick={() => {
              void handleMessageToText();
            }}
            type="button"
          >
            {loadingAction === 'message' ? '转写中...' : 'voiceMessageToText'}
          </button>
        </section>

        <section className="voice-to-text-section">
          <h3>本地语音文件</h3>
          <div className="form-group">
            <label htmlFor="voice-to-text-file-input">选择本地文件</label>
            <input
              id="voice-to-text-file-input"
              data-testid="voice-to-text-file-input"
              type="file"
              accept=".amr,.mp3,.wav,.m4a,.aac,.pcm,audio/*"
              onChange={event => {
                setSelectedFile(event.target.files?.[0] ?? null);
              }}
            />
          </div>
          <p className="voice-to-text-subtle" data-testid="voice-to-text-file-name">
            {selectedFile
              ? `已选择: ${selectedFile.name} (${selectedFile.type || 'unknown'})`
              : '尚未选择本地语音文件'}
          </p>
          <button
            className="btn btn-success"
            data-testid="voice-to-text-file-button"
            disabled={loadingAction !== null}
            onClick={() => {
              void handleFileToText();
            }}
            type="button"
          >
            {loadingAction === 'file' ? '转写中...' : 'voiceFileToText'}
          </button>
        </section>
      </div>

      <section className="voice-to-text-section">
        <h3>voiceParams</h3>
        <div className="voice-to-text-grid voice-to-text-grid-compact">
          <div className="form-group">
            <label htmlFor="voice-to-text-format-input">format</label>
            <input
              id="voice-to-text-format-input"
              data-testid="voice-to-text-format-input"
              type="text"
              value={format}
              onChange={event => setFormat(event.target.value)}
              placeholder="amr / pcm / mp3"
            />
          </div>
          <div className="form-group">
            <label htmlFor="voice-to-text-sample-rate-input">sampleRate</label>
            <input
              id="voice-to-text-sample-rate-input"
              data-testid="voice-to-text-sample-rate-input"
              type="number"
              value={sampleRate}
              onChange={event => setSampleRate(event.target.value)}
              placeholder="16000"
            />
          </div>
          <div className="form-group">
            <label htmlFor="voice-to-text-bits-input">bitsPerSample</label>
            <input
              id="voice-to-text-bits-input"
              data-testid="voice-to-text-bits-input"
              type="number"
              value={bitsPerSample}
              onChange={event => setBitsPerSample(event.target.value)}
              placeholder="16"
            />
          </div>
          <div className="form-group">
            <label htmlFor="voice-to-text-channels-input">channels</label>
            <input
              id="voice-to-text-channels-input"
              data-testid="voice-to-text-channels-input"
              type="number"
              value={channels}
              onChange={event => setChannels(event.target.value)}
              placeholder="1"
            />
          </div>
        </div>
        <pre className="voice-to-text-json" data-testid="voice-to-text-audio-params">
          {safeJsonStringify(voiceParams ?? {})}
        </pre>
      </section>

      <section className="voice-to-text-section">
        <h3>结果</h3>
        <div className="voice-to-text-result" data-testid="voice-to-text-result">
          {resultText || '暂无转写结果'}
        </div>
        <div className="voice-to-text-error" data-testid="voice-to-text-error">
          {errorText || '暂无错误'}
        </div>
        <pre className="voice-to-text-json" data-testid="voice-to-text-meta">
          {resultMeta || '{}'}
        </pre>
      </section>
    </div>
  );
};
