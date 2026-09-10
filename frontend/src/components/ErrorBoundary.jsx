import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[var(--color-bg)] text-[var(--color-text)]">
          <div className="card max-w-lg w-full p-6 text-center shadow-lg flex flex-col items-center gap-4">
            
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
              <AlertTriangle size={36} />
            </div>

            <h1 className="text-xl font-bold">
              Something went wrong
            </h1>

            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              An unexpected error occurred while rendering this component. You can try reloading the page or return to the homepage.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="w-full text-left dir-ltr mt-2 p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-xs font-mono text-red-500 overflow-x-auto">
                <p className="font-bold">{this.state.error.toString()}</p>
                <pre className="mt-1 text-[10px] text-[var(--color-text-muted)] whitespace-pre-wrap">
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full mt-2">
              <button
                onClick={this.handleReload}
                className="btn btn-primary w-full sm:w-auto"
              >
                <RefreshCw size={18} />
                Try Again
              </button>

              <button
                onClick={this.handleReset}
                className="btn btn-outline w-full sm:w-auto"
              >
                <Home size={18} />
                Back to Home
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
