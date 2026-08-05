import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// 自托管字体：serif 标题用 Noto Serif SC（思源宋体），炼金术笔记用霞鹜文楷
import '@fontsource/noto-serif-sc/chinese-simplified-400.css'
import '@fontsource/noto-serif-sc/chinese-simplified-500.css'
import '@fontsource/noto-serif-sc/chinese-simplified-700.css'
import '@fontsource/noto-serif-sc/latin-400.css'
import '@fontsource/noto-serif-sc/latin-500.css'
import '@fontsource/noto-serif-sc/latin-700.css'
import 'lxgw-wenkai-webfont/lxgwwenkai-regular.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
