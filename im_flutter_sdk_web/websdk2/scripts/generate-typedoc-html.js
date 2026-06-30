import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { deflate, inflate } from 'node:zlib';
import { promisify } from 'node:util';

import { API_DOC_ENTRY_FILES, API_DOC_PROJECT_DOCUMENTS } from './api-doc-entry-points.js';
import { API_ERROR_OPERATION_ALIASES } from './api-error-operation-aliases.js';
import { getLocalizedApiEntry, readErrorLocalePack } from './error-message-locale.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const inflateAsync = promisify(inflate);
const deflateAsync = promisify(deflate);
const normalizeApiDocEntry = entry => (typeof entry === 'string' ? entry : entry.file);
const apiErrors = JSON.parse(
  await fs.readFile(path.resolve(ROOT, 'src/rest/api-errors.json'), 'utf8')
);
const API_ERRORS = apiErrors.apis ?? {};
const DOC_SOURCE_CACHE = new Map();
const ERROR_LOCALE_PACKS = new Map();

const getErrorLocalePack = async lang => {
  const cached = ERROR_LOCALE_PACKS.get(lang);
  if (cached) {
    return cached;
  }
  const pack = await readErrorLocalePack(lang);
  ERROR_LOCALE_PACKS.set(lang, pack);
  return pack;
};

const readDocSourceFile = async relativePath => {
  const cached = DOC_SOURCE_CACHE.get(relativePath);
  if (typeof cached === 'string') {
    return cached;
  }
  const raw = await fs.readFile(path.join(ROOT, relativePath), 'utf8');
  DOC_SOURCE_CACHE.set(relativePath, raw);
  return raw;
};

const extractConstObjectValues = async (relativePath, constName) => {
  const raw = await readDocSourceFile(relativePath);
  const pattern = new RegExp(`export const ${constName} = \\{([\\s\\S]*?)\\} as const;`, 'u');
  const match = raw.match(pattern);
  if (!match) {
    throw new Error(`Unable to resolve ${constName} from ${relativePath}`);
  }
  return [...match[1].matchAll(/:\s*'([^']+)'/gu)].map(item => item[1]);
};

const uniqueValues = values => [...new Set(values)];

const buildAddEventHandlerDocSpecs = async () => {
  const [
    connectionEventNames,
    chatEventNames,
    presenceEventNames,
    contactEventNames,
    userInfoEventNames,
    groupEventNames,
    chatRoomEventNames,
  ] = await Promise.all([
    extractConstObjectValues('src/types/connection.ts', 'ConnectionEventName'),
    extractConstObjectValues('src/types/event-system.ts', 'ChatEventName'),
    extractConstObjectValues('src/types/event-system.ts', 'PresenceEventName'),
    extractConstObjectValues('src/types/event-system.ts', 'ContactEventName'),
    extractConstObjectValues('src/types/event-system.ts', 'UserInfoEventName'),
    extractConstObjectValues('src/types/event-system.ts', 'GroupEventName'),
    extractConstObjectValues('src/types/chatroom.ts', 'ChatRoomEventName'),
  ]);

  const eventHandlerIdDocPath = '../types/types_event-system.EventHandlerId.html';

  return [
    {
      pageSuffix: 'classes/chat-client.ChatClient.html',
      handlerTypeName: 'EventHandlerMap',
      handlerTypePath: '../types/types_event-system.EventHandlerMap.html',
      idTypeName: 'EventHandlerId',
      idTypePath: eventHandlerIdDocPath,
      title: {
        'zh-CN': '公开可监听事件',
        'en-US': 'Public Events',
      },
      groups: [
        {
          label: {
            'zh-CN': '连接',
            'en-US': 'Connection',
          },
          eventNames: connectionEventNames,
          docName: 'ConnectionEventName',
          docPath: '../variables/types_connection.ConnectionEventName.html',
        },
        {
          label: {
            'zh-CN': '消息与会话',
            'en-US': 'Chat and Conversation',
          },
          eventNames: chatEventNames,
          docName: 'ChatEventName',
          docPath: '../variables/types_event-system.ChatEventName.html',
        },
        {
          label: {
            'zh-CN': '在线状态',
            'en-US': 'Presence',
          },
          eventNames: presenceEventNames,
          docName: 'PresenceEventName',
          docPath: '../variables/types_event-system.PresenceEventName.html',
        },
        {
          label: {
            'zh-CN': '联系人',
            'en-US': 'Contacts',
          },
          eventNames: contactEventNames,
          docName: 'ContactEventName',
          docPath: '../variables/types_event-system.ContactEventName.html',
        },
        {
          label: {
            'zh-CN': '用户资料',
            'en-US': 'User Info',
          },
          eventNames: userInfoEventNames,
          docName: 'UserInfoEventName',
          docPath: '../variables/types_event-system.UserInfoEventName.html',
        },
        {
          label: {
            'zh-CN': '群组',
            'en-US': 'Groups',
          },
          eventNames: groupEventNames,
          docName: 'GroupEventName',
          docPath: '../variables/types_event-system.GroupEventName.html',
        },
      ],
    },
    {
      pageSuffix: 'classes/managers_chat-manager.ChatManager.html',
      handlerTypeName: 'ChatEventHandlerMap',
      handlerTypePath: '../types/types_event-system.ChatEventHandlerMap.html',
      idTypeName: 'EventHandlerId',
      idTypePath: eventHandlerIdDocPath,
      title: {
        'zh-CN': '可监听事件',
        'en-US': 'Supported Events',
      },
      groups: [
        {
          eventNames: chatEventNames,
          docName: 'ChatEventName',
          docPath: '../variables/types_event-system.ChatEventName.html',
        },
      ],
    },
    {
      pageSuffix: 'classes/managers_chatroom-manager.ChatRoomManager.html',
      handlerTypeName: 'ChatRoomEventHandlerMap',
      handlerTypePath: '../types/types_chatroom.ChatRoomEventHandlerMap.html',
      idTypeName: 'EventHandlerId',
      idTypePath: eventHandlerIdDocPath,
      title: {
        'zh-CN': '可监听事件',
        'en-US': 'Supported Events',
      },
      groups: [
        {
          eventNames: chatRoomEventNames,
          docName: 'ChatRoomEventName',
          docPath: '../variables/types_chatroom.ChatRoomEventName.html',
        },
      ],
    },
    {
      pageSuffix: 'classes/managers_contact-manager.ContactManager.html',
      handlerTypeName: 'ContactEventHandlerMap',
      handlerTypePath: '../types/types_event-system.ContactEventHandlerMap.html',
      title: {
        'zh-CN': '可监听事件',
        'en-US': 'Supported Events',
      },
      groups: [
        {
          eventNames: contactEventNames,
          docName: 'ContactEventName',
          docPath: '../variables/types_event-system.ContactEventName.html',
        },
      ],
    },
    {
      pageSuffix: 'classes/managers_group-manager.GroupManager.html',
      handlerTypeName: 'GroupEventHandlerMap',
      handlerTypePath: '../types/types_event-system.GroupEventHandlerMap.html',
      idTypeName: 'EventHandlerId',
      idTypePath: eventHandlerIdDocPath,
      title: {
        'zh-CN': '可监听事件',
        'en-US': 'Supported Events',
      },
      groups: [
        {
          eventNames: groupEventNames,
          docName: 'GroupEventName',
          docPath: '../variables/types_event-system.GroupEventName.html',
        },
      ],
    },
    {
      pageSuffix: 'classes/managers_presence-manager.PresenceManager.html',
      handlerTypeName: 'PresenceEventHandlerMap',
      handlerTypePath: '../types/types_event-system.PresenceEventHandlerMap.html',
      idTypeName: 'EventHandlerId',
      idTypePath: eventHandlerIdDocPath,
      title: {
        'zh-CN': '可监听事件',
        'en-US': 'Supported Events',
      },
      groups: [
        {
          eventNames: presenceEventNames,
          docName: 'PresenceEventName',
          docPath: '../variables/types_event-system.PresenceEventName.html',
        },
      ],
    },
    {
      pageSuffix: 'classes/managers_user-info-manager.UserInfoManager.html',
      handlerTypeName: 'UserInfoEventHandlerMap',
      handlerTypePath: '../types/types_event-system.UserInfoEventHandlerMap.html',
      idTypeName: 'EventHandlerId',
      idTypePath: eventHandlerIdDocPath,
      title: {
        'zh-CN': '可监听事件',
        'en-US': 'Supported Events',
      },
      groups: [
        {
          eventNames: userInfoEventNames,
          docName: 'UserInfoEventName',
          docPath: '../variables/types_event-system.UserInfoEventName.html',
        },
      ],
    },
  ];
};

const ADD_EVENT_HANDLER_DOC_SPECS = await buildAddEventHandlerDocSpecs();

const readArgValue = name => {
  const index = process.argv.findIndex(arg => arg === name);
  if (index < 0 || index === process.argv.length - 1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
};

const parseLang = input => {
  if (input === 'en' || input === 'en-US') {
    return 'en-US';
  }
  return 'zh-CN';
};

const extractInlineSegment = (value, lang) => {
  const zhIndex = value.indexOf('[zh-CN]');
  const enIndex = value.indexOf('[en-US]');
  if (zhIndex < 0 || enIndex < 0) {
    return null;
  }

  const markerLength = '[zh-CN]'.length;
  if (zhIndex < enIndex) {
    const prefix = value.slice(0, zhIndex);
    const zhBody = value.slice(zhIndex + markerLength, enIndex);
    const enBody = value.slice(enIndex + '[en-US]'.length);
    const selectedBody = lang === 'zh-CN' ? zhBody : enBody;
    return `${prefix}${selectedBody}`.trimEnd();
  }

  const prefix = value.slice(0, enIndex);
  const enBody = value.slice(enIndex + '[en-US]'.length, zhIndex);
  const zhBody = value.slice(zhIndex + markerLength);
  const selectedBody = lang === 'en-US' ? enBody : zhBody;
  return `${prefix}${selectedBody}`.trimEnd();
};

const normalizeCommentBlockByLang = (block, lang) => {
  const lines = block.split('\n');
  if (lines.length === 1) {
    const singleLineMatch = block.match(/^(\s*\/\*\*\s?)([\s\S]*?)(\s*\*\/\s*)$/u);
    if (!singleLineMatch) {
      return block;
    }

    const prefix = singleLineMatch[1];
    const rawContent = singleLineMatch[2];
    const suffix = singleLineMatch[3];
    const inlineSegment = extractInlineSegment(rawContent, lang);
    if (inlineSegment !== null) {
      return `${prefix}${inlineSegment}${suffix}`;
    }
    if (rawContent.includes('[zh-CN]')) {
      if (lang === 'zh-CN') {
        const normalized = rawContent.split('[zh-CN]').join('').trim();
        return `${prefix}${normalized}${suffix}`;
      }
      return `${prefix.trimEnd()} ${suffix.trimStart()}`;
    }
    if (rawContent.includes('[en-US]')) {
      if (lang === 'en-US') {
        const normalized = rawContent.split('[en-US]').join('').trim();
        return `${prefix}${normalized}${suffix}`;
      }
      return `${prefix.trimEnd()} ${suffix.trimStart()}`;
    }
    return block;
  }

  if (lines.length <= 2) {
    return block;
  }

  const bodyLines = lines.slice(1, -1);
  let currentSection = null;
  const normalizedBody = bodyLines.map(line => {
    const match = line.match(/^(\s*\*\s?)(.*)$/u);
    if (!match) {
      return line;
    }

    const prefix = match[1];
    const rawContent = match[2];
    const inlineSegment = extractInlineSegment(rawContent, lang);
    if (inlineSegment !== null) {
      currentSection = null;
      return `${prefix}${inlineSegment}`.trimEnd();
    }

    if (rawContent.includes('[zh-CN]')) {
      currentSection = 'zh-CN';
      if (lang === 'zh-CN') {
        const normalized = rawContent.split('[zh-CN]').join('').trimStart();
        return `${prefix}${normalized}`.trimEnd();
      }
      return prefix.trimEnd();
    }

    if (rawContent.includes('[en-US]')) {
      currentSection = 'en-US';
      if (lang === 'en-US') {
        const normalized = rawContent.split('[en-US]').join('').trimStart();
        return `${prefix}${normalized}`.trimEnd();
      }
      return prefix.trimEnd();
    }

    if (currentSection === null || currentSection === lang) {
      return line;
    }
    return prefix.trimEnd();
  });

  return [lines[0], ...normalizedBody, lines[lines.length - 1]].join('\n');
};

const transformCommentsByLang = (content, lang) => {
  return content.replace(/\/\*\*[\s\S]*?\*\//gu, block => {
    return normalizeCommentBlockByLang(block, lang);
  });
};

const extractOperationName = block => {
  const match = block.match(/^\s*\*\s*@operation\s+(\S+)/mu);
  return match?.[1];
};

const resolveOperationName = (methodName, commentBlock) => {
  const explicitOperation = extractOperationName(commentBlock);
  if (explicitOperation && API_ERRORS[explicitOperation]) {
    return explicitOperation;
  }
  const aliasedOperation = API_ERROR_OPERATION_ALIASES[methodName];
  if (aliasedOperation && API_ERRORS[aliasedOperation]) {
    return aliasedOperation;
  }
  return API_ERRORS[methodName] ? methodName : '';
};

const formatRetryable = value => {
  if (value === true) {
    return '是';
  }
  if (value === false) {
    return '否';
  }
  return '-';
};

const escapeTableCell = value =>
  String(value ?? '-')
    .replaceAll('|', '\\|')
    .replaceAll('\n', '<br>');

const getOperationErrorEntries = (operationName, methodName) => {
  const definition = API_ERRORS[operationName];
  if (!definition) {
    return [];
  }

  const localErrors = definition.localErrors?.[methodName] ?? {};
  return [...Object.entries(localErrors), ...Object.entries(definition.errors ?? {})];
};

const renderOperationErrorLines = (operationName, methodName, lang, localePack) => {
  const entries = getOperationErrorEntries(operationName, methodName);
  if (entries.length === 0) {
    return [];
  }

  const title = lang === 'zh-CN' ? '#### 可能出现的错误码' : '#### Possible Error Codes';
  const header =
    lang === 'zh-CN'
      ? '| Code | 含义 | HTTP | 处理建议 | 可重试 |'
      : '| Code | Message | HTTP | Action | Retryable |';

  return [
    '@remarks',
    '',
    title,
    '',
    header,
    '| ---: | --- | --- | --- | --- |',
    ...entries.map(([errorKey, entry]) => {
      const keyText = String(errorKey);
      const [localMethodName, localKey] = keyText.includes('.')
        ? keyText.split('.', 2)
        : [methodName, keyText];
      const localized = getLocalizedApiEntry(
        localePack,
        operationName,
        localKey,
        localMethodName
      );
      const http = entry.httpStatus ?? '-';
      const message = localized.message ?? entry.message;
      const action = localized.action ?? entry.action ?? '-';
      const retryable =
        lang === 'zh-CN' ? formatRetryable(entry.retryable) : String(entry.retryable ?? '-');
      return `| ${entry.code} | ${escapeTableCell(message)} | ${escapeTableCell(http)} | ${escapeTableCell(action)} | ${retryable} |`;
    }),
  ];
};

const removeThrowsTags = commentBlock => {
  return commentBlock
    .split('\n')
    .filter(line => !/^\s*\*\s*@throws\b/u.test(line))
    .join('\n');
};

const removeInternalDocTags = commentBlock => {
  return commentBlock
    .split('\n')
    .filter(line => !/^\s*\*\s*@operation\b/u.test(line))
    .filter(line => !/^\s*\*\s*@param\s+this\b/u.test(line))
    .join('\n');
};

const appendCommentLines = (commentBlock, linesToAppend) => {
  if (linesToAppend.length === 0) {
    return commentBlock;
  }
  const formattedLines = [
    ' *',
    ...linesToAppend.map(line => (line.length > 0 ? ` * ${line}` : ' *')),
  ];
  return commentBlock.replace(/\n\s*\*\/\s*$/u, `\n${formattedLines.join('\n')}\n */`);
};

const injectOperationErrorComments = (content, lang, localePack) => {
  const methodPattern =
    /(\/\*\*[\s\S]*?\*\/)(\s*(?:public\s+|protected\s+|private\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\()/gu;
  return content.replace(methodPattern, (match, commentBlock, methodStart, methodName) => {
    const operationName = resolveOperationName(methodName, commentBlock);
    const linesToAppend = renderOperationErrorLines(operationName, methodName, lang, localePack);
    const normalizedCommentBlock =
      linesToAppend.length > 0 ? removeThrowsTags(commentBlock) : commentBlock;
    return `${appendCommentLines(removeInternalDocTags(normalizedCommentBlock), linesToAppend)}${methodStart}`;
  });
};

const copySourceToTemp = async (tempRoot, lang) => {
  const localePack = await getErrorLocalePack(lang);
  await fs.cp(path.join(ROOT, 'src'), path.join(tempRoot, 'src'), { recursive: true });

  for (const entry of API_DOC_ENTRY_FILES) {
    const relativePath = normalizeApiDocEntry(entry);
    const filePath = path.join(tempRoot, relativePath);
    const raw = await fs.readFile(filePath, 'utf8');
    const localized = transformCommentsByLang(raw, lang);
    const transformed = injectOperationErrorComments(localized, lang, localePack);
    await fs.writeFile(filePath, transformed, 'utf8');
  }
};

const copyProjectDocumentsToTemp = async (tempRoot, lang) => {
  const tempDocumentPaths = [];
  for (const relativePath of API_DOC_PROJECT_DOCUMENTS) {
    const targetPath = path.join(tempRoot, 'src', 'error-codes.md');
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const errorDoc = spawnSync(
      process.execPath,
      [
        'scripts/generate-typedoc-error-docs.mjs',
        '--lang',
        lang,
        '--out',
        path.relative(ROOT, targetPath),
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
      }
    );
    if (errorDoc.status !== 0) {
      throw new Error(errorDoc.stderr || errorDoc.stdout || 'Failed to generate error code docs');
    }
    tempDocumentPaths.push(targetPath);
  }
  return tempDocumentPaths;
};

const writeTempTsConfig = async tempRoot => {
  const configPath = path.join(tempRoot, 'tsconfig.typedoc.json');
  const content = {
    extends: path.join(ROOT, 'tsconfig.json'),
    include: ['src/**/*'],
  };
  await fs.writeFile(configPath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  return configPath;
};

const writeTempTypeDocConfig = async (tempRoot, tsConfigPath, outDir, lang, projectDocuments) => {
  const configPath = path.join(tempRoot, 'typedoc.json');
  const siteTitle = lang === 'zh-CN' ? 'IM SDK Web API 文档' : 'IM SDK Web API Reference';
  const content = {
    tsconfig: tsConfigPath,
    entryPoints: API_DOC_ENTRY_FILES.map(normalizeApiDocEntry).map(file => path.join(tempRoot, file)),
    projectDocuments,
    out: outDir,
    name: siteTitle,
    readme: 'none',
    basePath: path.join(tempRoot, 'src'),
    excludePrivate: true,
    excludeProtected: true,
    excludeInternal: true,
    disableSources: true,
    skipErrorChecking: true,
    searchInDocuments: true,
    navigation: {
      includeFolders: true,
      compactFolders: true,
    },
    sort: ['source-order'],
  };
  await fs.writeFile(configPath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  return configPath;
};

const runTypeDoc = typeDocConfigPath => {
  const typedocBin = path.join(
    ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'typedoc.cmd' : 'typedoc'
  );
  const args = ['--options', typeDocConfigPath];

  const result = spawnSync(typedocBin, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`TypeDoc generation failed with code ${result.status ?? -1}`);
  }
};

const collectHtmlFiles = async root => {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectHtmlFiles(fullPath);
      result.push(...nested);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.html')) {
      result.push(fullPath);
    }
  }
  return result;
};

const readCompressedDataAssignment = async (filePath, variableName) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const match = raw.match(new RegExp(`^window\\.${variableName} = "([^"]+)";?$`, 'u'));
  if (!match) {
    return null;
  }
  const inflated = await inflateAsync(Buffer.from(match[1], 'base64'));
  return JSON.parse(inflated.toString('utf8'));
};

const writeCompressedDataAssignment = async (filePath, variableName, data) => {
  const compressed = await deflateAsync(Buffer.from(JSON.stringify(data)));
  await fs.writeFile(
    filePath,
    `window.${variableName} = "${compressed.toString('base64')}"`,
    'utf8'
  );
};

const formatNavigationText = value => {
  if (value === 'docs/reference/typedoc-error-codes' || value === 'typedoc-error-codes') {
    return 'error-codes';
  }
  return value.replace(/^src\//u, '').replace(/^docs\/reference\//u, '');
};

const isErrorCodeNavigationItem = item =>
  item.text === 'error-codes' ||
  item.path?.includes('typedoc-error-codes') === true ||
  item.path?.includes('error-codes') === true;

const isRootDirectoryWrapper = item =>
  item.path === undefined &&
  item.kind === undefined &&
  item.class === undefined &&
  (item.text === 'src' || item.text === 'docs' || item.text === 'reference');

const normalizeNavigationItem = item => {
  const normalizedChildren = (item.children ?? []).flatMap(child => normalizeNavigationItem(child));
  if (isRootDirectoryWrapper(item)) {
    return normalizedChildren;
  }

  const normalized = {
    ...item,
    text: formatNavigationText(item.text),
  };

  if (normalizedChildren.length > 0) {
    normalized.children = normalizedChildren;
  } else {
    delete normalized.children;
  }

  return [normalized];
};

const normalizeNavigationData = navigation => {
  const result = navigation.flatMap(item => normalizeNavigationItem(item));
  const errorCodeItems = result.filter(isErrorCodeNavigationItem);
  const regularItems = result.filter(item => !isErrorCodeNavigationItem(item));
  return [...regularItems, ...errorCodeItems];
};

const escapeHtml = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildSignatureTypeLink = (typeName, typePath) => {
  return `<a href="${typePath}" class="tsd-signature-type tsd-kind-type-alias">${escapeHtml(typeName)}</a>`;
};

const buildSignatureIdType = spec => {
  if (spec.idTypeName && spec.idTypePath) {
    return buildSignatureTypeLink(spec.idTypeName, spec.idTypePath);
  }
  return '<span class="tsd-signature-type">string</span>';
};

const buildEventListMarkup = (spec, lang) => {
  const title = spec.title[lang];
  const groupsMarkup = spec.groups
    .map(group => {
      const label = group.label?.[lang];
      const values = uniqueValues(group.eventNames);
      const items = values.map(eventName => `<code>${escapeHtml(eventName)}</code>`).join(', ');
      const docLink =
        group.docName && group.docPath
          ? `<p><a href="${group.docPath}" class="tsd-kind-variable">${escapeHtml(group.docName)}</a></p>`
          : '';
      const summary = label ? `<p><strong>${escapeHtml(label)}:</strong> ${items}</p>` : `<p>${items}</p>`;
      return `${summary}${docLink}`;
    })
    .join('');

  return `<div class="tsd-comment tsd-typography"><h4>${escapeHtml(title)}</h4>${groupsMarkup}</div>`;
};

const rewriteAddEventHandlerSection = (raw, spec, lang) => {
  const methodSectionPattern =
    /(<section class="tsd-panel tsd-member"><a id="addeventhandler" class="tsd-anchor"><\/a><h3 class="tsd-anchor-link"><span>add<wbr\/>Event<wbr\/>Handler<\/span>[\s\S]*?)(<\/section><section class="tsd-panel tsd-member"><a id="removeeventhandler" class="tsd-anchor">)/u;
  const methodSectionMatch = raw.match(methodSectionPattern);
  if (!methodSectionMatch) {
    return raw;
  }

  let methodSection = methodSectionMatch[1];
  const nextSection = methodSectionMatch[2];

  const signaturePattern =
    /<span class="tsd-kind-call-signature">addEventHandler<\/span><span class="tsd-signature-symbol">\(<\/span><span class="tsd-kind-parameter">id<\/span><span class="tsd-signature-symbol">:<\/span>[\s\S]*?<span class="tsd-kind-parameter">handlers<\/span><span class="tsd-signature-symbol">:<\/span>[\s\S]*?<span class="tsd-signature-symbol">\)<\/span><span class="tsd-signature-symbol">:<\/span> <span class="tsd-signature-type">void<\/span>/u;
  const signatureReplacement =
    `<span class="tsd-kind-call-signature">addEventHandler</span><span class="tsd-signature-symbol">(</span>` +
    `<span class="tsd-kind-parameter">id</span><span class="tsd-signature-symbol">:</span> ${buildSignatureIdType(spec)}` +
    `<span class="tsd-signature-symbol">,</span> <span class="tsd-kind-parameter">handlers</span><span class="tsd-signature-symbol">:</span> ${buildSignatureTypeLink(spec.handlerTypeName, spec.handlerTypePath)}` +
    `<span class="tsd-signature-symbol">)</span><span class="tsd-signature-symbol">:</span> <span class="tsd-signature-type">void</span>`;
  methodSection = methodSection.replace(signaturePattern, signatureReplacement);

  const handlerParamPattern =
    /(<li><span><span class="tsd-kind-parameter">handlers<\/span>: )[\s\S]*?(<\/span><div class="tsd-comment tsd-typography">)/u;
  methodSection = methodSection.replace(
    handlerParamPattern,
    `$1${buildSignatureTypeLink(spec.handlerTypeName, spec.handlerTypePath)}$2`
  );

  const eventListMarkup = buildEventListMarkup(spec, lang);
  if (!methodSection.includes(eventListMarkup)) {
    methodSection = methodSection.replace(
      /(<\/div><h4 class="tsd-returns-title">Returns )/u,
      `${eventListMarkup}$1`
    );
  }

  return raw.replace(methodSectionPattern, `${methodSection}${nextSection}`);
};

const cleanupNavigationData = async outDir => {
  const navigationPath = path.join(outDir, 'assets', 'navigation.js');
  const navigation = await readCompressedDataAssignment(navigationPath, 'navigationData');
  if (!navigation) {
    return;
  }
  await writeCompressedDataAssignment(
    navigationPath,
    'navigationData',
    normalizeNavigationData(navigation)
  );
};

const applyAddEventHandlerDocFixes = (filePath, raw, lang) => {
  const spec = ADD_EVENT_HANDLER_DOC_SPECS.find(item => filePath.endsWith(item.pageSuffix));
  if (!spec) {
    return raw;
  }
  return rewriteAddEventHandlerSection(raw, spec, lang);
};

const cleanupTypeDocHtml = async (outDir, lang) => {
  const htmlFiles = await collectHtmlFiles(outDir);
  for (const filePath of htmlFiles) {
    const raw = await fs.readFile(filePath, 'utf8');
    const normalized = applyAddEventHandlerDocFixes(filePath, raw, lang)
      .replace(/<aside class="tsd-sources">[\s\S]*?<\/aside>/gu, '')
      .replace(
        /<section class="tsd-panel"><h4>Implements<\/h4><ul class="tsd-hierarchy">[\s\S]*?<\/ul><\/section>/gu,
        ''
      )
      .replace(
        /<div class="tsd-tag-remarks"><h4 class="tsd-anchor-link"><a id="remarks[^"]*" class="tsd-anchor"><\/a>Remarks<a href="#remarks[^"]*" aria-label="Permalink" class="tsd-anchor-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="[^"]*#icon-anchor"><\/use><\/svg><\/a><\/h4>(<a id="(?:可能出现的错误码|possible-error-codes)[\s\S]*?<\/table>)\s*<\/div>/gu,
        '$1'
      );
    if (normalized !== raw) {
      await fs.writeFile(filePath, normalized, 'utf8');
    }
  }
  await cleanupNavigationData(outDir);
};

const main = async () => {
  const lang = parseLang(readArgValue('--lang'));
  const defaultOutput = path.join(ROOT, `docs-site/api/${lang}`);
  const outputPath = path.resolve(ROOT, readArgValue('--out') ?? defaultOutput);
  const tempRoot = path.join(
    ROOT,
    `.typedoc-tmp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  );

  await fs.rm(outputPath, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });

  try {
    await copySourceToTemp(tempRoot, lang);
    const projectDocuments = await copyProjectDocumentsToTemp(tempRoot, lang);
    const tsConfigPath = await writeTempTsConfig(tempRoot);
    const typeDocConfigPath = await writeTempTypeDocConfig(
      tempRoot,
      tsConfigPath,
      outputPath,
      lang,
      projectDocuments
    );
    runTypeDoc(typeDocConfigPath);
    await cleanupTypeDocHtml(outputPath, lang);
    process.stdout.write(`Generated TypeDoc HTML: ${path.relative(ROOT, outputPath)}\n`);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

await main();
