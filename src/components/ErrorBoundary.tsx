import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

type State = { hasError: boolean; error: Error | null };

const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? 'unknown';

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    const route = window.location.pathname;
    const errorName = error.name;
    const message = error.message;
    const stack = error.stack;
    console.error('[App Error]', {
      route,
      buildId: BUILD_ID,
      errorName,
      message,
      stack,
      componentStack: info,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-bg flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md border border-neutral-border p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-tint flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red" />
            </div>
            <h1 className="text-xl font-semibold text-navy">Something went wrong</h1>
            <p className="text-sm text-neutral-secondary mt-2">
              The application encountered an unexpected error while loading your account.
            </p>
            {this.state.error && (
              <pre className="mt-4 text-xs text-red bg-red-tint rounded-md p-3 overflow-auto max-h-40 text-left">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 text-sm font-medium text-white bg-navy hover:bg-navy-mid px-4 py-2 rounded-sm transition"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={this.handleSignOut}
                className="inline-flex items-center gap-2 text-sm font-medium text-navy hover:text-navy-mid px-4 py-2 rounded-sm border border-neutral-border transition"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
