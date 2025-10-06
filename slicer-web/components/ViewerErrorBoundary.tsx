'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { useViewerStore } from '../modules/store';

interface ViewerErrorBoundaryProps {
  children: ReactNode;
}

interface ViewerErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

export class ViewerErrorBoundary extends Component<
  ViewerErrorBoundaryProps,
  ViewerErrorBoundaryState
> {
  constructor(props: ViewerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): ViewerErrorBoundaryState {
    const message =
      error instanceof Error && error.message ? error.message : 'An unexpected error occurred.';

    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('ViewerErrorBoundary caught an error', error, info);
    }
  }

  private handleReset = () => {
    useViewerStore.getState().reset();
    this.setState({ hasError: false, errorMessage: undefined });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.4)',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
              Viewer failed to load
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: 'rgba(226, 232, 240, 0.9)' }}>
              {this.state.errorMessage}
            </p>
            <p style={{ margin: '0.5rem 0 0', color: 'rgba(148, 163, 184, 0.9)' }}>
              Try resetting the viewer and reloading your model.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              alignSelf: 'flex-start',
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ViewerErrorBoundary;
