"use client";

import React from 'react';
import { BarChart3, CalendarDays, Clock, TrendingUp, Construction } from 'lucide-react';

export default function EmployeeLeaveStats({ user }: { user: any }) {
  return (
    <div className="h-full w-full bg-[#020202] text-zinc-100 font-sans overflow-y-auto flex flex-col p-6 gap-6">

      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-black text-white tracking-tight">Leave Stats</h1>
        <p className="text-xs text-zinc-500 mt-1 font-medium uppercase tracking-widest">
          Your personal leave & attendance analytics
        </p>
      </div>

      {/* Stat card placeholders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        {[
          { label: 'Leaves Taken',      value: '—', icon: <CalendarDays size={18} />, color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20' },
          { label: 'Permissions Used',  value: '—', icon: <Clock size={18} />,        color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Days Present',       value: '—', icon: <TrendingUp size={18} />,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Avg Hours / Day',    value: '—', icon: <BarChart3 size={18} />,   color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-2xl border p-5 flex flex-col gap-3 ${stat.bg} backdrop-blur-xl`}>
            <div className={stat.color}>{stat.icon}</div>
            <div>
              <p className="text-2xl font-black text-white">{stat.value}</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="flex-1 min-h-0 bg-zinc-950/60 border border-white/[0.05] rounded-2xl flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 flex items-center justify-center">
          <Construction size={28} className="text-zinc-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">Coming Soon</p>
          <p className="text-xs text-zinc-600 mt-2 max-w-sm leading-relaxed">
            Detailed leave analytics, trends, and charts will be displayed here.
            Implementation will be added in a future update.
          </p>
        </div>
      </div>

    </div>
  );
}
