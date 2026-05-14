import React, { useState, useCallback } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import useDashboardStore from "../store/useDashboardStore";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export const WIDGET_TYPES = [
  { type: "line_chart", label: "Line Chart", icon: "📈" },
  { type: "bar_chart", label: "Bar Chart", icon: "📊" },
  { type: "pie_chart", label: "Pie Chart", icon: "🥧" },
  { type: "kpi", label: "KPI Card", icon: "🔢" },
  { type: "table", label: "Data Table", icon: "📋" },
  { type: "text", label: "Text Block", icon: "📝" },
];

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const SAMPLE_DATA = [
  { name: "Jan", value: 400 }, { name: "Feb", value: 300 },
  { name: "Mar", value: 500 }, { name: "Apr", value: 280 },
  { name: "May", value: 590 },
];

// Default grid size per widget type
const DEFAULT_SIZE = {
  line_chart: { w: 6, h: 4 },
  bar_chart:  { w: 6, h: 4 },
  pie_chart:  { w: 4, h: 4 },
  kpi:        { w: 3, h: 2 },
  table:      { w: 6, h: 4 },
  text:       { w: 4, h: 2 },
};

export function WidgetRenderer({ component }) {
  const { type, title, config } = component;
  const { metrics } = useDashboardStore();
  
  // Decide which data to use: explicitly provided -> from metrics -> fallback to SAMPLE
  let data = config?.data;
  if (!data && config?.metricKey && metrics[config.metricKey]) {
    data = metrics[config.metricKey];
  }
  if (!data) data = SAMPLE_DATA;

  if (type === "kpi") {
    const val = config?.metricKey && metrics[config.metricKey] !== undefined 
      ? metrics[config.metricKey] 
      : (config?.value || "—");
    
    return (
      <div className="dash-widget kpi-widget">
        <div className="kpi-label">{title || "KPI"}</div>
        <div className="kpi-value">
          {typeof val === "number" && config?.metricKey?.includes("Rate") ? `${val}%` : val}
        </div>
        {config?.change != null && (
          <div className={`kpi-change ${config.change > 0 ? "positive" : "negative"}`}>
            {config.change > 0 ? "↑" : "↓"} {Math.abs(config.change)}%
          </div>
        )}
      </div>
    );
  }

  if (type === "table") {
    const cols = config?.columns || ["Name", "Value"];
    const rows = config?.rows || data.map(d => [d.name, d.value]);
    return (
      <div className="dash-widget table-widget">
        {title && <h4>{title}</h4>}
        <table>
          <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }

  if (type === "text") {
    return (
      <div className="dash-widget text-widget">
        <h4>{title || "Notes"}</h4>
        <p>{config?.content || "Empty text block"}</p>
      </div>
    );
  }

  return <ChartWidget type={type} title={title} data={data} />;
}

export function ChartWidget({ type, title, data }) {
  const [Recharts, setRecharts] = useState(null);
  const [err, setErr] = useState(null);

  React.useEffect(() => {
    import("recharts").then(mod => setRecharts(mod)).catch(e => setErr(e));
  }, []);

  if (err) return <div className="dash-widget">Chart unavailable</div>;
  if (!Recharts) return <div className="dash-widget loading-widget">Loading chart...</div>;

  const {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  } = Recharts;

  const wrap = (chart) => (
    <div className="dash-widget chart-widget">
      {title && <h4>{title}</h4>}
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  );

  if (type === "pie_chart") {
    return wrap(
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="60%" label>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip /><Legend />
      </PieChart>
    );
  }

  if (type === "bar_chart") {
    return wrap(
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
        <Legend />
        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  }

  return wrap(
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
      <Legend />
      <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1" }} />
    </LineChart>
  );
}

function WidgetPalette({ onAdd }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="widget-palette">
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(!open)}>
        + Add Widget
      </button>
      {open && (
        <div className="widget-palette-menu">
          {WIDGET_TYPES.map(w => (
            <button
              key={w.type}
              className="widget-palette-item"
              onClick={() => { onAdd(w.type); setOpen(false); }}
            >
              {w.icon} {w.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardCanvas({ dashboard, onAddWidget, onRemoveWidget, onLayoutChange }) {
  const widgets = dashboard?.components || [];

  // Build grid layout from widgets, using stored layout or defaults
  const buildLayout = useCallback((comps) => {
    return comps.map((comp, idx) => {
      const saved = comp.layout || {};
      const size = DEFAULT_SIZE[comp.type] || { w: 4, h: 3 };
      const col = (idx * 3) % 12;
      const row = Math.floor((idx * 3) / 12) * 4;
      return {
        i: String(comp.id || idx),
        x: saved.x ?? col,
        y: saved.y ?? row,
        w: saved.w ?? size.w,
        h: saved.h ?? size.h,
        minW: 2,
        minH: 2,
      };
    });
  }, []);

  const [layouts, setLayouts] = useState(() => ({
    lg: buildLayout(widgets),
  }));

  // Keep layout in sync with widgets count
  React.useEffect(() => {
    setLayouts(prev => ({
      ...prev,
      lg: buildLayout(widgets)
    }));
  }, [widgets, buildLayout]);

  const handleLayoutChange = (currentLayout, allLayouts) => {
    setLayouts(allLayouts);
    if (onLayoutChange) onLayoutChange(currentLayout);
  };

  if (widgets.length === 0) {
    return (
      <div className="dashboard-canvas-empty">
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📊</div>
          <h3 style={{ marginBottom: "8px" }}>Empty Dashboard</h3>
          <p style={{ fontSize: "13px", marginBottom: "20px" }}>Add your first widget to get started visualizing project data.</p>
          {onAddWidget && (
            <div>
              <WidgetPalette onAdd={onAddWidget} />
              <p style={{ fontSize: "11px", marginTop: "16px", color: "var(--text-muted)" }}>
                Recommended: Start with KPI cards or a Line Chart
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-canvas-wrap">
      {onAddWidget && (
        <div className="dashboard-toolbar">
          <WidgetPalette onAdd={onAddWidget} />
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Drag to rearrange · Resize from corner
          </span>
        </div>
      )}

      <ResponsiveGridLayout
        className="dashboard-grid"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={60}
        isDraggable
        isResizable
        margin={[12, 12]}
        containerPadding={[0, 0]}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".dash-drag-handle"
      >
        {widgets.map((comp, idx) => (
          <div key={String(comp.id || idx)} className="dash-grid-cell">
            <div className="dash-cell-header">
              <span className="dash-drag-handle" title="Drag to move">⠿</span>
              <span className="dash-cell-type">
                {WIDGET_TYPES.find(w => w.type === comp.type)?.icon || "📦"}
                {" "}
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {WIDGET_TYPES.find(w => w.type === comp.type)?.label || comp.type}
                </span>
              </span>
              {onRemoveWidget && (
                <button
                  className="btn btn-ghost btn-sm dash-remove-btn"
                  onClick={() => onRemoveWidget(idx)}
                  title="Remove widget"
                >✕</button>
              )}
            </div>
            <div className="dash-cell-body">
              <WidgetRenderer component={comp} />
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
