import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AvisoAtualizacao } from './ui/AvisoAtualizacao'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AvisoAtualizacao />
  </StrictMode>,
)
