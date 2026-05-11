import { useState, useEffect, useCallback, useRef, memo } from "react";
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
  location?: string;
  has_wfh?: boolean;
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
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function addDaysLocal(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
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
  const todayStr = getDateStr(0);
  const [referenceDate, setReferenceDate] = useState(todayStr);
  const [histData, setHistData] = useState<HistoryData>({});
  const [earliestDate, setEarliestDate] = useState<string>("2024-01-01");
  const [loadingHist, setLoadingHist] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/earliest-date`)
      .then(r => r.json())
      .then(data => { if (data.earliest_date) setEarliestDate(data.earliest_date); })
      .catch(() => {});
  }, []);

  // Validate referenceDate, fallback to todayStr if invalid
  let validRef = referenceDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validRef)) validRef = todayStr;

  const date2 = validRef;
  const date1 = addDaysLocal(validRef, -1);

  const canGoRight = date2 < todayStr;
  const canGoLeft = date1 > earliestDate;

  useEffect(() => {
    setLoadingHist(true);
    fetch(`${API_BASE}/daily-minutes?dates=${date1},${date2}`)
      .then((r) => r.json())
      .then((data: HistoryData) => {
        setHistData(data);
        setLoadingHist(false);
      })
      .catch(() => setLoadingHist(false));
  }, [date1, date2]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) setReferenceDate(e.target.value);
  };

  const handlePrev = () => setReferenceDate(addDaysLocal(validRef, -1));
  const handleNext = () => setReferenceDate(addDaysLocal(validRef, 1));

  const d1Map = histData[date1] || {};
  const d2Map = histData[date2] || {};

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
                  onClick={handlePrev}
                  disabled={!canGoLeft}
                  title="Go further back"
                >{"<"}</button>
                {formatDateHeader(date1)}
              </th>
              
              <th style={{ width: "40px", padding: 0, textAlign: "center" }}>
                <div className="date-picker-wrap" style={{ margin: 0 }}>
                  <div className="calendar-icon-btn" title="Pick a date">
                    <svg viewBox="0 0 24 24">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                    </svg>
                    <input 
                      type="date" 
                      className="hidden-date-input" 
                      value={date2} 
                      max={todayStr}
                      min={earliestDate}
                      onChange={handleDateChange} 
                    />
                  </div>
                </div>
              </th>

              <th className="ht-date">
                {formatDateHeader(date2)}
                <button
                  className="hist-arrow"
                  onClick={handleNext}
                  disabled={!canGoRight}
                  title="Go forward"
                >{">"}</button>
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
                  <td style={{ width: 0, padding: 0 }}></td>
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

const MemoHistoryTable = memo(HistoryTable);

// ─── EmployeeCard ─────────────────────────────────────────────────────────────
interface CardProps {
  emp: Employee;
  now: number;
  isLoading: boolean;
  onToggle: (emp: Employee) => void;
  todayCompleted: number; // completed IN→OUT minutes today (from backend)
}

function EmployeeCard({ emp, now, isLoading, onToggle, todayCompleted }: CardProps) {
  const isIN = emp.current_status === "IN";
  const isHome = isIN && emp.location === "Home";
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
        className={`circle-btn ${isHome ? "status-home" : (isIN ? "status-in" : "status-out")} ${isLoading ? "btn-loading" : ""} ${emp.has_wfh ? "btn-wfh" : ""}`}
        onClick={() => onToggle(emp)}
        disabled={isLoading || emp.has_wfh}
        style={{ width: BTN_SIZE, height: BTN_SIZE }}
        aria-label={`${emp.name} — ${emp.current_status}${emp.has_wfh ? " (WFH)" : ""}`}
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
              <span className="btn-minutes-num">{hasSince ? sessionMins : (emp.has_wfh ? "WFH" : "—")}</span>
              {hasSince && <span className="btn-mins-label">mins</span>}
            </div>
            <span className={`status-badge ${isHome ? "badge-home" : (isIN ? "badge-in" : "badge-out")}`}>
              {emp.has_wfh && emp.current_status === "OUT" ? "WFH" : emp.current_status}
            </span>
          </>
        )}
      </button>

      <p className={`emp-total-today ${isHome ? "text-home" : (isIN ? "text-in" : "text-out")}`}>
        {formatDuration(totalToday)} worked today
      </p>
    </div>
  );
}

const MemoEmployeeCard = memo(EmployeeCard, (prev, next) => {
  return (
    prev.emp.id === next.emp.id &&
    prev.emp.current_status === next.emp.current_status &&
    prev.emp.since === next.emp.since &&
    prev.emp.location === next.emp.location &&
    prev.emp.has_wfh === next.emp.has_wfh &&
    prev.isLoading === next.isLoading &&
    prev.todayCompleted === next.todayCompleted &&
    // Only re-render for time changes every 5s (coarse)
    Math.floor(prev.now / 5000) === Math.floor(next.now / 5000)
  );
});

// Preload: start fetching employees before React mounts (runs during JS parse)
let _preloadedEmployees: Promise<Response> | null = fetch(`${API_BASE}/employees`);

// Hydrate from localStorage for instant repeat-visit LCP
function _getCachedEmployees(): Employee[] {
  try {
    const raw = localStorage.getItem("att_employees");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function _setCachedEmployees(emps: Employee[]) {
  try { localStorage.setItem("att_employees", JSON.stringify(emps)); } catch { /* ignore */ }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const cachedEmps = _getCachedEmployees();
  const [employees, setEmployees] = useState<Employee[]>(cachedEmps);
  const [todayCompleted, setTodayCompleted] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(cachedEmps.length === 0);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const fetchEmployees = useCallback(async () => {
    try {
      // Consume the preloaded fetch on first call, then use normal fetch
      let res: Response;
      if (_preloadedEmployees) {
        res = await _preloadedEmployees;
        _preloadedEmployees = null;
      } else {
        res = await fetch(`${API_BASE}/employees`);
      }
      const data = await res.json();
      const emps = data.employees || [];
      setEmployees(emps);
      _setCachedEmployees(emps);
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

  // SSE connection for real-time updates and fallback polling
  useEffect(() => {
    const sse = new EventSource(`${API_BASE}/stream`);
    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "attendance_update") {
          fetchEmployees();
          fetchTodayMinutes();
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };
    
    // Fallback polling just in case SSE connection drops silently
    const id = setInterval(fetchEmployees, 120_000);
    return () => {
      sse.close();
      clearInterval(id);
    };
  }, [fetchEmployees, fetchTodayMinutes]);

  useEffect(() => {
    fetchTodayMinutes();
    const id = setInterval(fetchTodayMinutes, 60_000);
    return () => clearInterval(id);
  }, [fetchTodayMinutes]);

  const handleToggle = async (emp: Employee) => {
    if (actionLoading.has(emp.id)) return;
    const action = emp.current_status === "IN" ? "out" : "in";
    setActionLoading((prev) => new Set(prev).add(emp.id));
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
        showToast(data.message, "success");
        // Defer background re-fetches to avoid blocking the UI paint
        setTimeout(() => { fetchTodayMinutes(); fetchEmployees(); }, 0);
      } else showToast(data.message || "Something went wrong", "error");
    } catch { showToast("Network error. Please try again.", "error"); }
    finally { setActionLoading((prev) => { const next = new Set(prev); next.delete(emp.id); return next; }); }
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
          <MemoHistoryTable employees={employees} now={now} todayCompleted={todayCompleted} />
        </div>

        {/* RIGHT — live employee grid */}
        <div className="right-panel" style={{ position: "relative" }}>
          {loading && (
            <div className="loading-overlay"><div className="spinner" /><p>Loading…</p></div>
          )}
          {!loading && employees.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">👥</span><p>No active employees found.</p></div>
          ) : (
            <div className="employee-grid" style={{ "--emp-count": employees.length, opacity: loading ? 0 : 1, transition: "opacity 0.2s ease" } as React.CSSProperties}>
              {employees.map((emp) => (
                <MemoEmployeeCard
                  key={emp.id}
                  emp={emp}
                  now={now}
                  isLoading={actionLoading.has(emp.id)}
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