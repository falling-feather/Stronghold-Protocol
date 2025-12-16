import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 关键：相对路径，确保在 GitHub Pages 正常运行
  server: {
    port: 3000,
    open: true
  }
});