import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { name: string; children: ReactNode }
type State = { error: Error | null }

export default class SectionBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Guard:${this.props.name}]`, error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="reveal-loading guard" role="alert" style={{ textAlign: 'center', padding: '20px', background: '#0d1d16', border: '1px solid #1f4231', borderRadius: '10px', color: '#cfe3d3', margin: '12px 0' }}>
        <p style={{ margin: '0 0 10px', fontWeight: 600 }}>😅 This {this.props.name} panel hit a snag.</p>
        <div style={{ display: 'inline-flex', gap: '8px' }}>
          <button className="outline compact" onClick={() => this.setState({ error: null })} style={{ cursor: 'pointer', border: '1px solid #34d399', color: '#a7f3d0' }}>Try again</button>
          <button className="outline compact" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>Reload</button>
        </div>
      </div>
    )
  }
}
