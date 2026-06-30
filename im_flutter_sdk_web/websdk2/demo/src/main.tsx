import React from 'react'; // 引入 React
import ReactDOM from 'react-dom/client'; // 引入 ReactDOM
import { setLogLevel } from 'im-sdk-web'; // 引入 SDK 日志控制
import { App } from './App'; // 引入应用组件
import './index.css'; // 引入样式

setLogLevel('DEBUG'); // demo 默认打开 SDK DEBUG 日志

const rootElement = document.getElementById('root'); // 获取根节点

if (!rootElement) {
  // 根节点不存在
  throw new Error('未找到 root 挂载节点'); // 抛出错误
} // 判断结束

ReactDOM.createRoot(rootElement).render(
  // 创建根并渲染
  <React.StrictMode>
    <App /> {/* React 严格模式 */}
  </React.StrictMode>
); // 渲染结束
