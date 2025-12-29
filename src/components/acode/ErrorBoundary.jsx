import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl m-4">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">出錯了 (Something went wrong)</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">無法載入此區塊。</p>
          <pre className="text-left bg-white dark:bg-gray-900 p-4 rounded overflow-auto text-xs text-red-500 max-h-60">
            {this.state.error && this.state.error.toString()}
          </pre>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            重試
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
