import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AuthGate from './Auth'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate><App /></AuthGate>
  </React.StrictMode>,
)
