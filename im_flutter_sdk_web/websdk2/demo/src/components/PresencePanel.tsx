import { useState } from 'react'; // 引入 React hooks
import {
  formatError,
  formatTimestamp,
  parseUsernamesInput,
  safeJsonStringify,
  withTimeout,
} from '../utils'; // 引入工具方法
import type { ChangeEvent } from 'react'; // 引入事件类型
import type {
  PresenceStatusDetails,
  SubscribePresenceResponse,
  SubscribedPresenceListResponse,
} from 'im-sdk-web'; // 引入 SDK 类型
import type { DemoClient, LogType, PresenceStateRecord } from '../types'; // 引入 demo 类型

export interface PresencePanelProps {
  // 在线状态面板属性
  readonly client: DemoClient | null; // SDK 实例
  readonly onAddLog: (type: LogType, message: string) => void; // 日志回调
  readonly onUpdatePresence: (states: ReadonlyArray<PresenceStateRecord>) => void; // 更新状态回调
  readonly onClearPresence: () => void; // 清空回调
  readonly presenceStates: ReadonlyArray<PresenceStateRecord>; // 状态列表
  readonly defaultUsernames?: string; // 默认订阅用户
  readonly defaultExpiry?: string; // 默认订阅时长
} // 接口结束

const DEFAULT_EXPIRY = '3600'; // 默认订阅时长
const DEFAULT_PAGE_NUM = '1'; // 默认页码
const DEFAULT_PAGE_SIZE = '20'; // 默认页大小
const API_TIMEOUT = 15000; // API 超时

const normalizeStatusDetails = (
  status: Record<string, unknown> | unknown
): ReadonlyArray<PresenceStatusDetails> => {
  // 归一化状态详情
  if (!status || typeof status !== 'object') {
    // 校验状态对象
    return []; // 返回空数组
  } // 判断结束
  const entries = Object.entries(status as Record<string, unknown>); // 读取状态条目
  return entries.map(([device, value]) => ({
    // 转换条目
    device, // 设备标识
    status: Number(value) || 0, // 状态值
  })); // 返回结果
}; // 函数结束

const buildPresenceStates = (
  response: SubscribePresenceResponse
): ReadonlyArray<PresenceStateRecord> => {
  // 订阅结果转换
  return response.map(item => ({
    // 转换列表
    userId: item.publisher, // 用户 ID
    statusDetails: normalizeStatusDetails(item.statusList), // 状态详情
    ext: item.ext ?? '', // 扩展信息
    lastTime: Number(item.latestTime) || 0, // 更新时间
    expire: Number(item.expiryTime) || 0, // 到期时间
  })); // 返回结果
}; // 函数结束

const renderStatusDetails = (details: ReadonlyArray<PresenceStatusDetails>): string => {
  // 渲染状态详情
  if (details.length === 0) {
    // 无详情
    return '无'; // 返回空文案
  } // 判断结束
  return details.map(item => `${item.device}:${item.status}`).join(', '); // 拼接状态
}; // 函数结束

export const PresencePanel = (props: PresencePanelProps): JSX.Element => {
  // 在线状态面板组件
  const {
    client,
    onAddLog,
    onUpdatePresence,
    onClearPresence,
    presenceStates,
    defaultUsernames,
    defaultExpiry,
  } = props; // 读取属性
  const [publishDescription, setPublishDescription] = useState(''); // 发布描述输入
  const [subscribeUsernames, setSubscribeUsernames] = useState(defaultUsernames ?? ''); // 订阅用户输入
  const [expiryInput, setExpiryInput] = useState(defaultExpiry ?? DEFAULT_EXPIRY); // 订阅时长输入
  const [unsubscribeUsernames, setUnsubscribeUsernames] = useState(''); // 取消订阅用户输入
  const [queryUsernames, setQueryUsernames] = useState(''); // 查询状态用户输入
  const [pageNumInput, setPageNumInput] = useState(DEFAULT_PAGE_NUM); // 订阅列表页码输入
  const [pageSizeInput, setPageSizeInput] = useState(DEFAULT_PAGE_SIZE); // 订阅列表页大小输入
  const [publishInfo, setPublishInfo] = useState<string | null>(null); // 发布结果提示
  const [unsubscribeInfo, setUnsubscribeInfo] = useState<string | null>(null); // 取消订阅提示
  const [subscribeResponseText, setSubscribeResponseText] = useState<string | null>(null); // 订阅返回 JSON
  const [queryResponseText, setQueryResponseText] = useState<string | null>(null); // 查询返回 JSON
  const [sublistResponseText, setSublistResponseText] = useState<string | null>(null); // 订阅列表返回 JSON
  const [sublistResponse, setSublistResponse] = useState<SubscribedPresenceListResponse | null>(
    null
  ); // 订阅列表结果
  const [publishing, setPublishing] = useState(false); // 发布中状态
  const [subscribing, setSubscribing] = useState(false); // 订阅中状态
  const [unsubscribing, setUnsubscribing] = useState(false); // 取消订阅中状态
  const [querying, setQuerying] = useState(false); // 查询在线状态中状态
  const [queryingSublist, setQueryingSublist] = useState(false); // 查询订阅列表中状态

  const ensureClientReady = (): DemoClient | null => {
    // 校验 SDK 状态
    if (!client) {
      // 未初始化
      onAddLog('warn', '请先初始化 SDK'); // 记录日志
      return null; // 返回空
    } // 判断结束
    const connectionState = client.getConnectionState(); // 读取连接状态
    if (connectionState !== 'connected') {
      // 未登录
      onAddLog('warn', `请先登录（当前状态: ${connectionState}）`); // 记录日志
      return null; // 返回空
    } // 判断结束
    return client; // 返回实例
  }; // 函数结束

  const handlePublishDescriptionChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理发布描述
    setPublishDescription(event.target.value); // 更新描述
  }; // 函数结束

  const handleSubscribeUsernamesChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理订阅用户输入
    setSubscribeUsernames(event.target.value); // 更新订阅用户输入
  }; // 函数结束

  const handleExpiryChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理订阅时长输入
    setExpiryInput(event.target.value); // 更新时长输入
  }; // 函数结束

  const handleUnsubscribeUsernamesChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理取消订阅用户输入
    setUnsubscribeUsernames(event.target.value); // 更新取消订阅用户
  }; // 函数结束

  const handleQueryUsernamesChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理查询用户输入
    setQueryUsernames(event.target.value); // 更新查询用户
  }; // 函数结束

  const handlePageNumChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理页码输入
    setPageNumInput(event.target.value); // 更新页码
  }; // 函数结束

  const handlePageSizeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理页大小输入
    setPageSizeInput(event.target.value); // 更新页大小
  }; // 函数结束

  const parseNonNegativeNumber = (input: string, label: string): number | null => {
    // 解析非负数
    const value = Number(input); // 转换数值
    if (!Number.isFinite(value) || value < 0) {
      // 校验数值
      onAddLog('warn', `${label}需要为非负数字`); // 记录日志
      return null; // 返回空
    } // 判断结束
    return value; // 返回数值
  }; // 函数结束

  const logApiResponse = (label: string, response: unknown): void => {
    // 打印 API 返回值
    // eslint-disable-next-line no-console -- demo 需要在浏览器控制台直接查看在线状态接口返回
    console.log(`[PresenceManager] ${label} 返回`, response); // 输出控制台日志
    const message = `${label}返回: ${safeJsonStringify(response)}`; // 组装日志
    onAddLog('info', message); // 输出日志
  }; // 函数结束

  const handlePublish = async (): Promise<void> => {
    // 处理发布在线状态
    const readyClient = ensureClientReady(); // 校验客户端
    if (!readyClient) {
      // 校验失败
      return; // 结束
    } // 判断结束
    const description = publishDescription.trim(); // 读取描述
    if (!description) {
      // 校验描述
      onAddLog('warn', '请输入在线状态描述'); // 记录日志
      return; // 结束
    } // 判断结束
    setPublishing(true); // 设置发布中
    try {
      // 捕获异常
      const response = await withTimeout(
        // 调用发布
        readyClient.presenceManager.publishPresence({ customStatus: description }), // 发布请求
        API_TIMEOUT, // 超时时间
        '发布在线状态' // 超时标签
      ); // 调用结束
      logApiResponse('发布在线状态', response); // 打印返回值
      const info = `发布成功（${formatTimestamp(Date.now())}）`; // 构造提示
      setPublishInfo(info); // 更新提示
      onAddLog('success', `发布成功: ${description}`); // 记录日志
    } catch (error) {
      // 捕获错误
      onAddLog('error', `发布失败: ${formatError(error)}`); // 记录日志
    } finally {
      // 最终处理
      setPublishing(false); // 清理状态
    } // try-catch 结束
  }; // 函数结束

  const handleSubscribe = async (): Promise<void> => {
    // 处理订阅在线状态
    const readyClient = ensureClientReady(); // 校验客户端
    if (!readyClient) {
      // 校验失败
      return; // 结束
    } // 判断结束
    const usernames = parseUsernamesInput(subscribeUsernames); // 解析用户列表
    if (usernames.length === 0) {
      // 校验列表
      onAddLog('warn', '请输入订阅用户（逗号分隔）'); // 记录日志
      return; // 结束
    } // 判断结束
    const expiry = parseNonNegativeNumber(expiryInput, '订阅时长'); // 解析时长
    if (expiry === null) {
      // 校验失败
      return; // 结束
    } // 判断结束
    setSubscribing(true); // 设置订阅中
    try {
      // 捕获异常
      const response = await withTimeout(
        // 发起订阅
        readyClient.presenceManager.subscribePresence({ userIds: usernames, expiry }), // 订阅请求
        API_TIMEOUT, // 超时时间
        '订阅在线状态' // 超时标签
      ); // 订阅请求结束
      setSubscribeResponseText(safeJsonStringify(response)); // 更新返回文本
      logApiResponse('订阅在线状态', response); // 打印返回值
      const states = buildPresenceStates(response); // 构造状态列表
      if (states.length > 0) {
        // 校验返回
        onUpdatePresence(states); // 更新状态
      } // 判断结束
      onAddLog('success', `订阅成功，返回 ${response.length} 条状态`); // 记录日志
    } catch (error) {
      // 捕获错误
      onAddLog('error', `订阅失败: ${formatError(error)}`); // 记录日志
    } finally {
      // 最终处理
      setSubscribing(false); // 清理状态
    } // try-catch 结束
  }; // 函数结束

  const handleUnsubscribe = async (): Promise<void> => {
    // 处理取消订阅
    const readyClient = ensureClientReady(); // 校验客户端
    if (!readyClient) {
      // 校验失败
      return; // 结束
    } // 判断结束
    const usernames = parseUsernamesInput(unsubscribeUsernames); // 解析用户列表
    if (usernames.length === 0) {
      // 校验列表
      onAddLog('warn', '请输入取消订阅用户（逗号分隔）'); // 记录日志
      return; // 结束
    } // 判断结束
    setUnsubscribing(true); // 设置取消订阅中
    try {
      // 捕获异常
      const response = await withTimeout(
        // 调用取消订阅
        readyClient.presenceManager.unsubscribePresence({ userIds: usernames }), // 取消订阅请求
        API_TIMEOUT, // 超时时间
        '取消订阅在线状态' // 超时标签
      ); // 调用结束
      logApiResponse('取消订阅在线状态', response); // 打印返回值
      const info = `取消订阅成功（${formatTimestamp(Date.now())}）`; // 构造提示
      setUnsubscribeInfo(info); // 更新提示
      onAddLog('success', `取消订阅成功: ${usernames.join(', ')}`); // 记录日志
    } catch (error) {
      // 捕获错误
      onAddLog('error', `取消订阅失败: ${formatError(error)}`); // 记录日志
    } finally {
      // 最终处理
      setUnsubscribing(false); // 清理状态
    } // try-catch 结束
  }; // 函数结束

  const handleQueryPresence = async (): Promise<void> => {
    // 处理查询在线状态
    const readyClient = ensureClientReady(); // 校验客户端
    if (!readyClient) {
      // 校验失败
      return; // 结束
    } // 判断结束
    const usernames = parseUsernamesInput(queryUsernames); // 解析用户列表
    if (usernames.length === 0) {
      // 校验列表
      onAddLog('warn', '请输入查询用户（逗号分隔）'); // 记录日志
      return; // 结束
    } // 判断结束
    setQuerying(true); // 设置查询中
    try {
      // 捕获异常
      const response = await withTimeout(
        // 调用查询
        readyClient.presenceManager.getPresenceStatus({ userIds: usernames }), // 查询请求
        API_TIMEOUT, // 超时时间
        '查询在线状态' // 超时标签
      ); // 调用结束
      setQueryResponseText(safeJsonStringify(response)); // 更新返回文本
      logApiResponse('查询在线状态', response); // 打印返回值
      const states = buildPresenceStates(response); // 构造状态列表
      if (states.length > 0) {
        // 校验返回
        onUpdatePresence(states); // 更新状态
      } // 判断结束
      onAddLog('success', `查询成功，返回 ${response.length} 条状态`); // 记录日志
    } catch (error) {
      // 捕获错误
      onAddLog('error', `查询失败: ${formatError(error)}`); // 记录日志
    } finally {
      // 最终处理
      setQuerying(false); // 清理状态
    } // try-catch 结束
  }; // 函数结束

  const handleQuerySublist = async (): Promise<void> => {
    // 处理查询订阅列表
    const readyClient = ensureClientReady(); // 校验客户端
    if (!readyClient) {
      // 校验失败
      return; // 结束
    } // 判断结束
    const pageNum = parseNonNegativeNumber(pageNumInput, '页码'); // 解析页码
    if (pageNum === null) {
      // 校验失败
      return; // 结束
    } // 判断结束
    const pageSize = parseNonNegativeNumber(pageSizeInput, '页大小'); // 解析页大小
    if (pageSize === null) {
      // 校验失败
      return; // 结束
    } // 判断结束
    setQueryingSublist(true); // 设置查询中
    try {
      // 捕获异常
      const response = await withTimeout(
        // 调用查询
        readyClient.presenceManager.getSubscribedPresenceList({ pageNum, pageSize }), // 查询请求
        API_TIMEOUT, // 超时时间
        '查询订阅列表' // 超时标签
      ); // 调用结束
      setSublistResponse(response); // 更新订阅列表结果
      setSublistResponseText(safeJsonStringify(response)); // 更新返回文本
      logApiResponse('查询订阅列表', response); // 打印返回值
      onAddLog('success', `订阅列表返回 ${response.length} 条`); // 记录日志
    } catch (error) {
      // 捕获错误
      onAddLog('error', `查询订阅列表失败: ${formatError(error)}`); // 记录日志
    } finally {
      // 最终处理
      setQueryingSublist(false); // 清理状态
    } // try-catch 结束
  }; // 函数结束

  const renderPresenceList = (): JSX.Element => {
    // 渲染状态列表
    if (presenceStates.length === 0) {
      // 空状态
      return <div className="presence-empty">暂无在线状态</div>; // 返回空提示
    } // 判断结束
    return (
      // 返回状态列表
      <>
        {' '}
        {/* 状态片段 */}
        {presenceStates.map(
          (
            state // 遍历状态
          ) => (
            <div className="presence-item" key={state.userId}>
              {' '}
              {/* 状态项 */}
              <div className="presence-header">
                {' '}
                {/* 头部 */}
                <span className="presence-user">用户: {state.userId}</span> {/* 用户 ID */}
                <span className="presence-time">
                  更新时间: {formatTimestamp(state.lastTime)}
                </span>{' '}
                {/* 更新时间 */}
                {/* 头部结束 */}
              </div>
              <div className="presence-meta">描述: {state.ext || '-'}</div> {/* 描述 */}
              <div className="presence-meta">到期时间: {formatTimestamp(state.expire)}</div>{' '}
              {/* 到期时间 */}
              <div className="presence-meta">
                设备状态: {renderStatusDetails(state.statusDetails)}
              </div>{' '}
              {/* 状态详情 */}
              {/* 状态项结束 */}
            </div>
          )
        )}{' '}
        {/* 遍历结束 */}
        {/* 状态片段结束 */}
      </>
    ); // 返回结束
  }; // 函数结束

  const renderSublist = (): JSX.Element => {
    // 渲染订阅列表
    if (!sublistResponse) {
      // 未查询
      return <div className="presence-empty">暂无订阅列表数据</div>; // 返回空提示
    } // 判断结束
    const sublist = sublistResponse; // 读取订阅列表
    if (sublist.length === 0) {
      // 空列表
      return <div className="presence-empty">订阅列表为空</div>; // 返回空提示
    } // 判断结束
    return (
      // 返回订阅列表
      <>
        {' '}
        {/* 列表片段 */}
        {sublist.map(
          (
            item // 遍历列表
          ) => (
            <div className="presence-sublist-item" key={item}>
              {' '}
              {/* 列表项 */}
              <span className="presence-user">用户: {item}</span> {/* 用户 ID */}
              {/* 列表项结束 */}
            </div>
          )
        )}{' '}
        {/* 遍历结束 */}
        {/* 列表片段结束 */}
      </>
    ); // 返回结束
  }; // 函数结束

  return (
    // 返回 UI
    <div className="card">
      {' '}
      {/* 在线状态卡片 */}
      <div className="card-title">
        {' '}
        {/* 标题 */}
        在线状态管理 {/* 标题文本 */}
        <button className="btn btn-warning" onClick={onClearPresence}>
          清空状态{/* 清空按钮 */}
        </button>
        {/* 标题结束 */}
      </div>
      <div className="presence-section">
        {' '}
        {/* 发布区域 */}
        <div className="presence-section-title">发布在线状态</div> {/* 发布标题 */}
        <div className="form-group">
          {' '}
          {/* 表单组 */}
          <label>状态描述{/* 标签 */}</label>
          <input
            type="text"
            value={publishDescription}
            onChange={handlePublishDescriptionChange}
            placeholder="请输入状态描述"
          />{' '}
          {/* 描述输入 */}
          {/* 表单组结束 */}
        </div>
        <button className="btn btn-primary" onClick={handlePublish} disabled={publishing}>
          {' '}
          {/* 发布按钮 */}
          {publishing ? '发布中...' : '发布在线状态'} {/* 按钮文本 */}
          {/* 按钮结束 */}
        </button>
        <div className="presence-result">最近发布: {publishInfo ?? '暂无'}</div> {/* 发布结果 */}
        {/* 发布区域结束 */}
      </div>
      <div className="presence-section">
        {' '}
        {/* 订阅区域 */}
        <div className="presence-section-title">订阅在线状态</div> {/* 订阅标题 */}
        <div className="form-group">
          {' '}
          {/* 表单组 */}
          <label>订阅用户（逗号分隔）{/* 标签 */}</label>
          <input
            type="text"
            value={subscribeUsernames}
            onChange={handleSubscribeUsernamesChange}
            placeholder="userA,userB"
          />{' '}
          {/* 用户输入 */}
          {/* 表单组结束 */}
        </div>
        <div className="form-group">
          {' '}
          {/* 表单组 */}
          <label>订阅时长（秒）{/* 标签 */}</label>
          <input
            type="number"
            value={expiryInput}
            onChange={handleExpiryChange}
            placeholder="3600"
            min={0}
          />{' '}
          {/* 时长输入 */}
          {/* 表单组结束 */}
        </div>
        <button className="btn btn-primary" onClick={handleSubscribe} disabled={subscribing}>
          {' '}
          {/* 订阅按钮 */}
          {subscribing ? '订阅中...' : '订阅在线状态'} {/* 按钮文本 */}
          {/* 按钮结束 */}
        </button>
        <div className="presence-result">
          {' '}
          {/* 订阅返回 */}
          <div className="presence-result-label">订阅返回</div> {/* 标签 */}
          <pre>{subscribeResponseText ?? '暂无'}</pre> {/* 返回内容 */}
          {/* 订阅返回结束 */}
        </div>
        {/* 订阅区域结束 */}
      </div>
      <div className="presence-section">
        {' '}
        {/* 取消订阅区域 */}
        <div className="presence-section-title">取消订阅</div> {/* 取消订阅标题 */}
        <div className="form-group">
          {' '}
          {/* 表单组 */}
          <label>取消订阅用户（逗号分隔）{/* 标签 */}</label>
          <input
            type="text"
            value={unsubscribeUsernames}
            onChange={handleUnsubscribeUsernamesChange}
            placeholder="userA,userB"
          />{' '}
          {/* 用户输入 */}
          {/* 表单组结束 */}
        </div>
        <button className="btn btn-warning" onClick={handleUnsubscribe} disabled={unsubscribing}>
          {' '}
          {/* 取消订阅按钮 */}
          {unsubscribing ? '取消中...' : '取消订阅'} {/* 按钮文本 */}
          {/* 按钮结束 */}
        </button>
        <div className="presence-result">最近取消订阅: {unsubscribeInfo ?? '暂无'}</div>{' '}
        {/* 取消订阅提示 */}
        {/* 取消订阅区域结束 */}
      </div>
      <div className="presence-section">
        {' '}
        {/* 查询状态区域 */}
        <div className="presence-section-title">查询在线状态</div> {/* 查询标题 */}
        <div className="form-group">
          {' '}
          {/* 表单组 */}
          <label>查询用户（逗号分隔）{/* 标签 */}</label>
          <input
            type="text"
            value={queryUsernames}
            onChange={handleQueryUsernamesChange}
            placeholder="userA,userB"
          />{' '}
          {/* 用户输入 */}
          {/* 表单组结束 */}
        </div>
        <button className="btn btn-primary" onClick={handleQueryPresence} disabled={querying}>
          {' '}
          {/* 查询按钮 */}
          {querying ? '查询中...' : '查询在线状态'} {/* 按钮文本 */}
          {/* 按钮结束 */}
        </button>
        <div className="presence-result">
          {' '}
          {/* 查询返回 */}
          <div className="presence-result-label">查询返回</div> {/* 标签 */}
          <pre>{queryResponseText ?? '暂无'}</pre> {/* 返回内容 */}
          {/* 查询返回结束 */}
        </div>
        {/* 查询状态区域结束 */}
      </div>
      <div className="presence-section">
        {' '}
        {/* 查询订阅列表区域 */}
        <div className="presence-section-title">查询订阅列表</div> {/* 列表标题 */}
        <div className="form-row">
          {' '}
          {/* 表单行 */}
          <div className="form-group">
            {' '}
            {/* 表单组 */}
            <label>页码{/* 标签 */}</label>
            <input type="number" value={pageNumInput} onChange={handlePageNumChange} min={0} />{' '}
            {/* 页码输入 */}
            {/* 表单组结束 */}
          </div>
          <div className="form-group">
            {' '}
            {/* 表单组 */}
            <label>页大小{/* 标签 */}</label>
            <input
              type="number"
              value={pageSizeInput}
              onChange={handlePageSizeChange}
              min={0}
            />{' '}
            {/* 页大小输入 */}
            {/* 表单组结束 */}
          </div>
          {/* 表单行结束 */}
        </div>
        <button className="btn btn-primary" onClick={handleQuerySublist} disabled={queryingSublist}>
          {' '}
          {/* 查询按钮 */}
          {queryingSublist ? '查询中...' : '查询订阅列表'} {/* 按钮文本 */}
          {/* 按钮结束 */}
        </button>
        <div className="presence-result">
          {' '}
          {/* 列表返回 */}
          <div className="presence-result-label">订阅列表返回</div> {/* 标签 */}
          <pre>{sublistResponseText ?? '暂无'}</pre> {/* 返回内容 */}
          {/* 列表返回结束 */}
        </div>
        <div className="presence-sublist">
          {' '}
          {/* 订阅列表展示 */}
          <div className="presence-result-label">订阅列表展示</div> {/* 标签 */}
          {sublistResponse ? ( // 判断结果
            <div className="presence-sublist-total">总数: {sublistResponse.length}</div> // 展示总数
          ) : null}{' '}
          {/* 判断结束 */}
          {renderSublist()} {/* 渲染列表 */}
          {/* 订阅列表展示结束 */}
        </div>
        {/* 查询订阅列表区域结束 */}
      </div>
      <div className="presence-section">
        {' '}
        {/* 变更通知区域 */}
        <div className="presence-section-title">状态变更监听</div> {/* 变更标题 */}
        <div className="presence-list">
          {' '}
          {/* 状态列表容器 */}
          {renderPresenceList()} {/* 渲染状态 */}
          {/* 状态列表容器结束 */}
        </div>
        {/* 变更通知区域结束 */}
      </div>
      {/* 在线状态卡片结束 */}
    </div>
  ); // 返回结束
}; // 组件结束
