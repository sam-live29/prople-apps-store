import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-[#131314] text-white font-sans text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-lg">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-white">Something went wrong</h2>
          <p className="text-sm text-neutral-400 max-w-md mb-6 leading-relaxed">
            The page encountered an unexpected issue while loading app details. Please try reloading or returning to the store home.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-sm font-medium text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload page
            </button>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] dark:bg-[#a8c7fa] dark:hover:bg-[#8ab4f8] dark:text-[#003366] text-sm font-medium transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
