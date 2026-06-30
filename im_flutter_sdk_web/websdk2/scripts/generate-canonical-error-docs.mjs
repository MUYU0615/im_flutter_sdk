#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { collectErrorEntries, groupByCanonicalCode, readApiErrors } from './error-code-model.mjs';

const ROOT = new URL('..', import.meta.url);

const escapeCell = value =>
  String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', '<br>');

const unique = values => [...new Set(values.filter(value => value !== undefined && value !== ''))];

const joinInline = values =>
  unique(values)
    .map(value => `\`${value}\``)
    .join('<br>');

const joinText = values => unique(values).map(escapeCell).join('<br>') || '-';

const formatRetryable = values => {
  const normalized = unique(
    values.map(value => {
      if (value === true) {
        return '是';
      }
      if (value === false) {
        return '否';
      }
      return undefined;
    })
  );
  return normalized.length > 0 ? normalized.join('<br>') : '-';
};

const formatHttpStatus = values => {
  const statuses = unique(
    values.map(value => (typeof value === 'number' ? String(value) : undefined))
  );
  return statuses.length > 0 ? statuses.join('<br>') : '-';
};

const sourceLabel = entry =>
  entry.scope === 'common' ? `通用:${entry.section}` : `API:${entry.section}`;

const renderCanonicalDocs = entries => {
  const lines = [
    '# Web SDK2 公开错误码',
    '',
    '> 自动生成自 `src/rest/api-errors.json`。',
    '> 用户侧优先按 `SDKError.code` 判断错误；`details.serverCode` / `details.canonicalCode` 仅用于排障和兼容分析。',
    '',
    '## 设计口径',
    '',
    '- 成功结果不进入错误码体系；HTTP `2xx` 且业务解析成功时直接返回结果。',
    '- 表格按 canonical code 聚合；同一 code 下的多个 key 是来源或触发场景，不代表用户需要分别处理。',
    '- `serverCode` 可与公开 `code` 不同；用户处理逻辑应优先使用公开 `code`。',
    '- `0` 是成功态，不作为 Web SDK 公开错误码。',
    '',
    '## Canonical Code 表',
    '',
    '| Code | 公开含义 | 来源 Key | 典型来源 | HTTP | 可重试 | 处理建议 |',
    '| ---: | --- | --- | --- | --- | --- | --- |',
  ];

  for (const [code, groupEntries] of groupByCanonicalCode(entries)) {
    const primary = groupEntries[0];
    const keys = joinInline(groupEntries.map(entry => entry.key));
    const sources = joinText(groupEntries.map(sourceLabel));
    const http = formatHttpStatus(groupEntries.map(entry => entry.httpStatus));
    const retryable = formatRetryable(groupEntries.map(entry => entry.retryable));
    const action = joinText(groupEntries.map(entry => entry.action));
    lines.push(
      `| ${code} | ${escapeCell(primary.message)} | ${keys || '-'} | ${sources} | ${http} | ${retryable} | ${action} |`
    );
  }

  lines.push('');
  lines.push('## 维护要求');
  lines.push('');
  lines.push('- 修改 `src/rest/api-errors.json` 后必须重新生成本文档。');
  lines.push('- 新增公开错误码前，应确认是否真的需要新的用户处理建议。');
  lines.push('- 多个来源复用同一 code 时，应保持用户处理建议一致。');
  lines.push('');

  return lines.join('\n');
};

const apiErrors = await readApiErrors();
const content = renderCanonicalDocs(collectErrorEntries(apiErrors));
const outputPath = path.resolve(ROOT.pathname, 'docs/reference/error-codes.md');
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${content.trimEnd()}\n`, 'utf8');
process.stdout.write(`Generated ${outputPath}\n`);
