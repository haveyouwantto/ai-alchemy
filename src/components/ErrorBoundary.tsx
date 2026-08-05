import { Component } from 'react'
import type { ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 出错时渲染的备用界面 */
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/** 通用错误边界：拦截渲染错误 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}
