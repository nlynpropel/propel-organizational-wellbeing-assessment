import { Component, type ReactNode } from 'react';

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-bg flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md border border-neutral-border p-8">
            <h1 className="text-xl font-semibold text-navy">Something went wrong</h1>
            <p className="text-sm text-neutral-secondary mt-2">
              The application encountered an unexpected error.
            </p>
            {this.state.error && (
              <pre className="mt-4 text-xs text-red bg-red-tint rounded-md p-3 overflow-auto max-h-40">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 text-sm font-medium text-navy hover:text-navy-mid transition"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
