import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles/tokens.css'
import './ui/styles/fonts.css'
import './index.css'
import { App } from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { startPipeline } from './ui/pipeline.ts'

startPipeline()
// Registers the SW (precache only). `prompt` mode: it never reloads the page by itself.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
