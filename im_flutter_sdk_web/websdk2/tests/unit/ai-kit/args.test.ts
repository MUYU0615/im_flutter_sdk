// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildHelpText,
  parseCliArgs,
} from '../../../packages/websdk2-ai-kit/src/shared/args.js';

describe('ai-kit args', () => {
  it('应解析 init 参数', () => {
    expect(
      parseCliArgs(['init', '--tool', 'cursor', '--cwd', '/tmp/project', '--dry-run'])
    ).toEqual({
      name: 'init',
      initOptions: {
        tool: 'cursor',
        cwd: '/tmp/project',
        dryRun: true,
        force: false,
      },
    });
  });

  it('应解析 update 参数', () => {
    expect(parseCliArgs(['update', '--tool', 'codex', '--cwd', '/tmp/project'])).toEqual({
      name: 'update',
      updateOptions: {
        tool: 'codex',
        cwd: '/tmp/project',
        dryRun: false,
      },
    });
  });

  it('应解析 remove 参数', () => {
    expect(parseCliArgs(['remove', '--tool', 'agent', '--dry-run'])).toEqual({
      name: 'remove',
      removeOptions: {
        tool: 'agent',
        cwd: undefined,
        dryRun: true,
      },
    });
  });

  it('未知命令应抛错', () => {
    expect(() => parseCliArgs(['nope'])).toThrow('未知命令');
  });

  it('帮助文本应包含 init update remove doctor', () => {
    const helpText = buildHelpText();
    expect(helpText).toContain('init');
    expect(helpText).toContain('update');
    expect(helpText).toContain('remove');
    expect(helpText).toContain('doctor');
  });
});
