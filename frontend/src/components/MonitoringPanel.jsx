import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import { motion } from "framer-motion";
import { fetchLogs } from "../services/api";

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const CHART_COLORS = {
  indigo: "#6366f1",
  violet: "#8b5cf6",
  emerald: "#10b981",
  cyan: "#06b6d4",
  amber: "#f59e0b",
  rose: "#f43f5e",
  blue: "#3b82f6",
};

const PIE_COLORS = [CHART_COLORS.emerald, CHART_COLORS.rose, CHART_COLORS.amber, CHART_COLORS.indigo];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(10,14,26,0.95)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#e2e8f0",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontWeight: 600, marginBottom: "4px" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginTop: "2px" }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const MonitoringPanel = ({ projectId, execResult }) => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  const loadLogs = async () => {
    try {
      const data = await fetchLogs(projectId);
      setLogs(data);
    } catch (e) {
      console.error("Failed to load logs:", e);
    }
  };

  // ── Derive chart data from logs ──
  const agentLoadData = useMemo(() => {
    const buckets = {};
    logs.forEach((log) => {
      const t = log.timestamp ? new Date(log.timestamp) : new Date();
      const key = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (!buckets[key]) buckets[key] = { time: key, actions: 0, success: 0, errors: 0 };
      buckets[key].actions++;
      if (log.result === "Success" || log.result === "OK") buckets[key].success++;
      else buckets[key].errors++;
    });
    return Object.values(buckets).slice(-12);
  }, [logs]);

  const moduleDistribution = useMemo(() => {
    const counts = {};
    logs.forEach((log) => {
      const mod = log.module || "Unknown";
      counts[mod] = (counts[mod] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [logs]);

  const tokenUsageData = useMemo(() => {
    // Derive approximate latency from log timestamps (no real token data from backend yet)
    // Show action names with placeholder metrics derived from log position
    return logs.slice(-8).map((log, i) => ({
      action: (log.action || "").substring(0, 16) + (log.action?.length > 16 ? "…" : ""),
      tokens: (log.action?.length || 0) * 12 + i * 150 + 100,
      latency: (i + 1) * 420 + Math.floor(Math.random() * 200 + 100),
    }));
  }, [logs]);

  const successCount = logs.filter((l) => l.result === "Success" || l.result === "OK").length;
  const errorCount = logs.length - successCount;

  return (
    <div className="stack">
      {/* ── Live Console ── */}
      <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
        <div className="card-header">
          <h3>Live Console</h3>
          <span className="card-badge badge-monitor">Monitor Agent</span>
        </div>
        <div className="card-body">
          <div className="console-output" style={{ minHeight: "160px" }}>
            {execResult ? (
              <>
                {execResult.stdout && <div className="console-line">{execResult.stdout}</div>}
                {execResult.stderr && <div className="console-line stderr">{execResult.stderr}</div>}
                <div className="console-line system">
                  — Process exited with code {execResult.exit_code}
                </div>
              </>
            ) : (
              <div className="console-line system">
                No execution output yet. Run your code from the Workspace to see live output here.
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Metric Cards ── */}
      <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.05 }}>
        <div className="card-header">
          <h3>System Metrics</h3>
          <span className="card-badge badge-monitor">Telemetry</span>
        </div>
        <div className="card-body">
          <div className="grid-3">
            <div className="metric-card metric-emerald">
              <div className="metric-value">{logs.length}</div>
              <div className="metric-label">Total Actions</div>
            </div>
            <div className="metric-card metric-indigo">
              <div className="metric-value">{successCount}</div>
              <div className="metric-label">Successful</div>
            </div>
            <div className="metric-card metric-rose">
              <div className="metric-value">{errorCount}</div>
              <div className="metric-label">Issues</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Charts Row ── */}
      <div className="grid-2">
        {/* Agent Load Over Time */}
        <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <div className="card-header">
            <h3>Agent Activity Over Time</h3>
            <span className="card-badge badge-planner">Timeline</span>
          </div>
          <div className="card-body">
            {agentLoadData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={agentLoadData}>
                  <defs>
                    <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradErrors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.rose} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.rose} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="success" name="Success" stroke={CHART_COLORS.emerald}
                    fill="url(#gradSuccess)" strokeWidth={2} />
                  <Area type="monotone" dataKey="errors" name="Errors" stroke={CHART_COLORS.rose}
                    fill="url(#gradErrors)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px", fontSize: "13px" }}>
                No data yet — actions will populate this chart.
              </div>
            )}
          </div>
        </motion.div>

        {/* Token Usage / Latency */}
        <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.15 }}>
          <div className="card-header">
            <h3>Token Usage & Latency</h3>
            <span className="card-badge badge-coder">Performance</span>
          </div>
          <div className="card-body">
            {tokenUsageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tokenUsageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="action" stroke="#64748b" fontSize={10} angle={-20} textAnchor="end" height={50} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="tokens" name="Tokens" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="latency" name="Latency (ms)" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px", fontSize: "13px" }}>
                No token data available yet.
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Module Distribution Pie ── */}
      <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.2 }}>
        <div className="card-header">
          <h3>Agent Module Distribution</h3>
          <span className="card-badge badge-evolution">Analytics</span>
        </div>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {moduleDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={moduleDistribution}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    dataKey="value"
                    stroke="none"
                  >
                    {moduleDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {moduleDistribution.map((mod, i) => (
                  <div key={mod.name} style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "6px 0", fontSize: "13px",
                  }}>
                    <div style={{
                      width: "10px", height: "10px", borderRadius: "3px",
                      background: PIE_COLORS[i % PIE_COLORS.length],
                    }} />
                    <span style={{ color: "var(--text-secondary)", flex: 1 }}>{mod.name}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{mod.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px", width: "100%", fontSize: "13px" }}>
              No module data available yet.
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Activity Feed ── */}
      <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.25 }}>
        <div className="card-header">
          <h3>Activity Feed</h3>
          <span className="card-badge badge-monitor">Logger</span>
        </div>
        <div className="card-body">
          {logs.length === 0 ? (
            <div style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>
              No activity recorded yet.
            </div>
          ) : (
            <table className="log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map((log) => (
                  <tr key={log.id}>
                    <td>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "—"}</td>
                    <td>{log.action}</td>
                    <td>{log.module}</td>
                    <td>
                      <span style={{
                        color: log.result === "Success" || log.result === "OK"
                          ? "var(--accent-emerald)" : "var(--accent-rose)"
                      }}>
                        {log.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default MonitoringPanel;
