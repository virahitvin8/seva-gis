import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import ReactDOM, { type Root } from 'react-dom/client'
import App from './App'
import AuthGate from './Auth'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false }

  public static getDerivedStateFromError(error: Error): State {
    // Suppress external Google Translate removeChild errors
    if (error?.message && /removeChild|not a child/i.test(error.message)) {
      return { hasError: false }
    }
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Caught transient render boundary notice:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, textAlign: 'center', background: '#06100c', color: '#cfe3d3', minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div>
            <h2 style={{ color: '#38f2d0', marginBottom: 12 }}>SEVA·GIS needs to reload</h2>
            <p style={{ color: '#94a3b8', maxWidth: 460, margin: '0 auto 20px' }}>
              A screen error interrupted this session. Reload the app to continue. Farm records are stored in this browser when storage is available.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Keep a single React root when the Figma/Vite preview re-evaluates this entry
// module during hot reload. Calling createRoot twice on #root emits a runtime
// error and can leave the preview in a broken state.
const rootHost = window as Window & { __sevaReactRoot?: Root }
const root = rootHost.__sevaReactRoot ??= ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <AuthGate><App /></AuthGate>
    </GlobalErrorBoundary>
  </React.StrictMode>,
)
