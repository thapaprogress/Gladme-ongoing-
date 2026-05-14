import React, { useState } from "react";
import { motion } from "framer-motion";
import { login, register } from "../services/api";

const LoginScreen = ({ onAuth }) => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = mode === "login"
        ? await login(email, password)
        : await register(email, password, name);
      if (data.token) {
        onAuth(data.user, data.token);
      } else {
        setError(data.detail || "Authentication failed");
      }
    } catch (err) {
      setError(err.message || "Connection failed");
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "100vw", height: "100vh",
      background: "radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.1) 0%, transparent 60%), var(--bg-deep)",
    }}>
      <motion.div
        className="glass-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        style={{ width: "400px", maxWidth: "90vw" }}
      >
        <div className="card-header" style={{ justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "var(--radius-md)",
              background: "var(--gradient-primary)", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: "24px", color: "white",
              margin: "0 auto 12px", boxShadow: "var(--shadow-glow)",
            }}>G</div>
            <h2 style={{ fontSize: "20px", fontWeight: 700 }}>GladME Studio V5</h2>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Agentic Development Framework</span>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="project-input"
                  type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={{ width: "100%" }}
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="project-input"
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: "100%" }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="project-input"
                type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{ width: "100%" }}
              />
            </div>
            {error && (
              <div style={{
                padding: "8px 12px", borderRadius: "var(--radius-sm)",
                background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)",
                color: "var(--accent-rose)", fontSize: "13px", marginBottom: "12px",
              }}>
                {error}
              </div>
            )}
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : null}
              {mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: "var(--text-muted)" }}>
            {mode === "login" ? (
              <>Don't have an account? <button onClick={() => setMode("register")} style={{ background: "none", border: "none", color: "var(--accent-indigo)", cursor: "pointer", fontWeight: 600 }}>Sign Up</button></>
            ) : (
              <>Already have an account? <button onClick={() => setMode("login")} style={{ background: "none", border: "none", color: "var(--accent-indigo)", cursor: "pointer", fontWeight: 600 }}>Sign In</button></>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
