import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import ReactDOM, { type Root } from 'react-dom/client'
import App from './App'
import AuthGate from './Auth'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'

import PopTheTeamModal from './PopTheTeamModal'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  showPopModal?: boolean
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, showPopModal: false }

  public static getDerivedStateFromError(error: Error): State {
    // Suppress external Google Translate removeChild errors and mobile ResizeObserver loop noise
    if (error?.message && /removeChild|not a child|ResizeObserver loop|ResizeObserver loop limit exceeded/i.test(error.message)) {
      return { hasError: false }
    }
    return { hasError: true, error, showPopModal: false }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Caught transient render boundary notice:', error, errorInfo)
  }

  private handleResetLayout = () => {
    try {
      localStorage.removeItem('seva-dashboard-layout')
      localStorage.removeItem('seva-report-opts')
      sessionStorage.clear()
    } catch {}
    window.location.reload()
  }

  private handleResetAll = () => {
    if (window.confirm('Reset all browser storage and reload SEVA·GIS with fresh defaults?')) {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {}
      window.location.reload()
    }
  }

  public render() {
    if (this.state.hasError) {
      const errMessage = this.state.error?.message || 'A render exception occurred'
      return (
        <div style={{ padding: 24, textAlign: 'center', background: '#06100c', color: '#cfe3d3', minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 500, width: '100%', margin: '0 auto', background: '#0c1b14', border: '1.5px solid #193829', borderRadius: 18, padding: '32px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ width: 50, height: 50, margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(56, 242, 208, 0.12)', color: '#38f2d0', display: 'grid', placeItems: 'center', fontSize: 24 }}>
              🌱
            </div>
            <h2 style={{ color: '#38f2d0', fontSize: 21, fontWeight: 700, margin: '0 0 10px' }}>SEVA·GIS needs to reload</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, margin: '0 0 22px' }}>
              A screen error interrupted this session. You can reload or notify our engineers automatically via bot Gmail & EmailOctopus.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <button
                onClick={() => this.setState({ showPopModal: true })}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '13px 20px',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14.5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)',
                }}
              >
                🚀 Let SEVA Team Know: Pop the Team
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{ background: '#132c20', color: '#86efac', border: '1px solid #23543b', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Reload app
              </button>
              <button
                onClick={this.handleResetLayout}
                style={{ background: '#0d1d16', color: '#94a3b8', border: '1px solid #1a392b', padding: '10px 18px', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                title="Resets dashboard layout and section cache while preserving your saved farms"
              >
                Reset layout & reload
              </button>
              <button
                onClick={this.handleResetAll}
                style={{ background: 'transparent', color: '#f87171', border: 'none', padding: '6px 12px', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Troubleshoot: Clear all local cache
              </button>
            </div>
            <details style={{ marginTop: 20, textAlign: 'left', background: '#050d0a', border: '1px solid #142a1f', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>Technical diagnostic details</summary>
              <div style={{ marginTop: 8, color: '#fca5a5', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {errMessage}
                {this.state.error?.stack ? `\n\n${this.state.error.stack}` : ''}
              </div>
            </details>
          </div>
          {this.state.showPopModal && (
            <PopTheTeamModal
              isOpen={true}
              onClose={() => this.setState({ showPopModal: false })}
              error={this.state.error}
              stack={this.state.error?.stack}
              standaloneCrash
            />
          )}
        </div>
      )
    }
    return this.props.children
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event?.message && /ResizeObserver loop|removeChild|not a child/i.test(event.message)) {
      event.stopImmediatePropagation()
      event.preventDefault()
    }
  })
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
