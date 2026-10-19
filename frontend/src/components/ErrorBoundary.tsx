import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Termlet ErrorBoundary caught an unhandled component error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleHardReload = () => {
    try {
      localStorage.removeItem('termlet://active_session');
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const { error, showDetails, errorInfo } = this.state;
      const title = this.props.fallbackTitle || 'Something went wrong in this view';

      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none min-h-[300px]">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 shadow-sm">
            <AlertTriangle className="w-6 h-6 stroke-[2]" />
          </div>

          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mt-1.5 leading-relaxed">
            {error?.message || 'An unexpected rendering error occurred. The application remains running.'}
          </p>

          {/* Recovery Actions */}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload View</span>
            </button>

            <button
              onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
            >
              <span>{showDetails ? 'Hide Details' : 'Details'}</span>
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={this.handleHardReload}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-xs transition-colors cursor-pointer"
              title="Reload entire app window"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Full Restart</span>
            </button>
          </div>

          {/* Technical Details Accordion */}
          {showDetails && (
            <div className="mt-6 w-full max-w-2xl text-left p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 overflow-x-auto select-text shadow-inner">
              <div className="font-bold text-rose-600 dark:text-rose-400 mb-2">
                {error?.name}: {error?.message}
              </div>
              {error?.stack && (
                <pre className="text-[10px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-tight">
                  {error.stack}
                </pre>
              )}
              {errorInfo?.componentStack && (
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">
                    Component Stack
                  </span>
                  <pre className="text-[10px] text-zinc-500 whitespace-pre-wrap leading-tight">
                    {errorInfo.componentStack}
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
export default ErrorBoundary;
