import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './ui/ErrorBoundary'
import './index.css'
import { fitToVisibleViewport } from './ui/viewport'
import { listenForInstall, registerServiceWorker } from './ui/install'

fitToVisibleViewport()
listenForInstall()
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
