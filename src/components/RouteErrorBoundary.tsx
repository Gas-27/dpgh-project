import { Component, type ErrorInfo, type ReactNode } from "react";
import { canAutoRecover, isChunkLoadError, recoverFromStaleBundle } from "@/lib/chunkRecovery";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// App-wide error boundary. Without this, any render-time exception unmounts the
// entire React tree and leaves users staring at a blank white screen. Here we
// catch the error, keep the shell visible, surface the actual message (so issues
// are reportable instead of silent), and offer a recovery path.
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route render error:", error, info.componentStack);
    if (isChunkLoadError(error)) void recoverFromStaleBundle();
  }

  handleReload = () => {
    this.setState({ error: null });
    void recoverFromStaleBundle({ force: true });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (isChunkLoadError(error) && canAutoRecover()) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground" role="status">Updating to the latest version...</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <h1 className="font-display text-xl font-bold text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            This page hit an unexpected error and could not finish loading. Try refreshing — if it keeps happening, share the message below with support.
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Refresh page
            </button>
            <a
              href="/"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
