import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application Error:', error);
    console.error(errorInfo);

    // Future:
    // Send to Sentry / LogRocket / monitoring service
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h2>Une erreur est survenue</h2>

          <p>
            Veuillez réessayer ou recharger la page.
          </p>

          <button
            onClick={this.handleRetry}
            style={{
              marginTop: '1rem',
              padding: '10px 20px',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;