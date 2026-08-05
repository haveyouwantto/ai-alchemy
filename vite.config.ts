import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 相对路径 base：适配 GitHub Pages 子路径部署（/haveyouwantto/ai-alchemy/）
  base: './',
  // 降低构建目标（ES2018 ≈ Chrome 64+/Safari 11.1+/Firefox 63+），兼容旧浏览器与内置 WebView
  build: {
    target: 'es2018',
  },
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})
