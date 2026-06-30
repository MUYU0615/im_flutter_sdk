import path from 'node:path'; // 路径工具
import { defineConfig } from 'vite'; // 引入 Vite 配置工具
import react from '@vitejs/plugin-react'; // 引入 React 插件

export const viteConfig = defineConfig({ // 定义 Vite 配置
  envPrefix: ['VITE_', 'EASEMOB_'], // 允许注入自定义前缀
  resolve: { // 模块解析配置
    alias: { // 别名映射
      'im-sdk-web': path.resolve(__dirname, '../src/index.ts'), // 直接引用 SDK 源码
    }, // 别名映射结束
  }, // 模块解析配置结束
  server: { // 开发服务器配置
    port: 3000, // 端口号
    open: true, // 启动时自动打开浏览器
  }, // 开发服务器配置结束
  optimizeDeps: { // 依赖预构建配置
    exclude: ['im-sdk-web'], // 排除 SDK 以支持源码别名/本地链接
  }, // 依赖预构建配置结束
  build: { // 构建配置
    sourcemap: true, // 生成 sourcemap 便于调试
  }, // 构建配置结束
  plugins: [
    react(),
    {
      name: 'demo-dns-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next): Promise<void> => {
          const requestUrl = req.url ?? '';
          const parsedUrl = new URL(requestUrl, 'http://localhost');
          if (parsedUrl.pathname !== '/dns-proxy') {
            next();
            return;
          }

          const targetUrl = parsedUrl.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Missing dns proxy target url' }));
            return;
          }

          try {
            const upstream = await fetch(targetUrl);
            res.statusCode = upstream.status;
            const contentType = upstream.headers.get('content-type');
            if (contentType) {
              res.setHeader('content-type', contentType);
            }
            const cacheControl = upstream.headers.get('cache-control');
            if (cacheControl) {
              res.setHeader('cache-control', cacheControl);
            }
            const payload = Buffer.from(await upstream.arrayBuffer());
            res.end(payload);
          } catch (error) {
            res.statusCode = 502;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              })
            );
          }
        });
      },
    },
  ],
}); // 配置结束

export default viteConfig; // Vite 需要默认导出配置
