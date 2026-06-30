# Quickstart: Manager 独立导出与 Tree Shaking 优化

## 目标

验证子路径导出与多产物输出是否可用，并确保 tree shaking 生效。

## 步骤

1. 使用子路径导入单个 Manager：

```ts
import { ChannelManager } from 'im-sdk-web/managers/channel';
```

2. 使用主入口导入（兼容旧用法）：

```ts
import { ChatClient, ChannelManager } from 'im-sdk-web';
```

3. 在示例工程中使用 Vite/Rollup 构建并观察产物：
   - 确认产物未包含未使用的其他 Manager 代码。

4. 在 CJS 环境中导入：

```js
const { ChatClient } = require('im-sdk-web');
```

## 验收点

- 子路径导入可正常使用，且 TS 类型提示正常。
- 主入口依旧可用，未出现破坏性变更。
- 单文件 bundle 可在浏览器脚本环境加载。
- CJS `require` 可正常加载。
