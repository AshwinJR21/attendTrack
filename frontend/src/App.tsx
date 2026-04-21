import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";

// Use environment variable for backend URL, with the production Tailscale IP as a fallback
const API_BASE = import.meta.env.VITE_API_BASE || "http://100.83.250.58:5000";
const BTN_SIZE = 76;
const RADIUS = 32;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Employee {
  id: string;
  name: string;
  status: string;
  current_status: "IN" | "OUT";
  since?: string;
}

function parseSince(ts?: string): Date | null {
  if (!ts) return null;
  const d = new Date(ts.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function minutesElapsed(sinceMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - sinceMs) / 60_000));
}

function minuteProgress(sinceMs: number, nowMs: number): number {
  return ((nowMs - sinceMs) % 60_000) / 60_000;
}

function getDateStr(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function formatDuration(totalMins: number | null): string {
  if (totalMins === null) return "—";
  if (totalMins < 60) return `${totalMins} mins`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (m === 0) return `${h} hours`;
  return `${h} hours ${m} mins`;
}

function getLiveTodayMins(emp: Employee, now: number, completedToday: number = 0): number {
  const isIN = emp.current_status === "IN";
  const sinceDate = parseSince(emp.since);

  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const midnightMs = todayMidnight.getTime();

  const sinceMs = sinceDate ? Math.max(sinceDate.getTime(), midnightMs) : midnightMs;
  const hasSince = !!sinceDate;

  const sessionMins = hasSince ? minutesElapsed(sinceMs, now) : 0;
  return isIN ? completedToday + sessionMins : completedToday;
}

// ─── HistoryTable ────────────────────────────────────────────────────────────
interface HistoryData {
  [date: string]: { [empId: string]: number };
}

function HistoryTable({ employees, now, todayCompleted }: { employees: Employee[], now: number, todayCompleted: Record<string, number> }) {
  // colBase: how many days ago the NEWER column is. Default 0 = today.
  // date1 = today-(colBase+1), date2 = today-colBase
  const [colBase, setColBase] = useState(0);
  const [histData, setHistData] = useState<HistoryData>({});
  const [canGoLeft, setCanGoLeft] = useState(true);
  const [loadingHist, setLoadingHist] = useState(false);

  const date1 = getDateStr(-(colBase + 1));
  const date2 = getDateStr(-colBase);
  const canGoRight = colBase > 0;

  useEffect(() => {
    setLoadingHist(true);
    fetch(`${API_BASE}/daily-minutes?dates=${date1},${date2}`)
      .then((r) => r.json())
      .then((data: HistoryData) => {
        setHistData(data);
        const d1Total = Object.values(data[date1] || {}).reduce((a, b) => a + b, 0);
        setCanGoLeft(d1Total > 0);
        setLoadingHist(false);
      })
      .catch(() => setLoadingHist(false));
  }, [date1, date2]);

  const d1Map = histData[date1] || {};
  const d2Map = histData[date2] || {};
  const todayStr = getDateStr(0);

  return (
    <div className="history-panel">
      <h2 className="history-title">
        Work History
        {loadingHist && <span className="title-spinner" />}
      </h2>
      <div className="history-table-wrap">
        <table className={`history-table ${loadingHist ? "table-loading" : ""}`}>
          <thead>
            <tr>
              <th className="ht-name">Employee</th>
              <th className="ht-date">
                <button
                  className="hist-arrow"
                  onClick={() => setColBase((c) => c + 1)}
                  disabled={!canGoLeft}
                  title="Go further back"
                >←</button>
                {formatDateHeader(date1)}
              </th>
              <th className="ht-date">
                {formatDateHeader(date2)}
                <button
                  className="hist-arrow"
                  onClick={() => setColBase((c) => c - 1)}
                  disabled={!canGoRight}
                  title="Go forward"
                >→</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const m1 = date1 === todayStr ? getLiveTodayMins(emp, now, todayCompleted[emp.id]) : (d1Map[emp.id] ?? null);
              const m2 = date2 === todayStr ? getLiveTodayMins(emp, now, todayCompleted[emp.id]) : (d2Map[emp.id] ?? null);
              return (
                <tr key={emp.id}>
                  <td className="ht-name-cell">{emp.name}</td>
                  <td className={`ht-mins-cell ${m1 && m1 > 0 ? "mins-good" : "mins-zero"}`}>
                    {formatDuration(m1)}
                  </td>
                  <td className={`ht-mins-cell ${m2 && m2 > 0 ? "mins-good" : "mins-zero"}`}>
                    {formatDuration(m2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── EmployeeCard ─────────────────────────────────────────────────────────────
interface CardProps {
  emp: Employee;
  now: number;
  isLoading: boolean;
  anyLoading: boolean;
  onToggle: (emp: Employee) => void;
  todayCompleted: number; // completed IN→OUT minutes today (from backend)
}

function EmployeeCard({ emp, now, isLoading, anyLoading, onToggle, todayCompleted }: CardProps) {
  const isIN = emp.current_status === "IN";
  const sinceDate = parseSince(emp.since);

  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const midnightMs = todayMidnight.getTime();

  const sinceMs = sinceDate ? Math.max(sinceDate.getTime(), midnightMs) : midnightMs;
  const hasSince = !!sinceDate;

  // Minutes since last check-in/out (current session)
  const sessionMins = hasSince ? minutesElapsed(sinceMs, now) : 0;
  const progress = hasSince ? minuteProgress(sinceMs, now) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  // Total today = completed sessions + ongoing session (if IN)
  const totalToday = getLiveTodayMins(emp, now, todayCompleted);

  return (
    <div className="employee-card">
      <p className="emp-name">{emp.name}</p>

      <button
        className={`circle-btn ${isIN ? "status-in" : "status-out"} ${isLoading ? "btn-loading" : ""}`}
        onClick={() => onToggle(emp)}
        disabled={anyLoading}
        style={{ width: BTN_SIZE, height: BTN_SIZE }}
        aria-label={`${emp.name} — ${emp.current_status}`}
      >
        {isLoading ? (
          <span className="btn-spinner" />
        ) : (
          <>
            <svg className="timer-svg" viewBox={`0 0 ${BTN_SIZE} ${BTN_SIZE}`} aria-hidden>
              <circle cx={BTN_SIZE/2} cy={BTN_SIZE/2} r={RADIUS} fill="none"
                stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
              <circle cx={BTN_SIZE/2} cy={BTN_SIZE/2} r={RADIUS} fill="none"
                stroke={isIN ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.7)"}
                strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${BTN_SIZE/2} ${BTN_SIZE/2})`}
                style={{ transition: "stroke-dashoffset 0.95s linear" }} />
            </svg>
            <div className="btn-time-display">
              <span className="btn-minutes-num">{hasSince ? sessionMins : "—"}</span>
              {hasSince && <span className="btn-mins-label">mins</span>}
            </div>
            <span className={`status-badge ${isIN ? "badge-in" : "badge-out"}`}>
              {emp.current_status}
            </span>
          </>
        )}
      </button>

      <p className={`emp-total-today ${isIN ? "text-in" : "text-out"}`}>
        {formatDuration(totalToday)} worked today
      </p>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayCompleted, setTodayCompleted] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/employees`);
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch {
      showToast("Failed to load employees", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTodayMinutes = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`${API_BASE}/daily-minutes?dates=${today}`);
      const data = await res.json();
      setTodayCompleted(data[today] || {});
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => {
    fetchTodayMinutes();
    const id = setInterval(fetchTodayMinutes, 60_000);
    return () => clearInterval(id);
  }, [fetchTodayMinutes]);

  const handleToggle = async (emp: Employee) => {
    if (actionLoading) return;
    const action = emp.current_status === "IN" ? "out" : "in";
    setActionLoading(emp.id);
    try {
      const res = await fetch(`${API_BASE}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: emp.id, employee_name: emp.name, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees((prev) =>
          prev.map((e) => e.id === emp.id
            ? { ...e, current_status: data.current_status, since: data.timestamp }
            : e)
        );
        fetchTodayMinutes(); // refresh totals after toggle
        showToast(data.message, "success");
      } else showToast(data.message || "Something went wrong", "error");
    } catch { showToast("Network error. Please try again.", "error"); }
    finally { setActionLoading(null); }
  };

  const nowDate = new Date(now);
  const dateStr = nowDate.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = nowDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const inCount  = employees.filter((e) => e.current_status === "IN").length;
  const outCount = employees.filter((e) => e.current_status === "OUT").length;

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo">
              <span className="logo-icon">⏱</span>
              <span className="logo-text">AttendTrack</span>
            </div>
            <div className="date-time">
              <span className="date">{dateStr}</span>
              <span className="time">{timeStr}</span>
            </div>
          </div>
          <div className="stats-bar">
            <div className="stat stat-in"><span className="stat-dot dot-in" /><span className="stat-label">IN</span><span className="stat-count">{inCount}</span></div>
            <div className="stat stat-out"><span className="stat-dot dot-out" /><span className="stat-label">OUT</span><span className="stat-count">{outCount}</span></div>
            <button className="refresh-btn" onClick={() => { fetchEmployees(); fetchTodayMinutes(); }} title="Refresh">↻</button>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* LEFT — history table */}
        <div className="left-panel">
          <HistoryTable employees={employees} now={now} todayCompleted={todayCompleted} />
        </div>

        {/* RIGHT — live employee grid */}
        <div className="right-panel">
          {loading ? (
            <div className="loading-state"><div className="spinner" /><p>Loading…</p></div>
          ) : employees.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">👥</span><p>No active employees found.</p></div>
          ) : (
            <div className="employee-grid">
              {employees.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  emp={emp}
                  now={now}
                  isLoading={actionLoading === emp.id}
                  anyLoading={!!actionLoading}
                  onToggle={handleToggle}
                  todayCompleted={todayCompleted[emp.id] || 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" ? "✓" : "✕"} {toast.message}
        </div>
      )}
    </div>
  );
}