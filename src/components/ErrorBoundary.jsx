import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, err: null } }
  static getDerivedStateFromError(err){ return { hasError: true, err } }
  componentDidCatch(err, info){ console.error('App crashed:', err, info) }
  reset = () => {
    try { localStorage.removeItem('wealth-tracker:data:v1') } catch {}
    // soft reload
    window.location.reload()
  }
  render(){
    if (!this.state.hasError) return this.props.children
    return (
      <div className="max-w-xl mx-auto p-6">
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
          The app hit an unexpected error. You can try reloading.
          If this keeps happening right after adding data, click “Reset local data” (you can re-import from Settings).
        </p>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={()=>window.location.reload()}>Reload</button>
          <button className="btn" onClick={this.reset}>Reset local data</button>
        </div>
      </div>
    )
  }
}
