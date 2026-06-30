#!/usr/bin/env node
/**
 * 从 api-errors.json 生成 API 错误码参考文档
 * 用法: node scripts/generate-api-error-docs.mjs [--filter chatroom|group|all]
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  getLocalizedApiDefinition,
  getLocalizedApiEntry,
  getLocalizedCommonEntry,
  readErrorLocalePack,
} from './error-message-locale.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const json = JSON.parse(readFileSync(resolve(root, 'src/rest/api-errors.json'), 'utf-8'));

const filter = process.argv.includes('--filter')
  ? process.argv[process.argv.indexOf('--filter') + 1]
  : 'all';
const lang = process.argv.includes('--lang')
  ? process.argv[process.argv.indexOf('--lang') + 1]
  : 'zh-CN';
const localePack = await readErrorLocalePack(lang);
const isZh = lang === 'zh-CN';

const lines = [];
lines.push(isZh ? '# API 错误码参考' : '# API Error Code Reference');
lines.push('');
lines.push('> 自动生成自 `src/rest/api-errors.json`，请勿手动编辑。');
lines.push(isZh ? `> 生成时间：${new Date().toISOString().slice(0, 10)}` : `> Generated: ${new Date().toISOString().slice(0, 10)}`);
lines.push('');

// common errors
lines.push(isZh ? '## 通用错误码' : '## Common Error Codes');
lines.push('');
lines.push(
  isZh
    ? '以下错误码可能出现在任意 API 中（网络超时、鉴权失败等）。'
    : 'The following error codes may appear in any API, such as network timeout or authentication failure.'
);
lines.push('');
lines.push(isZh ? '| 分类 | 错误码 | 数值 | 说明 |' : '| Category | Key | Code | Message |');
lines.push('|---|---|---|---|');
for (const [category, def] of Object.entries(json.common)) {
  for (const [key, entry] of Object.entries(def.errors)) {
    const localized = getLocalizedCommonEntry(localePack, category, key);
    lines.push(`| ${category} | \`${key}\` | ${entry.code} | ${localized.message ?? entry.message} |`);
  }
}
lines.push('');

// api errors
lines.push('---');
lines.push('');
lines.push(isZh ? '## API 专属错误码' : '## API-Specific Error Codes');
lines.push('');

const shouldInclude = (name) => {
  if (filter === 'all') return true;
  if (filter === 'chatroom') return /[Cc]hat[Rr]oom|[Cc]hatroom/.test(name);
  if (filter === 'group') return /[Gg]roup/.test(name);
  return true;
};

for (const [apiName, def] of Object.entries(json.apis)) {
  if (!shouldInclude(apiName)) continue;
  const localErrors = Object.entries(def.localErrors ?? {}).flatMap(([methodName, entries]) =>
    Object.entries(entries).map(([key, entry]) => [`${methodName}.${key}`, entry])
  );
  const errors = [...localErrors, ...Object.entries(def.errors)];
  if (errors.length === 0) {
    continue;
  }

  lines.push(`### ${apiName}`);
  lines.push('');
  const localizedDefinition = getLocalizedApiDefinition(localePack, apiName);
  lines.push(`> ${localizedDefinition.summary ?? def.summary}`);
  lines.push('');
  lines.push(
    isZh
      ? '| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |'
      : '| Key | Code | HTTP | Message | Reason | Action | Retryable |'
  );
  lines.push('|---|---|---|---|---|---|---|');

  for (const [key, entry] of errors) {
    const keyText = String(key);
    const [methodName, localKey] = keyText.includes('.') ? keyText.split('.', 2) : [undefined, keyText];
    const localized = getLocalizedApiEntry(localePack, apiName, localKey, methodName);
    const http = entry.httpStatus ?? '—';
    const message = localized.message ?? entry.message;
    const reason = localized.reason ?? entry.reason ?? '—';
    const action = localized.action ?? entry.action ?? '—';
    const retryable =
      entry.retryable === true
        ? isZh
          ? '是'
          : 'true'
        : entry.retryable === false
          ? isZh
            ? '否'
            : 'false'
          : '—';

    let extra = '';
    if (entry.matchField && entry.matchValue !== undefined) {
      extra = ` (${entry.matchField}=${entry.matchValue})`;
    } else if (entry.matchField && entry.matchPattern) {
      extra = ` (${entry.matchField}⊃"${entry.matchPattern}")`;
    }

    lines.push(
      `| \`${key}\` | ${entry.code} | ${http} | ${message}${extra} | ${reason} | ${action} | ${retryable} |`
    );
  }
  lines.push('');
}

const output = resolve(root, 'docs/reference/api-error-reference.md');
writeFileSync(output, `${lines.join('\n').trimEnd()}\n`, 'utf-8');
console.log(`已生成: ${output}`);
console.log(`共 ${Object.keys(json.apis).filter(shouldInclude).filter(n => Object.keys(json.apis[n].errors).length > 0).length} 个 API`);
