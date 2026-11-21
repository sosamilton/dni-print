import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles/tokens.css'
import './ui/styles/fonts.css'
import './index.css'
import { App } from './App.tsx'
import { startPipeline } from './ui/pipeline.ts'

startPipeline()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
