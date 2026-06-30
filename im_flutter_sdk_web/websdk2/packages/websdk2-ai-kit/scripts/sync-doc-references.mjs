import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const repoRoot = resolve(packageRoot, '../..');
const integrationSourceDir = resolve(repoRoot, 'docs/integration');
const apiReferenceSourcePath = resolve(repoRoot, 'docs/reference/api-reference.zh-CN.md');
const generatedReferenceDir = resolve(packageRoot, 'src/references/generated');

const integrationTitles = new Map([
  ['README.md', 'SDK 集成文档索引'],
  ['initialization.md', 'SDK 初始化'],
  ['login.md', '用户登录与登出'],
  ['connection.md', '连接状态管理与自动重连'],
  ['message_send.md', '发送消息'],
  ['message_receive.md', '接收消息'],
  ['message_recall.md', '撤回消息'],
  ['message_receipt.md', '消息回执'],
  ['message_retrieve.md', '获取历史消息'],
  ['message_modify.md', '编辑消息'],
  ['message_delete.md', '删除消息'],
  ['message_quote.md', '引用消息'],
  ['message_pin.md', '消息置顶'],
  ['message_translation.md', '消息翻译'],
  ['message_deliver_only_online.md', '仅在线投递'],
  ['message_target.md', '定向消息'],
  ['typing_indication.md', '输入指示器'],
  ['user_relationship.md', '联系人管理'],
  ['userprofile.md', '用户属性'],
  ['presence.md', '在线状态'],
  ['group_manage.md', '群组管理'],
  ['group_members.md', '群组成员管理'],
  ['group_attributes.md', '群组属性'],
  ['room_manage.md', '聊天室管理'],
  ['room_members.md', '聊天室成员管理'],
  ['room_attributes.md', '聊天室属性'],
  ['conversation_list.md', '会话列表'],
  ['conversation_delete.md', '删除会话'],
  ['conversation_pin.md', '会话置顶'],
  ['conversation_mark.md', '会话标记'],
  ['conversation_receipt.md', '会话已读回执'],
  ['multi_device.md', '多设备登录'],
  ['thread.md', '消息子区 Thread'],
  ['reaction.md', '消息 Reaction'],
  ['push.md', '推送与免打扰'],
  ['log.md', '日志'],
  ['GAPS.md', '缺少功能清单'],
  ['migration-guide.md', '旧 SDK 迁移指南'],
  ['whats-new.md', '新 SDK 增强与变化'],
]);

const apiSectionTitles = new Map([
  ['src/chat-client.ts', 'ChatClient API'],
  ['src/types/chat-client.ts', 'ChatClient 类型'],
  ['src/types/connection.ts', '连接类型'],
  ['src/types/event-system.ts', '事件系统类型'],
  ['src/platform/types.ts', '平台适配类型'],
  ['src/managers/chat-manager.ts', 'ChatManager API'],
  ['src/types/chat-manager.ts', 'ChatManager 类型'],
  ['src/types/index.ts', '消息与基础类型'],
  ['src/types/message-create.ts', '消息创建参数类型'],
  ['src/types/message-conversation.ts', '消息会话定位类型'],
  ['src/types/conversation.ts', '会话类型'],
  ['src/types/multi-device.ts', '多设备事件类型'],
  ['src/managers/chatroom-manager.ts', 'ChatRoomManager API'],
  ['src/managers/chatroom/chatroom.ts', 'ChatRoom API'],
  ['src/types/chatroom.ts', '聊天室类型'],
  ['src/managers/contact-manager.ts', 'ContactManager API'],
  ['src/types/contact.ts', '联系人类型'],
  ['src/managers/group-manager.ts', 'GroupManager API'],
  ['src/managers/group/group.ts', 'Group API'],
  ['src/types/group.ts', '群组类型'],
  ['src/managers/presence-manager.ts', 'PresenceManager API'],
  ['src/types/presence.ts', '在线状态类型'],
  ['src/managers/push-manager.ts', 'PushManager API'],
  ['src/types/push.ts', '推送类型'],
  ['src/managers/user-info-manager.ts', 'UserInfoManager API'],
  ['src/types/user-info.ts', '用户资料类型'],
]);

const sensitivePatterns = [
  { label: 'absolute user path', pattern: /\/Users\/[^\s)]+/ },
  { label: 'private token assignment', pattern: /(EASEMOB|VITE_EASEMOB)_[A-Z_]*(TOKEN|PASSWORD|SECRET)[A-Z_]*\s*=\s*(?!["']?your-)/i },
  { label: 'access token assignment', pattern: /(accessToken|token|password)\s*[:=]\s*["'](?!your-|token|newToken|push-token|token-from-push-provider)[A-Za-z0-9._~+/=-]{16,}["']/i },
];

const ensureCleanGeneratedDir = () => {
  rmSync(generatedReferenceDir, { recursive: true, force: true });
  mkdirSync(generatedReferenceDir, { recursive: true });
};

const readText = path => readFileSync(path, 'utf8');

const writeGenerated = (relativePath, content) => {
  const outputPath = resolve(generatedReferenceDir, relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  assertSafe(content, outputPath);
  writeFileSync(outputPath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
};

const assertSafe = (content, outputPath) => {
  for (const { label, pattern } of sensitivePatterns) {
    const match = content.match(pattern);
    if (match) {
      throw new Error(`生成文档疑似包含敏感内容(${label}): ${outputPath} -> ${match[0]}`);
    }
  }
};

const slugify = input => {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new Error(`无法生成 slug: ${input}`);
  }
  return slug;
};

const fileStem = fileName => basename(fileName, '.md').toLowerCase().replace(/_/g, '-');

const renderFrontmatter = fields => {
  return `---\nid: ${fields.id}\ntitle: ${fields.title}\ndescription: ${fields.description}\n---\n\n`;
};

const rewriteIntegrationLinks = markdown => {
  return markdown.replace(/\]\(\.\/([^)#]+)\)/g, (_match, linkedPath) => {
    return `](./${fileStem(linkedPath)}.md)`;
  });
};

const buildIntegrationReferences = () => {
  const files = readdirSync(integrationSourceDir)
    .filter(file => file.endsWith('.md'))
    .sort((left, right) => left.localeCompare(right));

  const entries = files.map(file => {
    const title = integrationTitles.get(file) ?? basename(file, '.md');
    const relativeOutputPath = `integration/${fileStem(file)}.md`;
    const body = rewriteIntegrationLinks(readText(resolve(integrationSourceDir, file)));
    const content =
      renderFrontmatter({
        id: `generated/integration/${fileStem(file)}`,
        title: `websdk2 Integration - ${title}`,
        description: `来自 SDK 集成文档 docs/integration/${file}，用于回答 ${title} 相关接入问题。`,
      }) + body;

    writeGenerated(relativeOutputPath, content);
    return { title, file, relativeOutputPath };
  });

  const indexBody = [
    '# websdk2 Integration Documentation Index',
    '',
    '本索引由 `docs/integration` 同步生成。回答具体接入问题时，先按主题读取对应 reference，不要只依赖主 skill 摘要。',
    '',
    '## Topics',
    '',
    ...entries.map(entry => `- [${entry.title}](./integration/${basename(entry.relativeOutputPath)}): docs/integration/${entry.file}`),
  ].join('\n');

  writeGenerated(
    'integration-index.md',
    renderFrontmatter({
      id: 'generated/integration-index',
      title: 'websdk2 Integration Documentation Index',
      description: '列出从 docs/integration 同步来的完整 SDK 接入主题文档。',
    }) + indexBody
  );
};

const splitApiReference = markdown => {
  const headingRegex = /^## (.+)$/gm;
  const matches = [...markdown.matchAll(headingRegex)];
  return matches.map((match, index) => {
    const source = match[1] ?? '';
    const start = match.index ?? 0;
    const next = matches[index + 1];
    const end = next?.index ?? markdown.length;
    return {
      source,
      content: markdown.slice(start, end).trimEnd(),
    };
  });
};

const buildApiMethodList = content => {
  return [...content.matchAll(/^### (.+)$/gm)].map(match => match[1] ?? '').filter(Boolean);
};

const buildApiReferences = () => {
  if (!existsSync(apiReferenceSourcePath)) {
    throw new Error(`缺少 API Reference 源文档: ${apiReferenceSourcePath}`);
  }

  const apiMarkdown = readText(apiReferenceSourcePath);
  const sections = splitApiReference(apiMarkdown);
  const entries = sections.map(section => {
    const slug = slugify(section.source);
    const title = apiSectionTitles.get(section.source) ?? section.source;
    const methods = buildApiMethodList(section.content);
    const relativeOutputPath = `api-reference/${slug}.md`;
    const content =
      renderFrontmatter({
        id: `generated/api-reference/${slug}`,
        title: `websdk2 API Reference - ${title}`,
        description: `来自 docs/reference/api-reference.zh-CN.md 的 ${section.source} API Reference 分段。`,
      }) + section.content;

    writeGenerated(relativeOutputPath, content);
    return { title, source: section.source, relativeOutputPath, methods };
  });

  const indexBody = [
    '# websdk2 API Reference Index',
    '',
    '本索引由 `docs/reference/api-reference.zh-CN.md` 同步生成。需要精确签名、参数、返回值或错误码时，先定位下面的分段 reference。',
    '',
    '## Sections',
    '',
    ...entries.flatMap(entry => {
      const lines = [
        `- [${entry.title}](./api-reference/${basename(entry.relativeOutputPath)}): ${entry.source}`,
      ];
      if (entry.methods.length > 0) {
        lines.push(`  - 包含：${entry.methods.slice(0, 18).join('、')}${entry.methods.length > 18 ? ' 等' : ''}`);
      }
      return lines;
    }),
  ].join('\n');

  writeGenerated(
    'api-reference-index.md',
    renderFrontmatter({
      id: 'generated/api-reference-index',
      title: 'websdk2 API Reference Index',
      description: '列出从中文 Markdown API Reference 同步来的 API 分段索引。',
    }) + indexBody
  );
};

ensureCleanGeneratedDir();
buildIntegrationReferences();
buildApiReferences();

const generatedFiles = readdirSync(generatedReferenceDir, { recursive: true })
  .filter(entry => typeof entry === 'string' && entry.endsWith('.md'))
  .map(entry => relative(packageRoot, resolve(generatedReferenceDir, entry)));

console.log(`synced ${generatedFiles.length} generated ai-kit reference files`);
