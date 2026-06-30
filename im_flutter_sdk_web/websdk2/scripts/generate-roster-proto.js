/**
 * 生成或校验 Roster 静态 protobuf 描述文件。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const SOURCE_FILE = resolve(process.cwd(), 'src/protocol/roster/proto-source.json');
const TARGET_FILE = resolve(process.cwd(), 'src/protocol/roster/proto.ts');
const CHECK_MODE = process.argv.includes('--check');

const renderProtoModule = schemaObject => {
  const schemaJson = JSON.stringify(schemaObject, null, 2);
  return `/**
 * 由 scripts/generate-roster-proto.js 自动生成，请勿手动修改。
 */

const proto = ${schemaJson};

export default proto;
export { proto };
`;
};

const sourceJsonText = readFileSync(SOURCE_FILE, 'utf8');
const sourceSchema = JSON.parse(sourceJsonText);
const expectedContent = renderProtoModule(sourceSchema);
const currentContent = readFileSync(TARGET_FILE, 'utf8');

if (CHECK_MODE) {
  if (currentContent !== expectedContent) {
    console.error('Roster 静态 protobuf 产物已过期，请先运行: npm run proto:gen');
    process.exit(1);
  }
  console.log('Roster 静态 protobuf 产物校验通过');
  process.exit(0);
}

if (currentContent === expectedContent) {
  console.log('Roster 静态 protobuf 产物无需更新');
  process.exit(0);
}

writeFileSync(TARGET_FILE, expectedContent, 'utf8');
console.log('已更新 Roster 静态 protobuf 产物: src/protocol/roster/proto.ts');
