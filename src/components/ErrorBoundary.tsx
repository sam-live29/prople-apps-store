import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp, Copy, Check, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  showDetails: boolean;
  copied: boolean;
  isClearingCache: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
      isClearingCache: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
    this.setState({ errorInfo });

    // Auto-recover once from stale chunk loading / dynamic import errors after code pushes
    try {
      const msg = (error?.message || '').toLowerCase();
      if (
        msg.includes('dynamically imported module') ||
        msg.includes('loading chunk') ||
        msg.includes('chunkloaderror') ||
        msg.includes('failed to fetch')
      ) {
        const retryKey = 'prople_chunk_reload_attempt';
        const hasRetried = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(retryKey);
        if (!hasRetried && typeof window !== 'undefined') {
          sessionStorage.setItem(retryKey, '1');
          window.location.reload();
        }
      }
    } catch {}
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleClearCacheAndReload = async () => {
    this.setState({ isClearingCache: true });
    try {
      if (typeof window !== 'undefined') {
        // Clear storages
        try { sessionStorage.clear(); } catch {}
        try {
          const preserveAuth = localStorage.getItem('appmarket_user_profile');
          localStorage.clear();
          if (preserveAuth) localStorage.setItem('appmarket_user_profile', preserveAuth);
        } catch {}

        // Unregister service workers
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.unregister();
          }
        }

        // Clear all CacheStorage
        if ('caches' in window) {
          const keys = await caches.keys();
          for (const k of keys) {
            await caches.delete(k);
          }
        }

        window.location.replace('/');
      }
    } catch {
      window.location.reload();
    }
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const details = `Error: ${error?.name}: ${error?.message}\n\nStack:\n${error?.stack || 'N/A'}\n\nComponent Stack:\n${errorInfo?.componentStack || 'N/A'}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(details);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, showDetails, copied, isClearingCache } = this.state;

      return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-[#131314] text-white font-sans text-center overflow-y-auto">
          <div className="flex items-center justify-center text-amber-400 mb-3">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-white">Something went wrong</h2>
          <p className="text-sm text-neutral-400 max-w-md mb-6 leading-relaxed">
            The page encountered an unexpected issue while loading. Please try reloading or returning to the store home.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mb-6">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-sm font-medium text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload page
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#124893] text-sm font-medium text-white transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </button>
            <button
              type="button"
              onClick={this.handleClearCacheAndReload}
              disabled={isClearingCache}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-[6px] bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-xs sm:text-sm font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
              {isClearingCache ? 'Clearing...' : 'Clear cache & reload'}
            </button>
          </div>

          {/* Transparent error details accordion for instant diagnostics */}
          {error && (
            <div className="w-full max-w-xl text-left bg-neutral-900/90 border border-neutral-800 rounded-lg p-3 text-xs mt-2">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="w-full flex items-center justify-between font-mono text-neutral-300 hover:text-white py-1 cursor-pointer select-none"
              >
                <span className="truncate pr-2 text-red-400 font-medium">
                  {error.name}: {error.message || 'Unknown error'}
                </span>
                <span className="flex items-center gap-1 text-neutral-400 shrink-0 text-[11px]">
                  {showDetails ? (
                    <>Hide <ChevronUp className="w-3.5 h-3.5" /></>
                  ) : (
                    <>Details <ChevronDown className="w-3.5 h-3.5" /></>
                  )}
                </span>
              </button>

              {showDetails && (
                <div className="mt-2 pt-2 border-t border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-neutral-500 uppercase tracking-wider">Stack Trace</span>
                    <button
                      type="button"
                      onClick={this.handleCopyError}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="font-mono text-[11px] text-neutral-400 bg-black/60 p-2.5 rounded overflow-x-auto whitespace-pre-wrap max-h-48 scrollbar-thin">
                    {error.stack || error.message || 'No stack trace available'}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

