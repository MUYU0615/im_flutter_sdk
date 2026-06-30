import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const isCoverageRun =
  process.argv.includes('--coverage') || process.env.npm_lifecycle_event === 'test:coverage';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**'],
    fileParallelism: !isCoverageRun,
    coverage: {
      all: true,
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        // 类型定义与纯导出文件（不承载业务逻辑）
        'src/types/**',
        'src/cache/cache-types.ts',
        'src/upload/types.ts',
        'src/protocol/protobuf/types.ts',
        'src/index.ts',
        'src/cache/index.ts',
        'src/platform/index.ts',
        'src/upload/index.ts',
        'src/managers/channel/index.ts',
        'src/managers/presence/index.ts',
        'src/managers/push/index.ts',
        'src/managers/user-info/index.ts',
      ],
      thresholds: {
        // ToB SDK 稳定商业级门禁
        statements: 85,
        branches: 75,
        functions: 90,
        lines: 85,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
