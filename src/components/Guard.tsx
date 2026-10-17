import React from 'react'

type S = { err?: Error }

export class Guard extends React.Component<{ children: React.ReactNode; name?: string }, S> {
  state: S = {}

  static getDerivedStateFromError(err: Error): S {
    return { err }
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error(`[Guard:${this.props.name ?? 'panel'}]`, err, info.componentStack)
  }

  render() {
    if (!this.state.err) return this.props.children
    return (
      <div
        role="alert"
        className="guard"
        style={{
          padding: '24px',
          background: '#0d1d16',
          border: '1px solid #1f4231',
          borderRadius: '12px',
          color: '#cfe3d3',
          textAlign: 'center',
          margin: '12px 0',
        }}
      >
        <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>
          😅 This {this.props.name ?? 'panel'} hit a snag.
        </p>
        <div style={{ display: 'inline-flex', gap: '8px' }}>
          <button
            type="button"
            className="outline compact"
            onClick={() => this.setState({ err: undefined })}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #34d399',
              background: 'rgba(52, 211, 153, 0.15)',
              color: '#a7f3d0',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
          <button
            type="button"
            className="outline compact"
            onClick={() => window.location.reload()}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #64748b',
              background: '#1e293b',
              color: '#e2e8f0',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}

export default Guard
