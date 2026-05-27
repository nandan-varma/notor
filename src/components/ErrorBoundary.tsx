import { Component, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defense — keeps a single component crash from blanking the
 * whole app. Reload triggers a fresh module graph; "try again" simply
 * resets the boundary in case the failure was transient.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[notor] uncaught error", error, info);
  }

  reset = () => this.setState({ error: null });

  reload = () => window.location.reload();

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.wrap} role="alert">
        <div className={styles.card}>
          <h1 className={styles.title}>Something broke</h1>
          <p className={styles.message}>
            {this.state.error.message || "Unknown error"}
          </p>
          <details className={styles.details}>
            <summary>Stack trace</summary>
            <pre>{this.state.error.stack}</pre>
          </details>
          <div className={styles.actions}>
            <button className={styles.secondary} onClick={this.reset}>
              Try again
            </button>
            <button className={styles.primary} onClick={this.reload}>
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
