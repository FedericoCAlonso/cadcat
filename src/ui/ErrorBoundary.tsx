import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Contextual title shown when this boundary catches a runtime error. */
  fallbackTitle?: string;
  /** Optional description explaining what remained safe. */
  fallbackDescription?: string;
  /** Optional callback invoked when the user clicks Retry. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * React ErrorBoundary isolating runtime rendering or WebGL failures so the rest
 * of the workspace remains usable and recoverable without losing IndexedDB data.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Error inesperado de renderizado.',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[CadCat ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: null });
    this.props.onReset?.();
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle ?? 'Se produjo un error inesperado en esta vista';
    const description =
      this.props.fallbackDescription ??
      'Tus módulos y catálogos siguen guardados localmente. Podés reintentar cargar este panel sin perder tu trabajo.';

    return (
      <section className="m3-card error-boundary-card" role="alert">
        <div className="error-boundary-card__content">
          <h3 className="error-boundary-card__title">{`⚠️ ${title}`}</h3>
          <p className="error-boundary-card__desc">{description}</p>
          {this.state.errorMessage && (
            <pre className="error-boundary-card__details">{this.state.errorMessage}</pre>
          )}
          <div className="error-boundary-card__actions">
            <button
              type="button"
              className="m3-btn m3-btn--primary"
              onClick={this.handleReset}
            >
              🔄 Reintentar
            </button>
          </div>
        </div>
      </section>
    );
  }
}
