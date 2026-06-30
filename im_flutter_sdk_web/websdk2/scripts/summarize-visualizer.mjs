#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const formatBytes = bytes => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(2)} KiB`;
};

const addSize = (target, size) => {
  target.rendered += size.renderedLength ?? 0;
  target.gzip += size.gzipLength ?? 0;
  target.brotli += size.brotliLength ?? 0;
};

const createSize = () => ({ rendered: 0, gzip: 0, brotli: 0 });

const parseArgs = () => {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  if (fileIndex === -1 || !args[fileIndex + 1]) {
    throw new Error('Missing --file <stats raw-data json>');
  }

  return {
    file: resolve(repoRoot, args[fileIndex + 1]),
    limit: Number(args[args.indexOf('--limit') + 1] ?? 20),
  };
};

const groupTopLevel = id => {
  if (id.startsWith('/node_modules/')) {
    return 'node_modules';
  }
  if (!id.startsWith('/src/')) {
    return 'other';
  }
  const [, , segment] = id.split('/');
  return `src/${segment}`;
};

const managerName = id => {
  if (id === '/src/managers/chat-manager.ts' || id.startsWith('/src/managers/chat/')) {
    return 'ChatManager';
  }
  if (
    id === '/src/managers/chat-thread-manager.ts' ||
    id.startsWith('/src/managers/chat-thread/')
  ) {
    return 'ChatThreadManager';
  }
  if (id === '/src/managers/chatroom-manager.ts' || id.startsWith('/src/managers/chatroom/')) {
    return 'ChatRoomManager';
  }
  if (id === '/src/managers/contact-manager.ts' || id.startsWith('/src/managers/contact/')) {
    return 'ContactManager';
  }
  if (id === '/src/managers/group-manager.ts' || id.startsWith('/src/managers/group/')) {
    return 'GroupManager';
  }
  if (id === '/src/managers/presence-manager.ts') {
    return 'PresenceManager';
  }
  if (id === '/src/managers/push-manager.ts') {
    return 'PushManager';
  }
  if (id === '/src/managers/user-info-manager.ts' || id.startsWith('/src/managers/user-info/')) {
    return 'UserInfoManager';
  }
  return undefined;
};

const toRows = entries =>
  [...entries]
    .sort(([, left], [, right]) => right.rendered - left.rendered)
    .map(([name, size]) => ({
      name,
      rendered: formatBytes(size.rendered),
      gzip: formatBytes(size.gzip),
      brotli: formatBytes(size.brotli),
    }));

const printTable = (title, rows) => {
  console.log(`\n${title}`);
  console.table(rows);
};

const main = async () => {
  const { file, limit } = parseArgs();
  const data = JSON.parse(await readFile(file, 'utf8'));
  const topLevel = new Map();
  const managers = new Map();
  const modules = [];
  const total = createSize();

  for (const part of Object.values(data.nodeParts)) {
    const meta = data.nodeMetas[part.metaUid];
    if (!meta) {
      continue;
    }

    addSize(total, part);

    const topKey = groupTopLevel(meta.id);
    topLevel.set(topKey, topLevel.get(topKey) ?? createSize());
    addSize(topLevel.get(topKey), part);

    const managerKey = managerName(meta.id);
    if (managerKey) {
      managers.set(managerKey, managers.get(managerKey) ?? createSize());
      addSize(managers.get(managerKey), part);
    }

    modules.push([meta.id, {
      rendered: part.renderedLength ?? 0,
      gzip: part.gzipLength ?? 0,
      brotli: part.brotliLength ?? 0,
    }]);
  }

  console.log(`File: ${file}`);
  console.log(
    `Total: rendered ${formatBytes(total.rendered)}, gzip ${formatBytes(total.gzip)}, brotli ${formatBytes(total.brotli)}`
  );
  printTable('Top-level groups', toRows(topLevel.entries()));
  printTable('Managers', toRows(managers.entries()));
  printTable('Largest modules', toRows(modules).slice(0, limit));
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
