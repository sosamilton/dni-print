import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles/tokens.css'
import './ui/styles/fonts.css'
import './index.css'
import { App } from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { startPipeline } from './ui/pipeline.ts'
import { updatePrompt } from './ui/update-prompt.ts'
import { themeStore } from './ui/theme.ts'

// public/theme-boot.js already applied the saved theme before the first paint; this keeps the store in sync.
themeStore.init()
startPipeline()
// Registers the SW (precache only). `prompt` mode: it never reloads the page by itself.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => updatePrompt.notify(() => updateSW(true)),
  onRegisterError: () => {},
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
