import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 相对路径 base：适配 GitHub Pages 子路径部署（/haveyouwantto/ai-alchemy/）
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})