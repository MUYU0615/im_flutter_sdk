import { useState } from 'react'; // 引入 React hooks
import { StatusBadge } from './StatusBadge'; // 引入状态徽章
import { formatError } from '../utils'; // 引入错误格式化
import type { ChangeEvent } from 'react'; // 引入事件类型
import type { ConnectionState } from 'im-sdk-web'; // 引入连接状态类型
import type { LogType } from '../types'; // 引入日志类型

export interface LoginPanelProps {
  // 登录面板属性
  readonly status: ConnectionState; // 连接状态
  readonly isInitialized: boolean; // 是否初始化
  readonly currentUserId: string | null; // 当前用户
  readonly onLogin: (userId: string, token: string, password: string) => Promise<void>; // 登录回调
  readonly onLogout: () => Promise<void>; // 登出回调
  readonly onAddLog: (type: LogType, message: string) => void; // 日志回调
  readonly defaultUserId?: string; // 默认用户 ID
  readonly defaultToken?: string; // 默认 Token
  readonly defaultPassword?: string; // 默认 Password
} // 接口结束

export const LoginPanel = (props: LoginPanelProps): JSX.Element => {
  // 登录面板组件
  const {
    status,
    isInitialized,
    currentUserId,
    onLogin,
    onLogout,
    onAddLog,
    defaultUserId,
    defaultToken,
    defaultPassword,
  } = props; // 读取属性
  const [userId, setUserId] = useState(defaultUserId ?? ''); // 用户 ID 输入
  const [token, setToken] = useState(defaultToken ?? ''); // Token 输入
  const [password, setPassword] = useState(defaultPassword ?? ''); // Password 输入
  const [loading, setLoading] = useState(false); // 加载状态

  const isConnected = status === 'connected'; // 是否已连接

  const handleUserIdChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理用户 ID
    setUserId(event.target.value); // 更新用户 ID
  }; // 函数结束

  const handleTokenChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理 Token
    setToken(event.target.value); // 更新 Token
  }; // 函数结束

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // 处理 Password
    setPassword(event.target.value); // 更新 Password
  }; // 函数结束

  const handleLogin = async (): Promise<void> => {
    // 登录处理
    if (!isInitialized) {
      // 未初始化
      onAddLog('warn', '请先初始化 SDK'); // 记录日志
      return; // 结束
    } // 判断结束
    if (!userId.trim()) {
      // 用户 ID 为空
      onAddLog('warn', '请输入用户 ID'); // 记录日志
      return; // 结束
    } // 判断结束
    const trimmedToken = token.trim(); // 去除 Token 空格
    const trimmedPassword = password.trim(); // 去除 Password 空格
    if (!trimmedToken && !trimmedPassword) {
      // 缺少认证信息
      onAddLog('warn', '请输入 Token 或 Password'); // 记录日志
      return; // 结束
    } // 判断结束
    setLoading(true); // 设置加载
    try {
      // 尝试登录
      await onLogin(userId.trim(), trimmedToken, trimmedPassword); // 调用登录
    } catch (error) {
      // 捕获异常
      onAddLog('error', `登录失败: ${formatError(error)}`); // 记录日志
    } finally {
      // 最终处理
      setLoading(false); // 清理加载
    } // 最终处理结束
  }; // 函数结束

  const handleLogout = async (): Promise<void> => {
    // 登出处理
    if (!isInitialized) {
      // 未初始化
      onAddLog('warn', '请先初始化 SDK'); // 记录日志
      return; // 结束
    } // 判断结束
    setLoading(true); // 设置加载
    try {
      // 尝试登出
      await onLogout(); // 调用登出
    } catch (error) {
      // 捕获异常
      onAddLog('error', `登出失败: ${formatError(error)}`); // 记录日志
    } finally {
      // 最终处理
      setLoading(false); // 清理加载
    } // 最终处理结束
  }; // 函数结束

  const renderContent = (): JSX.Element => {
    // 渲染内容
    if (!isInitialized) {
      // 未初始化
      return <p style={{ color: '#999' }}>SDK 未初始化</p>; // 返回提示
    } // 判断结束
    if (isConnected) {
      // 已连接
      return (
        // 返回已连接视图
        <div>
          {' '}
          {/* 用户信息 */}
          <p data-testid="login-current-user" style={{ marginBottom: 16 }}>
            当前用户:{' '}
            <strong>
              {currentUserId ?? '-'}
              {/* 当前用户 */}
            </strong>
          </p>
          <button
            data-testid="logout-button"
            className="btn btn-danger"
            onClick={(): void => {
              void handleLogout();
            }}
            disabled={loading}
          >
            {' '}
            {/* 登出按钮 */}
            {loading ? '登出中...' : '登出'} {/* 按钮文本 */}
            {/* 登出按钮结束 */}
          </button>
          {/* 用户信息结束 */}
        </div>
      ); // 返回结束
    } // 判断结束
    return (
      // 返回登录表单
      <>
        {' '}
        {/* 登录表单 */}
        <div className="form-group">
          {' '}
          {/* 表单组 */}
          <label>用户 ID{/* 标签 */}</label>
          <input
            data-testid="login-userid-input"
            type="text"
            value={userId}
            onChange={handleUserIdChange}
            placeholder="请输入用户 ID"
            disabled={loading}
          />{' '}
          {/* 用户 ID 输入 */}
          {/* 表单组结束 */}
        </div>
        <div className="form-group">
          {' '}
          {/* 表单组 */}
          <label>Token{/* 标签 */}</label>
          <input
            data-testid="login-token-input"
            type="text"
            value={token}
            onChange={handleTokenChange}
            placeholder="请输入 Token"
            disabled={loading}
          />{' '}
          {/* Token 输入 */}
          {/* 表单组结束 */}
        </div>
        <div className="form-group">
          {' '}
          {/* 表单组 */}
          <label>Password{/* 标签 */}</label>
          <input
            data-testid="login-password-input"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="未填 Token 时先用密码换取 Token"
            disabled={loading}
          />{' '}
          {/* Password 输入 */}
          {/* 表单组结束 */}
        </div>
        <button
          data-testid="login-submit-button"
          className="btn btn-primary"
          onClick={(): void => {
            void handleLogin();
          }}
          disabled={loading}
        >
          {' '}
          {/* 登录按钮 */}
          {loading ? '登录中...' : '登录'} {/* 按钮文本 */}
          {/* 登录按钮结束 */}
        </button>
        {/* 登录表单结束 */}
      </>
    ); // 返回结束
  }; // 函数结束

  return (
    // 返回 UI
    <div className="card">
      {' '}
      {/* 登录卡片 */}
      <div className="card-title">
        {' '}
        {/* 标题 */}
        登录 <StatusBadge status={status} /> {/* 标题内容 */}
        {/* 标题结束 */}
      </div>
      {renderContent()} {/* 渲染内容 */}
      {/* 登录卡片结束 */}
    </div>
  ); // 返回结束
}; // 组件结束
