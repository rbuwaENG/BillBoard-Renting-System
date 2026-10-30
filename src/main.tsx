import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app'
import { ConfigErrorScreen } from '@/app/ConfigErrorScreen'
import { envCheck } from '@/lib/env'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {envCheck.ok ? <App /> : <ConfigErrorScreen problems={envCheck.problems} />}
  </StrictMode>,
)
