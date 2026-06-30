import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_FILES = [
  'src/managers/push-manager.ts',
  'src/types/push.ts',
  'src/managers/presence-manager.ts',
  'src/types/presence.ts',
  'src/managers/chatroom-manager.ts',
  'src/managers/chatroom/chatroom.ts',
  'src/types/chatroom.ts',
  'src/managers/user-info-manager.ts',
  'src/types/user-info.ts',
].map(file => path.resolve(ROOT, file));

const readArgValue = name => {
  const index = process.argv.findIndex(arg => arg === name);
  if (index < 0 || index === process.argv.length - 1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
};

const filesArg = readArgValue('--files');
const files = filesArg
  ? filesArg
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(file => path.resolve(ROOT, file))
  : DEFAULT_FILES;

const program = ts.createProgram(files, {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  strict: true,
});

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

const hasBothLanguages = value => value.includes('[zh-CN]') && value.includes('[en-US]');

const checkMethodDoc = (method, sourceFile, failures) => {
  const methodName = method.name.getText(sourceFile);
  if (methodName === 'bind') {
    return;
  }
  const isInternal = raw => typeof raw === 'string' && raw.includes('@internal');

  const raw = getRawJsDoc(method, sourceFile);
  const prefix = `${path.relative(ROOT, sourceFile.fileName)}:${methodName}`;
  if (!raw) {
    failures.push(`${prefix} 缺少 JSDoc 注释`);
    return;
  }
  if (isInternal(raw)) {
    return;
  }

  if (!hasBothLanguages(raw)) {
    failures.push(`${prefix} 注释缺少 [zh-CN]/[en-US] 双语标记`);
  }

  if (!raw.includes('@example')) {
    failures.push(`${prefix} 缺少 @example`);
  }

  if (!raw.includes('@returns')) {
    failures.push(`${prefix} 缺少 @returns`);
  }

  for (const parameter of method.parameters) {
    const parameterName = parameter.name.getText(sourceFile);
    if (!raw.includes(`@param ${parameterName}`)) {
      failures.push(`${prefix} 缺少参数 ${parameterName} 的 @param 注释`);
    }
  }
};

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

const checkInterfaceDoc = (declaration, sourceFile, failures) => {
  const interfaceName = declaration.name.text;
  const interfaceDoc = getRawJsDoc(declaration, sourceFile);
  const prefix = `${path.relative(ROOT, sourceFile.fileName)}:${interfaceName}`;

  if (typeof interfaceDoc === 'string' && interfaceDoc.includes('@internal')) {
    return;
  }

  if (!interfaceDoc) {
    failures.push(`${prefix} 缺少接口 JSDoc 注释`);
  } else if (!hasBothLanguages(interfaceDoc)) {
    failures.push(`${prefix} 接口注释缺少 [zh-CN]/[en-US] 双语标记`);
  }

  for (const member of declaration.members) {
    if (!ts.isPropertySignature(member) || !member.name) {
      continue;
    }
    const propertyName = member.name.getText(sourceFile);
    const propertyDoc = getRawJsDoc(member, sourceFile);
    const propertyPrefix = `${prefix}.${propertyName}`;
    if (!propertyDoc) {
      failures.push(`${propertyPrefix} 缺少字段注释`);
      continue;
    }
    if (!hasBothLanguages(propertyDoc)) {
      failures.push(`${propertyPrefix} 字段注释缺少 [zh-CN]/[en-US] 双语标记`);
    }
  }
};

const failures = [];

for (const sourceFile of program.getSourceFiles()) {
  if (!files.includes(sourceFile.fileName)) {
    continue;
  }

  for (const statement of sourceFile.statements) {
    if (ts.isClassDeclaration(statement) && statement.name && isExported(statement)) {
      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member) || !member.name || !isPublicMethod(member)) {
          continue;
        }
        checkMethodDoc(member, sourceFile, failures);
      }
    }

    if (ts.isInterfaceDeclaration(statement) && isExported(statement)) {
      checkInterfaceDoc(statement, sourceFile, failures);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write('[API Doc Check] 发现以下问题：\n');
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write('[API Doc Check] 通过\n');
