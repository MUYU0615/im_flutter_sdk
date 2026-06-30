import { defineConfig } from 'vite'; // 引入 Vite 配置方法
import type { PluginOption, UserConfig } from 'vite'; // 引入 Vite 配置类型
import { visualizer } from 'rollup-plugin-visualizer'; // 引入 bundle 体积可视化插件
import { resolve } from 'path'; // 引入路径解析工具

const MODULE_ENTRIES = { // 定义多入口映射
  index: resolve(__dirname, 'src/index.ts'), // 主入口
  'managers/chat/index': resolve(__dirname, 'src/managers/chat/index.ts'), // ChatManager 子路径入口
  'managers/chat-thread/index': resolve(__dirname, 'src/managers/chat-thread/index.ts'), // ChatThreadManager 子路径入口
  'managers/chatroom/index': resolve(__dirname, 'src/managers/chatroom/index.ts'), // ChatRoomManager 子路径入口
  'managers/contact/index': resolve(__dirname, 'src/managers/contact/index.ts'), // ContactManager 子路径入口
  'managers/group/index': resolve(__dirname, 'src/managers/group/index.ts'), // GroupManager 子路径入口
  'managers/presence/index': resolve(__dirname, 'src/managers/presence/index.ts'), // PresenceManager 子路径入口
  'managers/push/index': resolve(__dirname, 'src/managers/push/index.ts'), // PushManager 子路径入口
  'managers/user-info/index': resolve(__dirname, 'src/managers/user-info/index.ts'), // UserInfoManager 子路径入口
}; // 入口映射结束

const MODULE_EXTERNAL = ['zod']; // 定义模块构建的外部依赖

const MODULE_GLOBALS = { // 定义外部依赖的全局变量映射
  zod: 'zod', // zod 全局变量名
} as const; // 全局变量映射结束

const ALIAS_CONFIG = { // 定义路径别名
  '@': resolve(__dirname, './src'), // src 根路径别名
  '@protobufjs/inquire': resolve(__dirname, 'src/vendor/protobufjs/inquire-shim.cjs'), // 浏览器构建时禁用 Node require 探测
}; // 路径别名结束

const createAnalyzePlugins = (target: 'bundle' | 'modules'): PluginOption[] => { // 创建按需 bundle 分析插件
  if (process.env.ANALYZE_BUNDLE !== '1') { // 未开启分析时不影响常规构建
    return []; // 返回空插件列表
  }

  return [
    visualizer(outputOptions => ({
      filename: `stats/${target}-${outputOptions.format}-visualizer.html`,
      title: `im-sdk-web ${target} ${outputOptions.format} bundle analysis`,
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
      open: false,
    })),
    visualizer(outputOptions => ({
      filename: `stats/${target}-${outputOptions.format}-visualizer.json`,
      template: 'raw-data',
      gzipSize: true,
      brotliSize: true,
      open: false,
    })),
  ]; // 返回 HTML 与 raw data 两类报告
}; // 分析插件创建结束

export default defineConfig(({ mode }): UserConfig => { // 导出 Vite 配置
  const isBundleMode = mode === 'bundle'; // 判断是否为 bundle 构建模式

  if (isBundleMode) { // 处理 bundle 构建
    return { // 返回 bundle 构建配置
      plugins: createAnalyzePlugins('bundle'), // 按需启用 bundle 分析
      build: { // 构建配置
        outDir: 'dist/bundle', // 输出 bundle 目录
        lib: { // 库模式配置
          entry: resolve(__dirname, 'src/index.ts'), // bundle 单入口
          name: 'IMSDK', // IIFE 全局变量名称
          formats: ['iife'], // 输出 IIFE 格式
          fileName: () => 'im-sdk-web', // bundle 文件名
        }, // 库模式配置结束
        rollupOptions: { // Rollup 配置
          external: [], // bundle 模式不外置依赖
          output: { // 输出配置
            globals: MODULE_GLOBALS, // 保留全局变量映射（兼容性）
            inlineDynamicImports: true, // IIFE 必须内联动态导入
          }, // 输出配置结束
        }, // Rollup 配置结束
        sourcemap: false, // 关闭 sourcemap
        minify: 'terser', // 使用 terser 压缩
        terserOptions: { // terser 配置
          compress: { // 压缩选项
            drop_console: false, // 保留 console
            drop_debugger: true, // 移除 debugger
          }, // 压缩选项结束
        }, // terser 配置结束
      }, // 构建配置结束
      resolve: { // 解析配置
        alias: ALIAS_CONFIG, // 使用路径别名
      }, // 解析配置结束
    }; // 返回 bundle 配置结束
  } // bundle 模式结束

  return { // 返回默认构建配置
    plugins: createAnalyzePlugins('modules'), // 按需启用模块产物分析
    build: { // 构建配置
      lib: { // 库模式配置
        entry: MODULE_ENTRIES, // 多入口配置
        name: 'IMSDK', // 库名称
        formats: ['es', 'cjs'], // 输出 ESM 与 CJS
        fileName: (format, entryName): string => { // 输出文件命名规则
          return format === 'es' ? `${entryName}.js` : `${entryName}.cjs`; // 按格式生成文件名
        }, // 文件命名规则结束
      }, // 库模式配置结束
      rollupOptions: { // Rollup 配置
        external: MODULE_EXTERNAL, // 外部依赖列表
        output: [ // 多格式输出配置
          { // ESM 输出配置
            format: 'es', // ESM 格式
            preserveModules: true, // 保留模块边界
            preserveModulesRoot: 'src', // 保留模块根路径
            entryFileNames: '[name].js', // ESM 输出文件名
            chunkFileNames: 'chunks/[name]-[hash].js', // ESM chunk 命名
          }, // ESM 输出配置结束
          { // CJS 输出配置
            format: 'cjs', // CJS 格式
            exports: 'named', // 使用具名导出
            preserveModules: true, // 保留模块边界
            preserveModulesRoot: 'src', // 保留模块根路径
            entryFileNames: '[name].cjs', // CJS 输出文件名
            chunkFileNames: 'chunks/[name]-[hash].cjs', // CJS chunk 命名
          }, // CJS 输出配置结束
        ], // 多格式输出配置结束
      }, // Rollup 配置结束
      sourcemap: false, // 关闭 sourcemap
      minify: 'terser', // 使用 terser 压缩
      terserOptions: { // terser 配置
        compress: { // 压缩选项
          drop_console: false, // 保留 console
          drop_debugger: true, // 移除 debugger
        }, // 压缩选项结束
      }, // terser 配置结束
    }, // 构建配置结束
    resolve: { // 解析配置
      alias: ALIAS_CONFIG, // 使用路径别名
    }, // 解析配置结束
  }; // 返回默认配置结束
}); // 配置导出结束
