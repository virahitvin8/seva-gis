import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { name: string; children: ReactNode }
type State = { error: Error | null }

export default class SectionBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`SEVA·GIS ${this.props.name} panel failed:`, error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="reveal-loading" role="alert">
        <span>{this.props.name} could not be displayed.</span>
        <button className="outline compact" onClick={() => this.setState({ error: null })}>Try again</button>
        <button className="outline compact" onClick={() => window.location.reload()}>Reload app</button>
      </div>
    )
  }
}
