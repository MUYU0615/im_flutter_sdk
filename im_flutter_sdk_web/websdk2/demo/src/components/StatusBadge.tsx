import type { ConnectionState } from 'im-sdk-web'; // 引入连接状态类型

export interface StatusBadgeProps { // 状态徽章属性
  readonly status: ConnectionState; // 连接状态
} // 接口结束

export const StatusBadge = ({ status }: StatusBadgeProps): JSX.Element => { // 状态徽章组件
  if (status === 'connected') { // 已连接
    return <span className="status-badge status-connected">已连接</span>; // 返回已连接徽章
  } // 判断结束
  if (status === 'connecting') { // 连接中
    return <span className="status-badge status-connecting">连接中...</span>; // 返回连接中徽章
  } // 判断结束
  return <span className="status-badge status-disconnected">未连接</span>; // 返回未连接徽章
}; // 组件结束
