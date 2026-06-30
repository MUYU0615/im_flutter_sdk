import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

import { API_DOC_ENTRY_FILES } from './api-doc-entry-points.js';
import { API_ERROR_OPERATION_ALIASES } from './api-error-operation-aliases.js';
import { getLocalizedApiEntry, readErrorLocalePack } from './error-message-locale.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

const readArgValue = name => {
  const index = process.argv.findIndex(arg => arg === name);
  if (index < 0 || index === process.argv.length - 1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
};

const normalizeLang = lang => {
  if (lang === 'zh' || lang === 'zh-CN') {
    return 'zh-CN';
  }
  if (lang === 'en' || lang === 'en-US') {
    return 'en-US';
  }
  return 'zh-CN';
};

const normalizeEntry = entry =>
  typeof entry === 'string'
    ? { file: entry, symbols: null }
    : { file: entry.file, symbols: entry.symbols ?? null };

const toAbsoluteFiles = input => {
  const files = input
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
  return files.map(file => ({ file: path.resolve(ROOT, file), symbols: null }));
};

const parseArgs = () => {
  const lang = normalizeLang(readArgValue('--lang') ?? 'zh-CN');
  const filesArg = readArgValue('--files');
  const files = filesArg
    ? toAbsoluteFiles(filesArg)
    : API_DOC_ENTRY_FILES.map(normalizeEntry).map(entry => ({
        file: path.resolve(ROOT, entry.file),
        symbols: entry.symbols,
      }));
  const outputArg = readArgValue('--output');
  const output = outputArg
    ? path.resolve(ROOT, outputArg)
    : path.resolve(ROOT, `docs/api-reference.${lang}.md`);
  return { lang, files, output };
};

const getRawJsDoc = (node, sourceFile) => {
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.pos) ?? [];
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index];
    const value = sourceFile.text.slice(range.pos, range.end);
    if (value.startsWith('/**')) {
      return value;
    }
  }
  return null;
};

const parseJsDoc = rawComment => {
  if (!rawComment) {
    return {
      description: '',
      tags: [],
    };
  }

  const lines = rawComment
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, ''));

  const descriptionLines = [];
  const tags = [];
  let currentTag = null;

  for (const line of lines) {
    if (line.trim().length === 0) {
      if (currentTag) {
        currentTag.content.push('');
      } else {
        descriptionLines.push('');
      }
      continue;
    }

    if (line.startsWith('@')) {
      const spaceIndex = line.indexOf(' ');
      const name = spaceIndex > 0 ? line.slice(1, spaceIndex) : line.slice(1);
      const content = spaceIndex > 0 ? line.slice(spaceIndex + 1).trim() : '';
      currentTag = {
        name,
        content: [content],
      };
      tags.push(currentTag);
      continue;
    }

    if (currentTag) {
      currentTag.content.push(line);
    } else {
      descriptionLines.push(line);
    }
  }

  return {
    description: descriptionLines.join('\n').trim(),
    tags: tags.map(tag => ({
      name: tag.name,
      content: tag.content.join('\n').trim(),
    })),
  };
};

const apiErrors = JSON.parse(
  await fs.readFile(path.resolve(ROOT, 'src/rest/api-errors.json'), 'utf8')
);
const API_ERRORS = apiErrors.apis ?? {};
const OPERATION_NAME_ALIASES = API_ERROR_OPERATION_ALIASES;
const DOC_LOCALE_PACKS = new Map();

const getDocLocalePack = async lang => {
  const cached = DOC_LOCALE_PACKS.get(lang);
  if (cached) {
    return cached;
  }
  const pack = await readErrorLocalePack(lang);
  DOC_LOCALE_PACKS.set(lang, pack);
  return pack;
};

const extractLangText = (text, lang) => {
  if (!text) {
    return '';
  }
  const bothPattern = /\[zh-CN\]([\s\S]*?)\[en-US\]([\s\S]*)/;
  const bothMatched = text.match(bothPattern);
  if (bothMatched) {
    const sharedCodeBlocks = text.match(/```[\s\S]*?```/g)?.join('\n\n') ?? '';
    const target = (lang === 'zh-CN' ? bothMatched[1] : bothMatched[2]).trim();
    if (sharedCodeBlocks.length > 0 && !target.includes('```')) {
      return `${target}\n\n${sharedCodeBlocks}`.trim();
    }
    return target;
  }
  if (lang === 'zh-CN' && text.includes('[zh-CN]')) {
    return text.split('[zh-CN]').slice(1).join('[zh-CN]').trim();
  }
  if (lang === 'en-US' && text.includes('[en-US]')) {
    return text.split('[en-US]').slice(1).join('[en-US]').trim();
  }
  return text.trim();
};

const formatSection = (title, value) => {
  if (!value || value.trim().length === 0) {
    return [];
  }
  return [`#### ${title}`, '', value.trim(), ''];
};

const getOperationErrorEntries = (operationName, methodName) => {
  const definition =
    operationName && typeof API_ERRORS[operationName] === 'object'
      ? API_ERRORS[operationName]
      : undefined;
  if (!definition) {
    return [];
  }

  const localErrors = definition.localErrors?.[methodName] ?? {};
  return [...Object.entries(localErrors), ...Object.entries(definition.errors ?? {})];
};

const getTypeText = (checker, node) => checker.typeToString(checker.getTypeAtLocation(node));

const isExported = node =>
  Array.isArray(node.modifiers) &&
  node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);

const isPublicMethod = node => {
  if (!Array.isArray(node.modifiers) || node.modifiers.length === 0) {
    return true;
  }
  return !node.modifiers.some(
    modifier =>
      modifier.kind === ts.SyntaxKind.PrivateKeyword ||
      modifier.kind === ts.SyntaxKind.ProtectedKeyword
  );
};

const isInternalDoc = (node, sourceFile) => {
  const raw = getRawJsDoc(node, sourceFile);
  return typeof raw === 'string' && raw.includes('@internal');
};

const renderMethod = async (checker, sourceFile, method, lang, localePack) => {
  const methodName = method.name.getText(sourceFile);
  const parameters = method.parameters.map(item => {
    const name = item.name.getText(sourceFile);
    const type = item.type ? item.type.getText(sourceFile) : getTypeText(checker, item);
    return `${name}: ${type}`;
  });
  const returnType = method.type ? method.type.getText(sourceFile) : 'unknown';
  const rawComment = getRawJsDoc(method, sourceFile);
  const parsed = parseJsDoc(rawComment);

  const lines = [`### ${methodName}(${parameters.join(', ')}) => ${returnType}`, ''];
  const description = extractLangText(parsed.description, lang);
  lines.push(...formatSection(lang === 'zh-CN' ? '说明' : 'Description', description));

  const exampleTags = parsed.tags.filter(tag => tag.name === 'example');
  const examples = exampleTags
    .map(tag => extractLangText(tag.content, lang))
    .filter(value => value.length > 0);
  if (examples.length > 0) {
    lines.push(`#### ${lang === 'zh-CN' ? '调用示例' : 'Examples'}`, '');
    for (const example of examples) {
      lines.push(example, '');
    }
  }

  if (method.parameters.length > 0) {
    lines.push(`#### ${lang === 'zh-CN' ? '参数' : 'Parameters'}`, '');
    lines.push('| Name | Type | Description |');
    lines.push('| --- | --- | --- |');

    const paramTags = parsed.tags.filter(tag => tag.name === 'param');
    for (const parameter of method.parameters) {
      const paramName = parameter.name.getText(sourceFile);
      const paramType = parameter.type
        ? parameter.type.getText(sourceFile)
        : getTypeText(checker, parameter);
      const matched = paramTags.find(tag => tag.content.startsWith(`${paramName} `));
      const descriptionValue = matched
        ? extractLangText(matched.content.replace(new RegExp(`^${paramName}\\s*-?\\s*`), ''), lang)
        : '';
      lines.push(`| ${paramName} | \`${paramType}\` | ${descriptionValue || '-'} |`);
    }
    lines.push('');
  }

  const returnsTag = parsed.tags.find(tag => tag.name === 'returns');
  if (returnsTag) {
    lines.push(
      ...formatSection(
        lang === 'zh-CN' ? '返回值' : 'Returns',
        extractLangText(returnsTag.content, lang)
      )
    );
  }

  const operationTag = parsed.tags.find(tag => tag.name === 'operation');
  const operationName =
    operationTag?.content.trim() ||
    OPERATION_NAME_ALIASES[methodName] ||
    (typeof API_ERRORS[methodName] === 'object' ? methodName : '');
  const operationErrorEntries = getOperationErrorEntries(operationName, methodName);

  const throwsTags = operationErrorEntries.length > 0
    ? []
    : parsed.tags.filter(tag => tag.name === 'throws');
  if (throwsTags.length > 0) {
    lines.push(`#### ${lang === 'zh-CN' ? '可能错误' : 'Possible Errors'}`, '');
    for (const tag of throwsTags) {
      const content = extractLangText(tag.content, lang);
      lines.push(`- ${content}`);
    }
    lines.push('');
  }

  if (operationErrorEntries.length > 0) {
    lines.push(`#### ${lang === 'zh-CN' ? '错误清单' : 'Error Matrix'}`, '');
    lines.push('| Code | Key | Reason | Action |');
    lines.push('| --- | --- | --- | --- |');
    for (const [errorKey, entry] of operationErrorEntries) {
      const keyText = String(errorKey);
      const [localMethodName, localKey] = keyText.includes('.')
        ? keyText.split('.', 2)
        : [methodName, keyText];
      const localized = getLocalizedApiEntry(localePack, operationName, localKey, localMethodName);
      const reason =
        typeof localized.reason === 'string'
          ? localized.reason
          : typeof entry.reason === 'string'
            ? entry.reason
            : (localized.message ?? entry.message);
      const action =
        typeof localized.action === 'string'
          ? localized.action
          : typeof entry.action === 'string'
            ? entry.action
            : '-';
      lines.push(`| ${entry.code} | ${errorKey} | ${reason} | ${action} |`);
    }
    lines.push('');
  }

  return lines;
};

const renderInterface = (checker, sourceFile, declaration, lang) => {
  const interfaceName = declaration.name.text;
  const rawComment = getRawJsDoc(declaration, sourceFile);
  const parsed = parseJsDoc(rawComment);
  const lines = [`### ${interfaceName}`, ''];

  const description = extractLangText(parsed.description, lang);
  lines.push(...formatSection(lang === 'zh-CN' ? '说明' : 'Description', description));

  if (!declaration.members || declaration.members.length === 0) {
    return lines;
  }

  lines.push(`#### ${lang === 'zh-CN' ? '字段' : 'Fields'}`, '');
  lines.push('| Name | Type | Description |');
  lines.push('| --- | --- | --- |');

  for (const member of declaration.members) {
    if (!ts.isPropertySignature(member) || !member.name) {
      continue;
    }
    if (isInternalDoc(member, sourceFile)) {
      continue;
    }
    const propertyName = member.name.getText(sourceFile);
    const typeText = member.type ? member.type.getText(sourceFile) : getTypeText(checker, member);
    const propertyDoc = parseJsDoc(getRawJsDoc(member, sourceFile));
    const descriptionValue = extractLangText(propertyDoc.description, lang);
    lines.push(`| ${propertyName} | \`${typeText}\` | ${descriptionValue || '-'} |`);
  }

  lines.push('');
  return lines;
};

const shouldRenderSymbol = (symbols, name) =>
  !Array.isArray(symbols) || symbols.length === 0 || symbols.includes(name);

const renderFile = async (program, checker, entry, lang, localePack) => {
  const { file: filePath, symbols } = entry;
  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) {
    return [];
  }
  const lines = [`## ${path.relative(ROOT, filePath)}`, ''];

  for (const statement of sourceFile.statements) {
    if (ts.isClassDeclaration(statement) && statement.name && isExported(statement)) {
      if (!shouldRenderSymbol(symbols, statement.name.text)) {
        continue;
      }
      lines.push(`### ${statement.name.text}`, '');
      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member) || !member.name || !isPublicMethod(member)) {
          continue;
        }
        if (isInternalDoc(member, sourceFile)) {
          continue;
        }
        lines.push(...(await renderMethod(checker, sourceFile, member, lang, localePack)));
      }
      continue;
    }

    if (ts.isInterfaceDeclaration(statement) && isExported(statement)) {
      if (!shouldRenderSymbol(symbols, statement.name.text)) {
        continue;
      }
      if (isInternalDoc(statement, sourceFile)) {
        continue;
      }
      lines.push(...renderInterface(checker, sourceFile, statement, lang));
    }
  }

  return lines;
};

const { lang, files, output } = parseArgs();
const localePack = await getDocLocalePack(lang);

const program = ts.createProgram(files.map(entry => entry.file), {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  strict: true,
});
const checker = program.getTypeChecker();

const lines = [
  `# IM SDK Web API Reference (${lang})`,
  '',
  lang === 'zh-CN'
    ? '本文档由脚本从 JSDoc 自动生成。'
    : 'This document is generated from JSDoc comments.',
  '',
];

for (const entry of files) {
  lines.push(...(await renderFile(program, checker, entry, lang, localePack)));
}

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${lines.join('\n').trimEnd()}\n`, 'utf8');
process.stdout.write(`Generated ${path.relative(ROOT, output)}\n`);
