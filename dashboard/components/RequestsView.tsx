"use client";

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { fetchRequests, updateRequestStatus, subscribeToUpdates } from '@/lib/api';
import { toast } from 'sonner';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type RequestType = 'Work from Home' | 'Permission' | 'Medical Leave' | 'Casual Leave';

export interface RequestItem {
  id: string;
  name: string;
  empId: string;
  telegramId: string;
  fromTime: string;
  toTime: string;
  type: RequestType;
  status: RequestStatus;
  originalStatus?: 'approved' | 'rejected' | 'pending';
  timestamp: number;
  dateLabel: string;
  tgRawId: string | number;
}

export default function RequestsView() {
  const stored = typeof window !== 'undefined' ? sessionStorage.getItem('user') : null;
  const user = stored ? JSON.parse(stored) : null;
  const isEmployee = user && user.role === 'employee';
  const isLoggedIn = !!user;

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pending: true,
    approved: false,
    rejected: false,
  });

  const [sectionFilters, setSectionFilters] = useState<Record<string, string>>({
    pending: 'All',
    approved: 'All',
    rejected: 'All',
    expired: 'All',
  });

  const [expiredPageIndex, setExpiredPageIndex] = useState(0);

  const priorityWeights: Record<string, number> = {
    'Work from Home': 4,
    'Permission': 3,
    'Medical Leave': 2,
    'Casual Leave': 1,
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const backendRequests = await fetchRequests('all');
      const mapped = backendRequests.map((req: any) => {
        const fromDate = new Date(req.from);
        const toDate = new Date(req.to);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let dateLabel = 'Today';
        if (fromDate.getTime() > today.getTime()) {
          dateLabel = 'Upcoming';
        } else if (toDate.getTime() < today.getTime()) {
          dateLabel = 'Expired';
        } else if (fromDate.getTime() < today.getTime()) {
          dateLabel = 'Ongoing';
        }

        let status = req.status.toLowerCase() as RequestStatus;
        let originalStatus: 'approved' | 'rejected' | 'pending' | undefined = undefined;

        if (dateLabel === 'Expired') {
          originalStatus = status === 'pending' ? 'pending' : (status === 'approved' ? 'approved' : 'rejected');
          status = 'expired';
        }

        return {
          id: `${req.tg_id}-${req.from}-${req.to}`,
          name: req.name,
          empId: req.emp_id 
            ? (req.emp_id.toString().startsWith('EMP-') 
                ? req.emp_id.toString() 
                : `EMP-${req.emp_id.toString().padStart(4, '0')}`) 
            : '-',
          telegramId: req.tg_id ? String(req.tg_id).trim() : '-',
          fromTime: req.from,
          toTime: req.to,
          type: 'Work from Home' as RequestType,
          status,
          originalStatus,
          timestamp: fromDate.getTime(),
          dateLabel: dateLabel,
          tgRawId: req.tg_id
        };
      });
      setRequests(mapped);
    } catch (err: any) {
      console.error("Failed to load WFH requests:", err);
      toast.error("Failed to load WFH requests: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || isEmployee) {
      setLoading(false);
      return;
    }

    loadRequests();

    // Subscribe to SSE updates so that WFH requests dynamically sync in real-time
    const unsubscribe = subscribeToUpdates(() => {
      console.log("Real-time requests event received! Syncing roster...");
      loadRequests();
    });

    return () => {
      unsubscribe();
    };
  }, [isLoggedIn, isEmployee]);

  const sortRequests = (reqs: RequestItem[]) => {
    return [...reqs].sort((a, b) => {
      if (priorityWeights[a.type] !== priorityWeights[b.type]) {
        return priorityWeights[b.type] - priorityWeights[a.type];
      }
      return b.timestamp - a.timestamp;
    });
  };

  const handleAction = async (id: string, status: RequestStatus) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    
    let apiAction = 'pending';
    if (status === 'approved') apiAction = 'approve';
    else if (status === 'rejected') apiAction = 'reject';
    
    try {
      await updateRequestStatus(apiAction, {
        tg_id: req.tgRawId,
        from: req.fromTime,
        to: req.toTime,
        emp_id: req.empId.replace('EMP-', ''),
        name: req.name,
        status: req.status
      });
      toast.success(`Successfully set request status to ${status}`);
      loadRequests();
    } catch (err: any) {
      toast.error(`Action failed: ${err.message}`);
    }
  };

  const handleBulkAction = async (currentStatus: RequestStatus, targetStatus: RequestStatus) => {
    if (currentStatus !== 'pending') {
      toast.error("Bulk actions are only allowed on pending requests.");
      return;
    }
    
    let apiAction = targetStatus === 'approved' ? 'approve_all' : 'reject_all';
    
    try {
      await updateRequestStatus(apiAction);
      toast.success(`Successfully ${targetStatus} all pending requests`);
      loadRequests();
    } catch (err: any) {
      toast.error(`Bulk action failed: ${err.message}`);
    }
  };

  const renderSection = (title: string, status: RequestStatus) => {
    const isExpired = status === 'expired';
    const filter = sectionFilters[status];
    let filtered = requests.filter(r => r.status === status);
    if (filter !== 'All') {
      filtered = filtered.filter(r => r.type === filter);
    }
    const sorted = sortRequests(filtered);
    const isExpanded = expandedSections[status] || false;
    const displayCount = isExpanded ? sorted.length : 5;
    const visible = isExpired ? sorted.slice(expiredPageIndex * 5, (expiredPageIndex + 1) * 5) : sorted.slice(0, displayCount);
    const hasMore = sorted.length > 5;

    return (
      <div className="mb-20">
        <div className="flex flex-wrap items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">{title}</h3>
            <span className="px-3 py-1 bg-white/[0.05] border border-white/[0.05] rounded-full text-[10px] font-black text-zinc-500">{sorted.length}</span>
            
            {!isExpired && hasMore && (
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, [status]: !isExpanded }))}
                className="flex items-center gap-2 text-emerald-500 hover:text-emerald-400 transition-colors ml-2"
              >
                <span className="text-[10px] font-black uppercase tracking-widest">{isExpanded ? 'Collapse' : 'View All'}</span>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}

            {!isExpired && sorted.length > 0 && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
                {status === 'pending' ? (
                  <>
                    <button 
                      onClick={() => handleBulkAction('pending', 'approved')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/20"
                    >
                      <CheckCircle2 size={12} /> Approve All
                    </button>
                    <button 
                      onClick={() => handleBulkAction('pending', 'rejected')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-black rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/20"
                    >
                      <XCircle size={12} /> Deny All
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => handleBulkAction(status, 'pending')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-amber-500/20"
                  >
                    <RotateCcw size={12} /> Revoke All
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-white/[0.05] ml-auto">
            {['All', 'Work from Home', 'Medical Leave', 'Casual Leave', 'Permission'].map(f => (
              <button
                key={f}
                onClick={() => setSectionFilters(prev => ({ ...prev, [status]: f }))}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f === 'Work from Home' ? 'WFH' : f === 'Medical Leave' ? 'Medical' : f === 'Casual Leave' ? 'Casual' : f}
              </button>
            ))}
          </div>

          {isExpired && hasMore && (
            <div className="flex items-center gap-4 border-l border-white/5 pl-6 ml-6">
              <button
                disabled={expiredPageIndex === 0}
                onClick={() => setExpiredPageIndex(prev => prev - 1)}
                className="p-2 bg-white/[0.05] border border-white/[0.05] rounded-lg text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                {expiredPageIndex + 1} / {Math.ceil(sorted.length / 5)}
              </span>
              <button
                disabled={(expiredPageIndex + 1) * 5 >= sorted.length}
                onClick={() => setExpiredPageIndex(prev => prev + 1)}
                className="p-2 bg-white/[0.05] border border-white/[0.05] rounded-lg text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {visible.map(req => (
            <RequestCard 
              key={req.id} 
              req={req} 
              onAction={(s) => handleAction(req.id, s)} 
            />
          ))}
        </div>
        
        {visible.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-[2rem] bg-white/[0.01]">
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.2em]">No requests in this category</p>
          </div>
        )}
      </div>
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 mb-8">
          <User size={36} className="text-zinc-500 animate-pulse" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-2">Authentication Required</h2>
        <p className="text-sm font-bold text-zinc-500 max-w-sm leading-relaxed uppercase tracking-wider">
          Please log in as an authorized operator (Admin or Manager) to access requests.
        </p>
      </div>
    );
  }

  if (isEmployee) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20 mb-8">
          <Clock size={36} className="text-emerald-500" />
        </div>
        <h2 className="text-2xl font-black text-emerald-400 uppercase tracking-wider mb-2">Employee Portal Coming Soon</h2>
        <p className="text-sm font-medium text-zinc-500 max-w-md leading-relaxed">
          Your personal WFH request logs and new request submission portal are being prepared for a future system update! 
          <span className="block mt-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
            Note: Admin or Manager authorization is required to view the global approval queue.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="w-full px-6 py-8 md:px-10">
        <div className="flex items-center justify-between mb-16 pr-24">
          <div className="space-y-2">
            <h2 className="text-4xl font-black tracking-tight text-white uppercase">Work From Home Requests</h2>
          </div>
        </div>

        {renderSection('Pending Requests', 'pending')}
        {renderSection('Approved Requests', 'approved')}
        {renderSection('Rejected Requests', 'rejected')}
        {renderSection('Expired Requests', 'expired')}
      </div>
    </div>
  );
}

function RequestCard({ req, onAction }: { req: RequestItem, onAction: (s: RequestStatus) => void }) {
  const statusStyles = {
    pending: 'border-white/[0.05] hover:border-white/10',
    approved: 'border-emerald-500/30 bg-emerald-500/[0.02] shadow-[0_0_30px_rgba(16,185,129,0.05)]',
    rejected: 'border-rose-500/30 bg-rose-500/[0.02] shadow-[0_0_30px_rgba(244,63,94,0.05)]',
    expired: 'border-white/[0.03] opacity-50 grayscale-[0.5]',
  };

  const typeColors = {
    'Work from Home': 'group-hover:bg-sky-500 group-hover:border-sky-500 text-sky-500 border-sky-500/20 bg-sky-500/10',
    'Permission': 'group-hover:bg-indigo-500 group-hover:border-indigo-500 text-indigo-500 border-indigo-500/20 bg-indigo-500/10',
    'Medical Leave': 'group-hover:bg-violet-500 group-hover:border-violet-500 text-violet-500 border-violet-500/20 bg-violet-500/10',
    'Casual Leave': 'group-hover:bg-cyan-500 group-hover:border-cyan-500 text-cyan-500 border-cyan-500/20 bg-cyan-500/10',
  };

  return (
    <div className={`bg-zinc-900/30 border rounded-[2rem] p-5 backdrop-blur-xl transition-all duration-500 group relative overflow-hidden flex flex-col h-full ${statusStyles[req.status]}`}>
      <div className="flex items-start justify-between mb-6 h-16">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 flex-shrink-0 group-hover:text-black ${typeColors[req.type]}`}>
            <User size={24} />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-2xl font-black text-white leading-tight line-clamp-2">{req.name}</span>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">{req.empId}</span>
          </div>
        </div>
        <div className="pt-1 flex-shrink-0">
          <span className={`px-3 py-1 ${
            req.status === 'expired' 
              ? (req.originalStatus === 'approved' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : req.originalStatus === 'rejected'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20')
              : (req.dateLabel === 'Today' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20')
          } border text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-black/20`}>
            {req.status === 'expired' 
              ? (req.originalStatus === 'approved' 
                  ? 'Expired (Approved)' 
                  : req.originalStatus === 'rejected'
                    ? 'Expired (Denied)'
                    : 'Expired (No Action Taken)')
              : req.dateLabel}
          </span>
        </div>
      </div>
      
      <div className="space-y-4 mb-8 flex-1">
        <div className="bg-black/40 rounded-2xl p-4 border border-white/[0.03] flex items-center justify-between">
          <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Type</span>
          <span className="text-base font-black text-white uppercase">{req.type}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/40 rounded-2xl p-4 border border-white/[0.03]">
            <p className="text-[10px] font-black text-zinc-500 mb-1 uppercase tracking-widest">From</p>
            <p className="text-base text-white font-black">{req.fromTime}</p>
          </div>
          <div className="bg-black/40 rounded-2xl p-4 border border-white/[0.03]">
            <p className="text-[10px] font-black text-zinc-500 mb-1 uppercase tracking-widest">To</p>
            <p className="text-base text-white font-black">{req.toTime}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-auto">
        {req.status === 'pending' ? (
          <>
            <button onClick={() => onAction('approved')} className="py-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border border-emerald-500/20 flex items-center justify-center gap-2">
              <CheckCircle2 size={12} /> Approve
            </button>
            <button onClick={() => onAction('rejected')} className="py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border border-rose-500/20 flex items-center justify-center gap-2">
              <XCircle size={12} /> Deny
            </button>
          </>
        ) : (req.status === 'approved' || req.status === 'rejected') ? (
          <button onClick={() => onAction('pending')} className="col-span-2 py-3 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border border-amber-500/20 flex items-center justify-center gap-2">
            <RotateCcw size={12} /> Revoke Action
          </button>
        ) : null}
      </div>
    </div>
  );
}
