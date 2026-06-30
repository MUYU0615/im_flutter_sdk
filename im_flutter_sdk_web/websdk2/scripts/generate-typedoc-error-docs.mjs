#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { collectErrorEntries, groupByCanonicalCode, readApiErrors } from './error-code-model.mjs';
import {
  getLocalizedApiDefinition,
  getLocalizedApiEntry,
  readErrorLocalePack,
} from './error-message-locale.mjs';

const ROOT = new URL('..', import.meta.url);
const readArgValue = name => {
  const index = process.argv.findIndex(arg => arg === name);
  if (index < 0 || index === process.argv.length - 1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
};
const lang = readArgValue('--lang') === 'en-US' || readArgValue('--lang') === 'en' ? 'en-US' : 'zh-CN';
const isZh = lang === 'zh-CN';
const outArg = readArgValue('--out');

const unique = values => [...new Set(values.filter(value => value !== undefined && value !== ''))];

const formatTextList = values => {
  const items = unique(values.map(value => String(value ?? '').trim()).filter(Boolean));
  return items.length > 0 ? items.join('；') : '-';
};

const formatRetryable = value => {
  if (value === true) {
    return isZh ? '是' : 'true';
  }
  if (value === false) {
    return isZh ? '否' : 'false';
  }
  return '-';
};

const escapeCell = value =>
  String(value ?? '-')
    .replaceAll('|', '\\|')
    .replaceAll('\n', '<br>');

const summarizeScenes = entries => {
  const apiNames = unique(entries.filter(entry => entry.scope === 'api').map(entry => entry.section));
  const commonNames = unique(
    entries
      .filter(entry => entry.scope === 'common')
      .map(entry => (isZh ? `${entry.section} 通用错误` : `${entry.section} common error`))
  );
  const scenes = [...apiNames.slice(0, 6), ...commonNames.slice(0, 3)];
  const extraCount = apiNames.length + commonNames.length - scenes.length;
  if (extraCount > 0) {
    scenes.push(isZh ? `另 ${extraCount} 个场景` : `${extraCount} more scenarios`);
  }
  return scenes.length > 0 ? scenes.join('；') : '-';
};

const renderCanonicalSection = entries => {
  const lines = [
    isZh ? '## 公开错误码' : '## Public Error Codes',
    '',
    isZh
      ? '用户侧优先按 `SDKError.code` 判断错误；`details.serverCode` 和 `details.canonicalCode` 仅用于排障。'
      : 'Application code should primarily use `SDKError.code`; `details.serverCode` and `details.canonicalCode` are for troubleshooting.',
    '',
    isZh ? '| Code | 含义 | 常见场景 | 处理建议 |' : '| Code | Message | Common Scenarios | Action |',
    '| ---: | --- | --- | --- |',
  ];

  for (const [code, groupEntries] of groupByCanonicalCode(entries)) {
    const primary = groupEntries[0];
    lines.push(
      `| ${code} | ${escapeCell(primary.message)} | ${escapeCell(summarizeScenes(groupEntries))} | ${escapeCell(formatTextList(groupEntries.map(entry => entry.action)))} |`
    );
  }

  lines.push('');
  return lines;
};

const renderApiSection = apiErrors => {
  const lines = [
    isZh ? '## API 专属错误' : '## API-Specific Errors',
    '',
    isZh
      ? '本节按 API 分组列出服务端业务错误到公开 `SDKError.code` 的映射。'
      : 'This section lists server business error mappings to public `SDKError.code` by API.',
    '',
  ];

  for (const [apiName, definition] of Object.entries(apiErrors.apis)) {
    const localErrors = Object.entries(definition.localErrors ?? {}).flatMap(([methodName, entries]) =>
      Object.entries(entries).map(([key, entry]) => [`${methodName}.${key}`, entry])
    );
    const errors = [...localErrors, ...Object.entries(definition.errors)];
    if (errors.length === 0) {
      continue;
    }

    lines.push(`**${apiName}**`);
    lines.push('');
    const localizedDefinition = getLocalizedApiDefinition(localePack, apiName);
    lines.push(localizedDefinition.summary ?? definition.summary ?? (isZh ? 'API 错误映射。' : `${apiName} error mapping.`));
    lines.push('');
    lines.push(isZh ? '| Code | 含义 | HTTP | 处理建议 | 可重试 |' : '| Code | Message | HTTP | Action | Retryable |');
    lines.push('| ---: | --- | --- | --- | --- |');

    for (const [key, entry] of errors) {
      const keyText = String(key);
      const [methodName, localKey] = keyText.includes('.') ? keyText.split('.', 2) : [undefined, keyText];
      const localized = getLocalizedApiEntry(localePack, apiName, localKey, methodName);
      const http = entry.httpStatus ?? '-';
      const message = localized.message ?? entry.message;
      const action = localized.action ?? entry.action ?? '-';
      lines.push(
        `| ${entry.code} | ${escapeCell(message)} | ${escapeCell(http)} | ${escapeCell(action)} | ${formatRetryable(entry.retryable)} |`
      );
    }
    lines.push('');
  }

  return lines;
};

const apiErrors = await readApiErrors();
const localePack = await readErrorLocalePack(lang);
const entries = collectErrorEntries(apiErrors, localePack);
const lines = [
  isZh ? '# 错误码参考' : '# Error Code Reference',
  '',
  isZh
    ? '> 自动生成自 `src/rest/api-errors.json`，供 TypeDoc HTML API Reference 使用。'
    : '> Automatically generated from `src/rest/api-errors.json` for the TypeDoc HTML API Reference.',
  isZh
    ? '> 本页面只展示对外处理错误所需字段，内部匹配 key 与来源细节请查看 Markdown reference。'
    : '> This page only shows user-facing error handling fields. See the Markdown reference for internal matching keys and source details.',
  '',
  ...renderCanonicalSection(entries),
  ...renderApiSection(apiErrors),
];

const outputPath = outArg
  ? path.resolve(ROOT.pathname, outArg)
  : path.resolve(ROOT.pathname, 'docs/reference/typedoc-error-codes.md');
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${lines.join('\n').trimEnd()}\n`, 'utf8');
process.stdout.write(`Generated ${outputPath}\n`);
