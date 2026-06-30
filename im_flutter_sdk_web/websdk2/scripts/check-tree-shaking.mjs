#!/usr/bin/env node

import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import * as esbuild from 'esbuild';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const scenarioConfig = {
  'core-only': {
    entry: 'tests/fixtures/tree-shaking/core-only.ts',
    forbidden: [
      'src/managers/chat-manager.ts',
      'src/managers/chat-thread-manager.ts',
      'src/managers/chatroom-manager.ts',
      'src/managers/contact-manager.ts',
      'src/managers/group-manager.ts',
      'src/managers/presence-manager.ts',
      'src/managers/push-manager.ts',
      'src/managers/user-info-manager.ts',
      'src/rest/error-maps/chat.ts',
      'src/rest/error-maps/chatroom.ts',
      'src/rest/error-maps/contact.ts',
      'src/rest/error-maps/group.ts',
      'src/rest/error-maps/presence.ts',
      'src/rest/error-maps/push.ts',
      'src/rest/error-maps/thread.ts',
      'src/rest/error-maps/user-info.ts',
      'src/rest/chatroom-management.ts',
      'src/rest/group-management.ts',
      'src/core/contact-sync/roster-sync-controller.ts',
      'src/core/group-sync/group-sync-controller.ts',
    ],
  },
  'core-chat': {
    entry: 'tests/fixtures/tree-shaking/core-chat.ts',
    forbidden: [
      'src/managers/chat-thread-manager.ts',
      'src/managers/chatroom-manager.ts',
      'src/managers/contact-manager.ts',
      'src/managers/group-manager.ts',
      'src/managers/presence-manager.ts',
      'src/managers/push-manager.ts',
      'src/managers/user-info-manager.ts',
      'src/rest/error-maps/chatroom.ts',
      'src/rest/error-maps/contact.ts',
      'src/rest/error-maps/group.ts',
      'src/rest/error-maps/presence.ts',
      'src/rest/error-maps/push.ts',
      'src/rest/error-maps/thread.ts',
      'src/rest/error-maps/user-info.ts',
      'src/rest/chatroom-management.ts',
      'src/rest/group-management.ts',
      'src/core/contact-sync/roster-sync-controller.ts',
      'src/core/group-sync/group-sync-controller.ts',
    ],
  },
  'core-group': {
    entry: 'tests/fixtures/tree-shaking/core-group.ts',
    forbidden: [
      'src/managers/chat-manager.ts',
      'src/managers/chat-thread-manager.ts',
      'src/managers/chatroom-manager.ts',
      'src/managers/contact-manager.ts',
      'src/managers/presence-manager.ts',
      'src/managers/push-manager.ts',
      'src/rest/error-maps/chat.ts',
      'src/rest/error-maps/chatroom.ts',
      'src/rest/error-maps/contact.ts',
      'src/rest/error-maps/presence.ts',
      'src/rest/error-maps/push.ts',
      'src/rest/error-maps/thread.ts',
      'src/rest/error-maps/user-info.ts',
      'src/rest/chatroom-management.ts',
      'src/core/contact-sync/roster-sync-controller.ts',
    ],
  },
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const scenarioIndex = args.indexOf('--scenario');
  const json = args.includes('--json');
  if (scenarioIndex === -1 || !args[scenarioIndex + 1]) {
    throw new Error(
      `Missing --scenario. Available scenarios: ${Object.keys(scenarioConfig).join(', ')}`
    );
  }
  const scenario = args[scenarioIndex + 1];
  const config = scenarioConfig[scenario];
  if (!config) {
    throw new Error(`Unknown scenario "${scenario}"`);
  }
  return { scenario, config, json };
};

const normalizeInputPath = input => {
  const absolute = resolve(repoRoot, input);
  return relative(repoRoot, absolute).replaceAll('\\', '/');
};

const main = async () => {
  const { scenario, config, json } = parseArgs();
  const result = await esbuild.build({
    absWorkingDir: repoRoot,
    entryPoints: [resolve(repoRoot, config.entry)],
    bundle: true,
    minify: true,
    treeShaking: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    metafile: true,
    external: ['zod'],
    logLevel: 'silent',
  });

  const inputs = Object.keys(result.metafile.inputs).map(normalizeInputPath).sort();

  // Collect modules that are only reached via dynamic import (not statically bundled)
  const dynamicOnlyModules = new Set();
  for (const [path, info] of Object.entries(result.metafile.inputs)) {
    const importers = Object.entries(result.metafile.inputs).filter(([, v]) =>
      v.imports.some(i => i.path === path)
    );
    const allDynamic = importers.length > 0 && importers.every(([, v]) =>
      v.imports.filter(i => i.path === path).every(i => i.kind === 'dynamic-import')
    );
    if (allDynamic) {
      dynamicOnlyModules.add(normalizeInputPath(path));
    }
  }

  // Also mark transitive-only deps of dynamic-only modules
  const collectTransitiveDeps = (modulePath) => {
    const info = result.metafile.inputs[modulePath];
    if (!info) return;
    for (const imp of info.imports) {
      const normalized = normalizeInputPath(imp.path);
      if (dynamicOnlyModules.has(normalized)) continue;
      // Check if this dep is ONLY imported by dynamic-only modules
      const allImportersAreDynamic = Object.entries(result.metafile.inputs)
        .filter(([, v]) => v.imports.some(i => i.path === imp.path))
        .every(([k]) => dynamicOnlyModules.has(normalizeInputPath(k)));
      if (allImportersAreDynamic) {
        dynamicOnlyModules.add(normalized);
        collectTransitiveDeps(imp.path);
      }
    }
  };
  for (const mod of [...dynamicOnlyModules]) {
    const original = Object.keys(result.metafile.inputs).find(k => normalizeInputPath(k) === mod);
    if (original) collectTransitiveDeps(original);
  }

  const staticInputs = inputs.filter(i => !dynamicOnlyModules.has(i));
  const outputBytes = result.outputFiles.reduce((total, file) => total + file.contents.length, 0);
  const forbiddenMatches = config.forbidden.filter(pattern =>
    staticInputs.some(input => input === pattern || input.endsWith(`/${pattern}`))
  );
  const report = {
    scenario,
    entry: config.entry,
    outputBytes,
    inputCount: inputs.length,
    staticInputCount: staticInputs.length,
    dynamicOnlyCount: dynamicOnlyModules.size,
    forbiddenMatches,
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Scenario: ${scenario}`);
    console.log(`Entry: ${config.entry}`);
    console.log(`Output bytes: ${outputBytes}`);
    console.log(`Input modules: ${inputs.length} (static: ${staticInputs.length}, dynamic-only: ${dynamicOnlyModules.size})`);
    if (forbiddenMatches.length > 0) {
      console.error(`Forbidden modules: ${forbiddenMatches.join(', ')}`);
    }
  }

  if (forbiddenMatches.length > 0) {
    process.exitCode = 1;
  }
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
