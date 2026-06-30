import type { LogItem } from '../types'; // 引入日志类型

export interface LogPanelProps {
  // 日志面板属性
  readonly logs: ReadonlyArray<LogItem>; // 日志列表
  readonly onClear: () => void; // 清空回调
} // 接口结束

export const LogPanel = (props: LogPanelProps): JSX.Element => {
  // 日志面板组件
  const { logs, onClear } = props; // 读取属性

  const renderLogs = (): JSX.Element => {
    // 渲染日志
    if (logs.length === 0) {
      // 无日志
      return (
        <div className="log-item" data-testid="log-item">
          暂无日志
        </div>
      ); // 返回空状态
    } // 判断结束
    return (
      // 返回日志列表
      <>
        {' '}
        {/* 日志片段 */}
        {logs.map(
          (log): JSX.Element => (
            // 遍历日志
            <div className="log-item" data-testid="log-item" key={log.id}>
              {' '}
              {/* 日志项 */}[{log.time}] [{log.type}] {log.message} {/* 日志内容 */}
              {/* 日志项结束 */}
            </div>
          )
        )}{' '}
        {/* 遍历结束 */}
        {/* 日志片段结束 */}
      </>
    ); // 返回结束
  }; // 函数结束

  return (
    // 返回 UI
    <div className="card">
      {' '}
      {/* 日志卡片 */}
      <div className="card-title">
        {' '}
        {/* 标题 */}
        日志 {/* 标题文本 */}
        <button data-testid="log-clear-button" className="btn btn-warning" onClick={onClear}>
          清空日志{/* 清空按钮 */}
        </button>
        {/* 标题结束 */}
      </div>
      <div className="log-area" data-testid="log-list">
        {' '}
        {/* 日志区域 */}
        {renderLogs()} {/* 渲染日志 */}
        {/* 日志区域结束 */}
      </div>
      {/* 日志卡片结束 */}
    </div>
  ); // 返回结束
}; // 组件结束
