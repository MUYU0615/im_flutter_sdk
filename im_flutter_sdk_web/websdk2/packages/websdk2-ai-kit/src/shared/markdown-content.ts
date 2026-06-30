import { readdirSync, readFileSync } from 'node:fs';
import { join as joinPath, relative as relativePath, resolve as resolvePath, sep } from 'node:path';
import type { ReferenceDocument, SkillDefinition } from '../knowledge/types.js';
import { resolvePackageRoot } from './package-meta.js';

interface ParsedMarkdownDocument {
  readonly attributes: ReadonlyMap<string, string | ReadonlyArray<string>>;
  readonly body: string;
}

const parseFrontmatter = (raw: string, filePath: string): ParsedMarkdownDocument => {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`Markdown 文档缺少合法 frontmatter: ${filePath}`);
  }

  const frontmatterBlock = match[1] ?? '';
  const markdownBody = match[2] ?? '';
  const attributes = new Map<string, string | ReadonlyArray<string>>();
  const lines = frontmatterBlock.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) {
      continue;
    }
    if (line.trim() === '') {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      throw new Error(`frontmatter 行格式非法: ${filePath} -> ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (value !== '') {
      attributes.set(key, value);
      continue;
    }

    const items: string[] = [];
    while (index + 1 < lines.length) {
      const nextLine = lines[index + 1];
      if (nextLine === undefined) {
        break;
      }
      const itemMatch = nextLine.match(/^\s*-\s+(.*)$/);
      if (!itemMatch) {
        break;
      }
      const item = itemMatch[1];
      if (item === undefined) {
        break;
      }
      items.push(item.trim());
      index += 1;
    }
    attributes.set(key, items);
  }

  return {
    attributes,
    body: markdownBody.trimEnd(),
  };
};

const expectString = (
  attributes: ReadonlyMap<string, string | ReadonlyArray<string>>,
  key: string,
  filePath: string
): string => {
  const value = attributes.get(key);
  if (typeof value !== 'string' || value === '') {
    throw new Error(`frontmatter 缺少字符串字段 ${key}: ${filePath}`);
  }
  return value;
};

const readOptionalStringArray = (
  attributes: ReadonlyMap<string, string | ReadonlyArray<string>>,
  key: string
): ReadonlyArray<string> => {
  const value = attributes.get(key);
  if (!value) {
    return [];
  }
  if (typeof value === 'string') {
    return value === '' ? [] : [value];
  }
  return value;
};

const readMarkdownDocument = (relativePath: string): ParsedMarkdownDocument => {
  const absolutePath = resolvePath(resolvePackageRoot(), 'src', relativePath);
  return parseFrontmatter(readFileSync(absolutePath, 'utf8'), absolutePath);
};

const listMarkdownFiles = (relativeDirectory: string): ReadonlyArray<string> => {
  const root = resolvePath(resolvePackageRoot(), 'src', relativeDirectory);
  const files: string[] = [];

  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = resolvePath(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }
      files.push(relativePath(root, absolutePath).split(sep).join('/'));
    }
  };

  visit(root);
  return files.sort((left, right) => left.localeCompare(right));
};

export const loadSkillDocument = (fileName: string): SkillDefinition => {
  const document = readMarkdownDocument(joinPath('knowledge', fileName));
  return {
    id: expectString(document.attributes, 'id', fileName),
    name: expectString(document.attributes, 'name', fileName),
    title: expectString(document.attributes, 'title', fileName),
    description: expectString(document.attributes, 'description', fileName),
    cursorGlobs: expectString(document.attributes, 'cursorGlobs', fileName),
    referenceIds: readOptionalStringArray(document.attributes, 'referenceIds'),
    body: document.body,
  };
};

export const loadReferenceDocument = (fileName: string): ReferenceDocument => {
  const document = readMarkdownDocument(joinPath('references', fileName));
  return {
    id: expectString(document.attributes, 'id', fileName),
    title: expectString(document.attributes, 'title', fileName),
    description: expectString(document.attributes, 'description', fileName),
    body: document.body,
  };
};

export const listReferenceMarkdownFiles = (): ReadonlyArray<string> => {
  return listMarkdownFiles('references');
};
