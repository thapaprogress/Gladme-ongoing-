import React, { Component } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("GladME Studio crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "100vh", background: "#0a0e1a", color: "#f1f5f9", fontFamily: "'Inter', sans-serif",
        }}>
          <h1 style={{ fontSize: "24px", marginBottom: "12px" }}>Something went wrong</h1>
          <p style={{ color: "#94a3b8", marginBottom: "20px", maxWidth: "500px", textAlign: "center" }}>
            GladME Studio encountered an unexpected error. Please try refreshing the page.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: "10px 24px", borderRadius: "8px", border: "none", cursor: "pointer",
              background: "#6366f1", color: "white", fontSize: "14px", fontWeight: 600,
            }}
          >
            Refresh Page
          </button>
          <details style={{ marginTop: "20px", color: "#64748b", fontSize: "12px", maxWidth: "600px" }}>
            <summary>Error details</summary>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: "8px" }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
