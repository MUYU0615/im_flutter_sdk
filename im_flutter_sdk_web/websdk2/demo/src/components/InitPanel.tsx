import { useState } from 'react'; // 引入 React hooks
import { StatusBadge } from './StatusBadge'; // 引入状态徽章
import type { ChangeEvent } from 'react'; // 引入事件类型
import type { ConnectionState, SyncDataType } from 'im-sdk-web'; // 引入连接状态类型
import {
  findFixedServerPresetById,
  matchFixedServerPreset,
} from '../fixed-server-presets';
import type { DemoFixedServerPreset, DemoInitConfigInput } from '../types'; // 引入初始化配置类型

export interface InitPanelProps {
  // 初始化面板属性
  readonly status: ConnectionState; // 连接状态
  readonly isInitialized: boolean; // 是否初始化
  readonly onInit: (config: DemoInitConfigInput) => void; // 初始化回调
  readonly defaultAppKey?: string; // 默认 AppKey
  readonly defaultDnsUrls?: string; // 默认 DNS 地址
  readonly defaultUseDnsConfig?: boolean; // 默认是否使用 DNS_CONFIG 发现
  readonly defaultRestApiUrl?: string; // 默认 REST 地址
  readonly defaultWsUrl?: string; // 默认 WebSocket 地址
  readonly defaultSyncWsUrl?: string; // 默认 SessionList WebSocket 地址
  readonly fixedServerPresets?: ReadonlyArray<DemoFixedServerPreset>;
  readonly defaultFixedServerPresetId?: string;
  readonly defaultEnableUserInfoSync?: boolean; // 默认是否开启消息资料同步
  readonly defaultEnableSyncData?: ReadonlyArray<SyncDataType>; // 默认自动同步数据类型
  readonly defaultCacheEncryptionMode?: 'auto' | 'off';
} // 接口结束

export const InitPanel = (props: InitPanelProps): JSX.Element => {
  // 初始化面板组件
  const {
    status,
    isInitialized,
    onInit,
    defaultAppKey,
    defaultDnsUrls,
    defaultUseDnsConfig,
    defaultRestApiUrl,
    defaultWsUrl,
    defaultSyncWsUrl,
    fixedServerPresets,
    defaultFixedServerPresetId,
    defaultEnableUserInfoSync,
    defaultEnableSyncData,
    defaultCacheEncryptionMode,
  } = props; // 读取属性
  const matchedPreset =
    matchFixedServerPreset({
      appKey: defaultAppKey,
      restApiUrl: defaultRestApiUrl,
      wsUrl: defaultWsUrl,
      syncWsUrl: defaultSyncWsUrl,
    }) ?? findFixedServerPresetById(defaultFixedServerPresetId ?? '');
  const [appKey, setAppKey] = useState(defaultAppKey ?? ''); // AppKey 输入
  const [dnsUrls, setDnsUrls] = useState(defaultDnsUrls ?? ''); // DNS 输入
  const [useDnsConfig, setUseDnsConfig] = useState<boolean>(defaultUseDnsConfig ?? false); // DNS_CONFIG 发现开关
  const [restApiUrl, setRestApiUrl] = useState(defaultRestApiUrl ?? ''); // REST 地址
  const [wsUrl, setWsUrl] = useState(defaultWsUrl ?? ''); // WebSocket 地址
  const [syncWsUrl, setSyncWsUrl] = useState(defaultSyncWsUrl ?? ''); // SessionList WebSocket 地址
  const [fixedServerPresetId, setFixedServerPresetId] = useState<string>(
    matchedPreset?.id ?? defaultFixedServerPresetId ?? 'custom'
  );
  const [enableUserInfoSync, setEnableUserInfoSync] = useState<boolean>(defaultEnableUserInfoSync ?? false);
  const [enableSyncData, setEnableSyncData] = useState<ReadonlyArray<SyncDataType>>(
    defaultEnableSyncData ?? []
  ); // 自动同步数据类型
  const [cacheEncryptionMode, setCacheEncryptionMode] = useState<'auto' | 'off'>(
    defaultCacheEncryptionMode ?? 'auto'
  );

  const handleAppKeyChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理 AppKey
    setAppKey(event.target.value); // 更新 AppKey
  }; // 函数结束

  const handleDnsUrlsChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理 DNS
    setDnsUrls(event.target.value); // 更新 DNS
  }; // 函数结束

  const handleRestApiUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理 REST 地址
    setRestApiUrl(event.target.value);
  }; // 函数结束

  const handleWsUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理 WebSocket 地址
    setWsUrl(event.target.value);
  }; // 函数结束

  const handleSyncWsUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setSyncWsUrl(event.target.value);
    setFixedServerPresetId('custom');
  };

  const handleEnableSyncDataChange =
    (dataType: SyncDataType) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const next = new Set(enableSyncData);
      if (event.target.checked) {
        next.add(dataType);
      } else {
        next.delete(dataType);
      }
      setEnableSyncData([...next]);
    };

  const handleEnableUserInfoSyncChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setEnableUserInfoSync(event.target.checked);
  };

  const handleUseDnsConfigChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理 DNS_CONFIG 发现开关
    setUseDnsConfig(event.target.checked); // 更新开关状态
  }; // 函数结束

  const handleCacheEncryptionModeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setCacheEncryptionMode(event.target.checked ? 'off' : 'auto');
  };

  const applyFixedServerPreset = (preset: DemoFixedServerPreset): void => {
    setFixedServerPresetId(preset.id);
    setAppKey(preset.appKey);
    setRestApiUrl(preset.restApiUrl);
    setWsUrl(preset.wsUrl);
    setSyncWsUrl(preset.syncWsUrl);
  };

  const handleFixedServerPresetChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const nextPresetId = event.target.value;
    setFixedServerPresetId(nextPresetId);
    if (nextPresetId === 'custom') {
      return;
    }
    const preset = findFixedServerPresetById(nextPresetId);
    if (!preset) {
      return;
    }
    applyFixedServerPreset(preset);
  };

  const handleInitClick = (): void => {
    // 处理初始化点击
    onInit({
      appKey,
      useDnsConfig,
      dnsUrls,
      restApiUrl,
      wsUrl,
      syncWsUrl,
      enableUserInfoSync,
      enableSyncData,
      cacheEncryptionMode,
    }); // 调用初始化
  }; // 函数结束

  return (
    // 返回 UI
    <div className="card">
      {' '}
      {/* 初始化卡片 */}
      <div className="card-title">
        {' '}
        {/* 标题 */}
        SDK 初始化 <StatusBadge status={status} /> {/* 标题内容 */}
        {/* 标题结束 */}
      </div>
      <div className="form-group">
        {' '}
        {/* 表单组 */}
        <label>AppKey{/* 标签 */}</label>
        <input
          data-testid="init-appkey-input"
          type="text"
          value={appKey}
          onChange={handleAppKeyChange}
          placeholder="请输入 AppKey"
        />{' '}
        {/* AppKey 输入框 */}
        {/* 表单组结束 */}
      </div>
      <div className="form-group">
        <label className="checkbox-label">
          <input
            data-testid="init-use-http-dns-checkbox"
            type="checkbox"
            checked={useDnsConfig}
            onChange={handleUseDnsConfigChange}
          />
          <span>使用 DNS 配置发现</span>
        </label>
        <small>
          开启后可手动填写 DNS 地址；留空时会使用 SDK 内置默认 DNS 地址。关闭后需要手动填写 REST 和
          WebSocket 地址。
        </small>
      </div>
      {useDnsConfig ? (
        <div className="form-group">
          {' '}
          {/* 表单组 */}
          <label>DNS 地址（可选，支持完整 URL，逗号分隔）{/* 标签 */}</label>
          <input
            data-testid="init-dns-input"
            type="text"
            value={dnsUrls}
            onChange={handleDnsUrlsChange}
            placeholder="留空则使用 SDK 内置 DNS 地址；也可填写 https://example.com/path/dns.json"
          />{' '}
          {/* DNS 输入框 */}
          <small>多个 DNS 地址使用英文逗号分隔；留空时使用 SDK 内置默认 DNS 地址。</small>
          {/* 表单组结束 */}
        </div>
      ) : (
        <>
          <div className="form-group">
            <label>固定服务环境</label>
            <select
              data-testid="init-fixed-server-preset-select"
              value={fixedServerPresetId}
              onChange={handleFixedServerPresetChange}
            >
              {(fixedServerPresets ?? []).map(preset => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">自定义</option>
            </select>
            <small>选择预置环境后会自动填充 AppKey、REST、WebSocket 与 SessionList WebSocket，仍可继续手动修改。</small>
          </div>
          <div className="form-group">
            <label>REST 地址{/* 标签 */}</label>
            <input
              data-testid="init-rest-url-input"
              type="text"
              value={restApiUrl}
              onChange={(event): void => {
                handleRestApiUrlChange(event);
                setFixedServerPresetId('custom');
              }}
              placeholder="https://a1.easemob.com"
            />
          </div>
          <div className="form-group">
            <label>WebSocket 地址{/* 标签 */}</label>
            <input
              data-testid="init-ws-url-input"
              type="text"
              value={wsUrl}
              onChange={(event): void => {
                handleWsUrlChange(event);
                setFixedServerPresetId('custom');
              }}
              placeholder="wss://example.com/websocket"
            />
          </div>
          <div className="form-group">
            <label>SessionList WebSocket 地址{/* 标签 */}</label>
            <input
              data-testid="init-sync-ws-url-input"
              type="text"
              value={syncWsUrl}
              onChange={handleSyncWsUrlChange}
              placeholder="ws://example.com:8086"
            />
          </div>
        </>
      )}
      <div className="form-group">
        <label className="checkbox-label">
          <input
            data-testid="init-enable-user-info-sync-checkbox"
            type="checkbox"
            checked={enableUserInfoSync}
            onChange={handleEnableUserInfoSyncChange}
          />
          <span>发送消息携带资料版本（enableUserInfoSync）</span>
        </label>
        <small>
          关闭时，消息不会携带 `userInfoUpdateTime /
          namecardUpdateTime`，接收侧也不会进入资料补位链路。
        </small>
        <small>
          这是初始化参数。修改后需要重新点“初始化”；如果当前页面已经初始化过，先刷新页面再切换这个开关更稳妥。
        </small>
      </div>
      <div className="form-group">
        <label className="checkbox-label">
          <input
            data-testid="init-sync-data-conversation-checkbox"
            type="checkbox"
            checked={enableSyncData.includes('conversation')}
            onChange={handleEnableSyncDataChange('conversation')}
          />
          <span>登录后自动同步会话列表（enableSyncData: conversation）</span>
        </label>
        <label className="checkbox-label">
          <input
            data-testid="init-sync-data-contact-checkbox"
            type="checkbox"
            checked={enableSyncData.includes('contact')}
            onChange={handleEnableSyncDataChange('contact')}
          />
          <span>登录后自动同步联系人（enableSyncData: contact）</span>
        </label>
        <label className="checkbox-label">
          <input
            data-testid="init-sync-data-group-checkbox"
            type="checkbox"
            checked={enableSyncData.includes('group')}
            onChange={handleEnableSyncDataChange('group')}
          />
          <span>登录后自动同步群组（enableSyncData: group）</span>
        </label>
      </div>
      <div className="form-group">
        <label className="checkbox-label">
          <input
            data-testid="init-cache-encryption-off-checkbox"
            type="checkbox"
            checked={cacheEncryptionMode === 'off'}
            onChange={handleCacheEncryptionModeChange}
          />
          <span>明文缓存（仅调试）</span>
        </label>
        <small>
          开启后 demo 会把 SDK 本地缓存切到明文写入，方便直接在 localStorage 查看 `sessionListMap`
          等缓存内容。
        </small>
      </div>
      <button
        data-testid="init-submit-button"
        className="btn btn-primary"
        onClick={handleInitClick}
      >
        {' '}
        {/* 初始化按钮 */}
        {isInitialized ? '重新初始化' : '初始化'} {/* 按钮文本 */}
        {/* 按钮结束 */}
      </button>
      {/* 初始化卡片结束 */}
    </div>
  ); // 返回结束
}; // 组件结束
