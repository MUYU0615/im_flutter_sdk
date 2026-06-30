import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {Object} ApiErrorEntry
 * @property {number} code
 * @property {string} message
 * @property {boolean} [retryable]
 * @property {number} [httpStatus]
 * @property {boolean} [provisional]
 * @property {string} [reason]
 * @property {string} [action]
 * @property {number} [canonicalCode]
 * @property {string[]} [aliases]
 */

/**
 * @typedef {Object} CommonErrorSection
 * @property {string} range
 * @property {Record<string, ApiErrorEntry>} errors
 */

/**
 * @typedef {Object} ApiErrorSection
 * @property {string} summary
 * @property {string} range
 * @property {Record<string, ApiErrorEntry>} errors
 */

/**
 * @typedef {Object} ApiErrors
 * @property {Record<string, CommonErrorSection>} common
 * @property {Record<string, ApiErrorSection>} apis
 */

const ROOT = new URL('..', import.meta.url);

/**
 * @param {string} value
 */
const toTitle = value => value.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

/**
 * @param {ApiErrorEntry} entry
 */
const formatProvisional = entry => (entry.provisional ? 'PROVISIONAL' : '');
const formatRetryable = entry =>
  typeof entry.retryable === 'boolean' ? (entry.retryable ? 'Yes' : 'No') : '';
const formatHttpStatus = entry =>
  typeof entry.httpStatus === 'number' ? String(entry.httpStatus) : '';

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * @param {unknown} value
 * @returns {value is ApiErrorEntry}
 */
const isApiErrorEntry = value => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.code !== 'number' || typeof value.message !== 'string') {
    return false;
  }
  if ('retryable' in value && typeof value.retryable !== 'boolean') {
    return false;
  }
  if ('httpStatus' in value && typeof value.httpStatus !== 'number') {
    return false;
  }
  if ('provisional' in value && typeof value.provisional !== 'boolean') {
    return false;
  }
  if ('reason' in value && typeof value.reason !== 'string') {
    return false;
  }
  if ('action' in value && typeof value.action !== 'string') {
    return false;
  }
  if ('canonicalCode' in value && typeof value.canonicalCode !== 'number') {
    return false;
  }
  if (
    'aliases' in value &&
    (!Array.isArray(value.aliases) || value.aliases.some(item => typeof item !== 'string'))
  ) {
    return false;
  }
  return true;
};

/**
 * @param {unknown} value
 * @returns {value is Record<string, ApiErrorEntry>}
 */
const isApiErrorEntryMap = value => {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every(entry => isApiErrorEntry(entry));
};

/**
 * @param {unknown} value
 * @returns {value is CommonErrorSection}
 */
const isCommonErrorSection = value => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.range !== 'string') {
    return false;
  }
  return isApiErrorEntryMap(value.errors);
};

/**
 * @param {unknown} value
 * @returns {value is ApiErrorSection}
 */
const isApiErrorSection = value => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.range !== 'string') {
    return false;
  }
  if ('summary' in value && typeof value.summary !== 'string') {
    return false;
  }
  return isApiErrorEntryMap(value.errors);
};

/**
 * @param {unknown} value
 * @returns {value is ApiErrors}
 */
const isApiErrors = value => {
  if (!isRecord(value)) {
    return false;
  }
  if (!isRecord(value.common) || !isRecord(value.apis)) {
    return false;
  }
  const commonValues = Object.values(value.common);
  const apiValues = Object.values(value.apis);
  return (
    commonValues.every(entry => isCommonErrorSection(entry)) &&
    apiValues.every(entry => isApiErrorSection(entry))
  );
};

/**
 * @param {ApiErrors} data
 */
export const renderErrorsMarkdown = data => {
  const lines = ['# API 错误码说明', '', '## 公共错误', ''];

  const commonKeys = Object.keys(data.common).sort();
  for (const key of commonKeys) {
    /** @type {CommonErrorSection} */
    const section = data.common[key];
    lines.push(`### ${toTitle(key)} (${section.range})`, '');
    lines.push('| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    /** @type {Array<[string, ApiErrorEntry]>} */
    const entries = Object.entries(section.errors).sort((a, b) => a[1].code - b[1].code);
    for (const [errorKey, entry] of entries) {
      lines.push(
        `| ${entry.code} | ${errorKey} | ${entry.message} | ${formatHttpStatus(entry)} | ${formatRetryable(entry)} | ${entry.reason ?? ''} | ${entry.action ?? ''} | ${formatProvisional(entry)} |`
      );
    }
    lines.push('');
  }

  lines.push('## API 业务错误', '');
  const apiKeys = Object.keys(data.apis).sort();
  for (const apiName of apiKeys) {
    /** @type {ApiErrorSection} */
    const api = data.apis[apiName];
    lines.push(`### ${apiName} (${api.range})`);
    if (api.summary) {
      lines.push('', `- ${api.summary}`, '');
    } else {
      lines.push('');
    }
    lines.push('| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    /** @type {Array<[string, ApiErrorEntry]>} */
    const entries = Object.entries(api.errors).sort((a, b) => a[1].code - b[1].code);
    for (const [errorKey, entry] of entries) {
      lines.push(
        `| ${entry.code} | ${errorKey} | ${entry.message} | ${formatHttpStatus(entry)} | ${formatRetryable(entry)} | ${entry.reason ?? ''} | ${entry.action ?? ''} | ${formatProvisional(entry)} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
};

const dataPath = new URL('../src/rest/api-errors.json', import.meta.url);
const raw = await fs.readFile(dataPath, 'utf8');
const parsed = /** @type {unknown} */ (JSON.parse(raw));
if (!isApiErrors(parsed)) {
  throw new Error('Invalid api-errors.json structure');
}
const apiErrors = parsed;

const outputPath = path.resolve(ROOT.pathname, 'docs', 'reference', 'errors.md');
const content = renderErrorsMarkdown(apiErrors);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${content}\n`, 'utf8');
process.stdout.write(`Generated ${outputPath}\n`);
