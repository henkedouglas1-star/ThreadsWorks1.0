import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: "",
  };

  public static getDerivedStateFromError(error: Error): State {
    const msg = error?.message || String(error);
    // Ignore benign closing IDBDatabase / network connection teardown errors
    if (
      msg.includes("database connection is closing") ||
      msg.includes("Failed to execute 'transaction' on 'IDBDatabase'")
    ) {
      return { hasError: false, errorMessage: "" };
    }
    return { hasError: true, errorMessage: msg };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const msg = error?.message || String(error);
    if (
      msg.includes("database connection is closing") ||
      msg.includes("Failed to execute 'transaction' on 'IDBDatabase'")
    ) {
      return;
    }
    console.warn("Caught in React ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: "" });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-page p-6 text-text-main">
          <div className="max-w-md w-full p-8 rounded-2xl bg-bg-surface border border-border-main text-center shadow-lg space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold text-xl">
              !
            </div>
            <h2 className="text-xl font-bold text-text-main">Something went wrong</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              {this.state.errorMessage || "An unexpected error occurred during rendering."}
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-3 px-6 rounded-xl font-semibold bg-accent-main text-white hover:bg-accent-hover transition-colors shadow-sm"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
