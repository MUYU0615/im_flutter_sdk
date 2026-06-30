# Quickstart: ChatClient Tree-Shaking 优化

## 推荐导入方式

Size-sensitive 和小程序场景优先使用子路径导入 Manager：

```ts
import { ChatClient } from 'im-sdk-web';
import { ChatManager } from 'im-sdk-web/managers/chat';
import { GroupManager } from 'im-sdk-web/managers/group';

const client = ChatClient.init({ appKey: 'org#app' })
  .use(ChatManager)
  .use(GroupManager);
```

不要用 IIFE 全量包评估 tree-shaking。IIFE 是全能力分发，适合 script 直引，不适合小程序包体积优化。

## 自动同步依赖示例

联系人自动同步需要显式用户资料能力：

```ts
import { ChatClient } from 'im-sdk-web';
import { ContactManager } from 'im-sdk-web/managers/contact';
import { UserInfoManager } from 'im-sdk-web/managers/user-info';

const client = ChatClient.init({
  appKey: 'org#app',
  enableAutoSyncContacts: true,
})
  .use(ContactManager)
  .use(UserInfoManager);
```

如果开启 `enableAutoSyncContacts` 但没有注册所需用户资料能力，SDK 应在初始化或登录前抛出配置错误，提示需要注册 UserInfo 相关 Manager/capability。

## 规划期验证命令

当前为规划文档阶段，不要求源码测试通过。实现阶段建议新增并运行：

```bash
npm run test:run
npm run lint
npm run type-check
```

如涉及 API 注释或文档入口：

```bash
npm run docs:api:check
```

## Bundle Gate 建议

实现阶段新增脚本后至少覆盖：

```bash
node scripts/check-tree-shaking.mjs --scenario core-only
node scripts/check-tree-shaking.mjs --scenario core-chat
node scripts/check-tree-shaking.mjs --scenario core-group
```

每个场景应输出：

- 构建工具和模式。
- 进入 bundle 的 runtime 模块列表或 metafile。
- 禁止出现的 Manager runtime 模块检查结果。
- minified/gzip 体积记录。

## 回归验证重点

- `ChatClient only` 不包含未注册 Manager runtime。
- 注册 `GroupManager` 后群组事件仍按现有公开事件派发。
- 未注册 `GroupManager` 时群组通知被忽略，不影响核心消息收发。
- 开启联系人自动同步但缺少用户资料能力时 fail fast。
- 小程序等价入口使用子路径导入后只包含显式使用的 Manager。
