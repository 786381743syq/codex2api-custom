import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './i18n'
import './index.css'

const legacyPublicContributionPath = window.location.pathname === '/admin/contribute' || window.location.pathname === '/admin/contribute/'
if (legacyPublicContributionPath) {
  window.history.replaceState(null, '', '/contribute' + window.location.search + window.location.hash)
}

const rootElement = document.getElementById('root')
const routerBasename = window.location.pathname.startsWith('/admin') ? '/admin' : undefined

if (!rootElement) {
  throw new Error('未找到 root 节点')
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
