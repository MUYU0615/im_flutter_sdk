import { useState } from 'react';
import type { SearchableMessageType, SearchMessagesResult, SearchResultMessage } from 'im-sdk-web';
import { formatError, safeJsonStringify, withTimeout } from '../utils';
import type { DemoClient, LogType } from '../types';

export interface SearchPanelProps {
  readonly client: DemoClient | null;
  readonly onAddLog: (type: LogType, message: string) => void;
}

const MSG_TYPES: ReadonlyArray<SearchableMessageType> = ['txt', 'img', 'video', 'file', 'loc', 'custom'];
const MSG_TYPE_LABELS: Record<SearchableMessageType, string> = {
  txt: '文本', img: '图片', video: '视频', file: '文件', loc: '位置', custom: '自定义',
};
const T = 15000;

export const SearchPanel = ({ client, onAddLog }: SearchPanelProps): JSX.Element => {
  const [keywords, setKeywords] = useState('');
  const [matchType, setMatchType] = useState<'or' | 'and'>('or');
  const [conversationId, setConversationId] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<SearchableMessageType[]>([]);
  const [searchScope, setSearchScope] = useState<'none' | 'with' | 'only'>('none');
  const [direction, setDirection] = useState<'up' | 'down'>('down');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [pageNum, setPageNum] = useState('1');
  const [pageSize, setPageSize] = useState('20');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchMessagesResult | null>(null);

  const cm = client?.chatManager;

  const toggleType = (t: SearchableMessageType): void => {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSearch = async (): Promise<void> => {
    if (!cm) { onAddLog('error', '请先登录'); return; }
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (keywordList.length === 0) { onAddLog('error', '关键词不能为空'); return; }

    setLoading(true);
    try {
      const res = await withTimeout(cm.searchMessages({
        option: {
          keywordList,
          keywordListMatchType: keywordList.length > 1 ? matchType : undefined,
          conversationId: conversationId.trim() || undefined,
          msgTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
          searchScope,
          direction,
          startTime: startTime ? Number(startTime) : undefined,
          endTime: endTime ? Number(endTime) : undefined,
        },
        pageNum: Number(pageNum) || 1,
        pageSize: Number(pageSize) || 20,
      }), T, 'searchMessages');
      setResult(res);
      onAddLog('success', `searchMessages ✅ 共 ${res.messages.length} 条，第 ${res.pageNum}/${res.totalPages} 页`);
    } catch (err) {
      onAddLog('error', `searchMessages ❌ ${formatError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const getBodySummary = (msg: SearchResultMessage): string => {
    const body = msg.body as Record<string, unknown> | undefined;
    if (!body) return '';
    const t = String(msg.type);
    switch (t) {
      case 'txt': return String(body.content ?? '');
      case 'img': return `[图片] ${body.width}×${body.height}`;
      case 'video': return `[视频] ${body.filename ?? ''} ${body.duration ?? 0}s`;
      case 'file': return `[文件] ${body.filename ?? ''}`;
      case 'loc': return `[位置] ${body.address ?? ''}`;
      case 'custom': return `[自定义] ${body.customEvent ?? ''}`;
      default: return '';
    }
  };

  const renderMessage = (msg: SearchResultMessage, idx: number): JSX.Element => (
    <div key={idx} className="card" style={{ padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>
          <span className="status-badge" style={{ background: '#e6f7ff', color: 'var(--primary-color)', marginRight: 6 }}>{msg.type}</span>
          {msg.from} → {msg.to}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {new Date(msg.timestamp ?? 0).toLocaleString()}
        </span>
      </div>
      {/* 消息摘要（无高亮时显示） */}
      {!(msg.highlight && msg.highlight.length > 0) && (
        <div style={{ fontSize: 13, color: 'var(--text-color)', margin: '4px 0', padding: '4px 8px', background: 'var(--bg-color)', borderRadius: 4 }}>
          {getBodySummary(msg) || '—'}
        </div>
      )}
      {/* 高亮 */}
      {msg.highlight && msg.highlight.length > 0 && (
        <div style={{ fontSize: 13, margin: '4px 0', padding: '4px 8px', background: '#fffbe6', borderRadius: 4, borderLeft: '3px solid var(--warning-color)' }}
          dangerouslySetInnerHTML={{ __html: `<style>.search-hl em{color:#d46b08;font-style:normal;font-weight:600;background:#fff3cd;padding:0 2px;border-radius:2px}</style><span class="search-hl">${msg.highlight.join(' … ')}</span>` }}
        />
      )}
      {/* 元信息 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
        <span>ID: {msg.msgServerId}</span>
        <span>会话: {msg.conversationId}</span>
        <span>类型: {msg.conversationType}</span>
        {msg.ext && Object.keys(msg.ext).length > 0 && <span>ext: {Object.keys(msg.ext).join(', ')}</span>}
      </div>
      {/* 详细 JSON */}
      <details style={{ marginTop: 6 }}>
        <summary style={{ fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>展开完整 JSON</summary>
        <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', marginTop: 4, padding: 8, background: 'var(--bg-color)', borderRadius: 4 }}>
          {safeJsonStringify(msg)}
        </pre>
      </details>
    </div>
  );

  return (
    <div className="card">
      <div className="card-title">🔍 消息搜索</div>

      <div className="form-group">
        <label>关键词（多个用英文逗号分隔）</label>
        <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="hello, world" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label>匹配模式</label>
          <select value={matchType} onChange={e => setMatchType(e.target.value as 'or' | 'and')}>
            <option value="or">OR（任意匹配）</option>
            <option value="and">AND（全部匹配）</option>
          </select>
        </div>
        <div className="form-group">
          <label>会话 ID（可选）</label>
          <input value={conversationId} onChange={e => setConversationId(e.target.value)} placeholder="用户ID / 群组ID" />
        </div>
      </div>

      <div className="form-group">
        <label>消息类型（可选，不选则搜索全部）</label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {MSG_TYPES.map(t => (
            <label key={t} className="checkbox-label">
              <input type="checkbox" checked={selectedTypes.includes(t)} onChange={() => toggleType(t)} />
              {MSG_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label>搜索范围</label>
          <select value={searchScope} onChange={e => setSearchScope(e.target.value as 'none' | 'with' | 'only')}>
            <option value="none">仅消息体</option>
            <option value="with">消息体 + 扩展字段</option>
            <option value="only">仅扩展字段</option>
          </select>
        </div>
        <div className="form-group">
          <label>排序方向</label>
          <select value={direction} onChange={e => setDirection(e.target.value as 'up' | 'down')}>
            <option value="down">最新优先</option>
            <option value="up">最早优先</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label>开始时间（时间戳 ms，可选）</label>
          <input value={startTime} onChange={e => setStartTime(e.target.value)} placeholder="如 1700000000000" />
        </div>
        <div className="form-group">
          <label>结束时间（时间戳 ms，可选）</label>
          <input value={endTime} onChange={e => setEndTime(e.target.value)} placeholder="如 1700099999999" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label>页码</label>
          <input value={pageNum} onChange={e => setPageNum(e.target.value)} />
        </div>
        <div className="form-group">
          <label>每页数量（1-100）</label>
          <input value={pageSize} onChange={e => setPageSize(e.target.value)} />
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSearch} disabled={loading || !cm}>
        {loading ? '⏳ 搜索中...' : '🔍 搜索'}
      </button>

      {result && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: '#f0f5ff', borderRadius: 4 }}>
            <span style={{ fontWeight: 500 }}>
              搜索结果：{result.messages.length} 条
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              第 {result.pageNum} / {result.totalPages} 页 {result.isLast ? '（最后一页）' : ''}
            </span>
          </div>
          {result.messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>暂无搜索结果</div>
          )}
          {result.messages.map(renderMessage)}
        </div>
      )}
    </div>
  );
};
