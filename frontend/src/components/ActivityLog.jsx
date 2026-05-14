import React, { useState, useEffect } from "react";
import { fetchLogs } from "../services/api";

const ActivityLog = ({ projectId }) => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadLogs();
  }, [projectId]);

  const loadLogs = async () => {
    try {
      const data = await fetchLogs(projectId);
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load logs:", e);
    }
  };

  return (
    <div className="glass-card">
      <div className="card-header">
        <h3>Activity History</h3>
        <button className="btn btn-ghost btn-sm" onClick={loadLogs}>
          🔄 Refresh
        </button>
      </div>
      <div className="card-body">
        {logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Activity Yet</h3>
            <p>Create a project and start working to see activity logged here.</p>
          </div>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Module</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id}>
                  <td style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                  <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</td>
                  <td style={{ color: "var(--text-primary)" }}>{log.action}</td>
                  <td>{log.module}</td>
                  <td>
                    <span style={{
                      color: log.result === "Success" || log.result === "OK"
                        ? "var(--accent-emerald)" : "var(--accent-rose)",
                      fontWeight: 600,
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
    </div>
  );
};

export default ActivityLog;
