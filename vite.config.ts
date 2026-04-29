import { defineConfig } from 'vite';

export default defineConfig({
  // 注意这里：必须是你的仓库名，前后都要有斜杠
  base: '/Stronghold-Protocol/', 
  server: {
    port: 3000,
    open: true
  }
});