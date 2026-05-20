"use client";

import React, { useState } from 'react';
import {
  CalendarDays,
  Clock,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

type RequestType = 'leave' | 'permission';
type LeaveCategory = 'sick' | 'casual' | 'emergency' | 'other';
type RequestStatus = 'pending' | 'approved' | 'rejected';

interface LeaveRequest {
  id: string;
  type: RequestType;
  category: LeaveCategory;
  fromDate: string;
  toDate: string;
  reason: string;
  status: RequestStatus;
  submittedAt: string;
  adminNote?: string;
}

// ─── Boilerplate placeholder requests ────────────────────────────────────────
const PLACEHOLDER_REQUESTS: LeaveRequest[] = [
  {
    id: 'REQ-001',
    type: 'leave',
    category: 'sick',
    fromDate: '2026-05-15',
    toDate: '2026-05-16',
    reason: 'Fever and flu — doctor advised rest for 2 days.',
    status: 'approved',
    submittedAt: '2026-05-14T09:30:00',
    adminNote: 'Get well soon. Approved.',
  },
  {
    id: 'REQ-002',
    type: 'permission',
    category: 'other',
    fromDate: '2026-05-20',
    toDate: '2026-05-20',
    reason: 'Need to leave by 3:00 PM for a bank appointment.',
    status: 'pending',
    submittedAt: '2026-05-20T08:00:00',
  },
  {
    id: 'REQ-003',
    type: 'leave',
    category: 'casual',
    fromDate: '2026-04-28',
    toDate: '2026-04-28',
    reason: 'Family function.',
    status: 'rejected',
    submittedAt: '2026-04-25T11:00:00',
    adminNote: 'Critical sprint week — cannot approve.',
  },
];

const CATEGORY_LABELS: Record<LeaveCategory, string> = {
  sick: 'Sick Leave',
  casual: 'Casual Leave',
  emergency: 'Emergency Leave',
  other: 'Other',
};

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: 'Pending',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',  icon: <Clock3 size={13} /> },
  approved: { label: 'Approved', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle2 size={13} /> },
  rejected: { label: 'Rejected', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',     icon: <XCircle size={13} /> },
};

const fmtDate = (iso: string) =>
  new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString([], {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

export default function EmployeeRequestsView({ user }: { user: any }) {
  const [requests, setRequests] = useState<LeaveRequest[]>(PLACEHOLDER_REQUESTS);

  // Form state
  const [requestType, setRequestType]     = useState<RequestType>('leave');
  const [category, setCategory]           = useState<LeaveCategory>('casual');
  const [fromDate, setFromDate]           = useState('');
  const [toDate, setToDate]               = useState('');
  const [reason, setReason]               = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [expandedId, setExpandedId]       = useState<string | null>(null);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate || !reason.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }
    if (toDate < fromDate) {
      toast.error('End date cannot be before start date.');
      return;
    }

    setSubmitting(true);
    // TODO: Replace with real API call to submit the request
    await new Promise(r => setTimeout(r, 800)); // Simulated network delay

    const newReq: LeaveRequest = {
      id: `REQ-${String(requests.length + 1).padStart(3, '0')}`,
      type: requestType,
      category,
      fromDate,
      toDate,
      reason: reason.trim(),
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };

    setRequests(prev => [newReq, ...prev]);
    setFromDate(''); setToDate(''); setReason('');
    setSubmitting(false);

    toast.success('Request submitted', {
      description: 'Your request has been sent for approval.',
      icon: <CheckCircle2 className="text-emerald-500" size={18} />,
    });
  };

  const pending  = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="h-full w-full bg-[#020202] text-zinc-100 font-sans overflow-y-auto flex flex-col p-6 gap-6 custom-scrollbar">

      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-black text-white tracking-tight">My Requests</h1>
        <p className="text-xs text-zinc-500 mt-1 font-medium uppercase tracking-widest">
          Apply for leave or permission · Check status
        </p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-shrink-0">
        {[
          { label: 'Pending',  value: pending,  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Approved', value: approved, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Rejected', value: rejected, color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest ${s.bg}`}>
            <span className={`text-lg font-black ${s.color}`}>{s.value}</span>
            <span className="text-zinc-500">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-6 flex-1 min-h-0">

        {/* ── Submit Form ────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4">
          <div className="bg-zinc-950/60 border border-white/[0.06] rounded-2xl p-5 shadow-xl backdrop-blur-xl">
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">New Request</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Request Type */}
              <div className="flex gap-2">
                {(['leave', 'permission'] as RequestType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRequestType(t)}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all duration-300 ${
                      requestType === t
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'text-zinc-500 border-zinc-800/50 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    {t === 'leave' ? '🗓 Leave' : '⏱ Permission'}
                  </button>
                ))}
              </div>

              {/* Category */}
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as LeaveCategory)}
                  className="w-full bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-300 focus:outline-none focus:border-emerald-500/40 appearance-none cursor-pointer"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>

              {/* Date Range */}
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">From</label>
                  <input
                    type="date"
                    min={todayStr}
                    value={fromDate}
                    onChange={e => { setFromDate(e.target.value); if (!toDate) setToDate(e.target.value); }}
                    className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2 text-xs font-bold text-zinc-300 focus:outline-none focus:border-emerald-500/40 w-full [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-40 cursor-pointer"
                    required
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">To</label>
                  <input
                    type="date"
                    min={fromDate || todayStr}
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2 text-xs font-bold text-zinc-300 focus:outline-none focus:border-emerald-500/40 w-full [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-40 cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Reason</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Briefly describe your reason..."
                  rows={4}
                  className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-4 py-3 text-xs font-medium text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-[1.02]"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl px-4 py-3">
            <AlertCircle size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Requests are reviewed by your manager. You'll be notified once a decision is made.
            </p>
          </div>
        </div>

        {/* ── Request History ──────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex-shrink-0">Request History</h2>

          {requests.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-3">
              <FileText size={32} />
              <p className="text-sm font-bold">No requests yet</p>
            </div>
          )}

          {requests.map(req => {
            const sc = STATUS_CONFIG[req.status];
            const isExpanded = expandedId === req.id;
            const isMultiDay = req.fromDate !== req.toDate;

            return (
              <button
                key={req.id}
                onClick={() => setExpandedId(isExpanded ? null : req.id)}
                className="w-full text-left bg-zinc-950/60 border border-white/[0.05] hover:border-white/10 rounded-2xl p-4 transition-all duration-300 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{req.id}</span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                      <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                        {req.type === 'leave' ? '🗓 Leave' : '⏱ Permission'} · {CATEGORY_LABELS[req.category]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
                      <CalendarDays size={12} className="text-zinc-600" />
                      {isMultiDay
                        ? `${fmtDate(req.fromDate)} → ${fmtDate(req.toDate)}`
                        : fmtDate(req.fromDate)
                      }
                    </div>

                    <p className={`text-xs text-zinc-500 line-clamp-1 transition-all ${isExpanded ? 'line-clamp-none' : ''}`}>
                      {req.reason}
                    </p>

                    {isExpanded && req.adminNote && (
                      <div className={`mt-2 flex items-start gap-2 px-3 py-2 rounded-xl border text-[11px] font-medium ${sc.color}`}>
                        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                        <span><span className="font-black">Admin note: </span>{req.adminNote}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                      <Clock size={10} />
                      {new Date(req.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                    <ChevronDown
                      size={14}
                      className={`text-zinc-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
