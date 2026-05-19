"use client";

import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Calendar, 
  ShieldAlert, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Filter,
  Download
} from 'lucide-react';

// Real-ready definitions (cleared mock data)
const STATS = [
  { label: 'Attendance Rate', value: '-', change: '-', trending: 'neutral', color: 'emerald' },
  { label: 'Avg Lateness', value: '-', change: '-', trending: 'neutral', color: 'rose' },
  { label: 'WFH Adoption', value: '-', change: '-', trending: 'neutral', color: 'sky' },
  { label: 'Active Personnel', value: '-', change: '-', trending: 'neutral', color: 'amber' },
];

const RECENT_ALERTS: any[] = [];

export default function AnalyticsView() {
  const [timeRange, setTimeRange] = useState('This Month');
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="w-full h-full bg-[#020202] text-zinc-100 overflow-y-auto custom-scrollbar selection:bg-emerald-500/30">
      <div className="w-full px-6 py-8 md:px-10 space-y-10 max-w-[1600px] mx-auto pb-32">
        
        {/* Clean Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-500 mb-2">
              <ShieldAlert size={14} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Operational Intelligence</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight uppercase">Tactical Analytics</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center bg-zinc-900/50 p-1 rounded-xl border border-white/5">
              {['7D', '30D', '1Y', 'Custom'].map(t => (
                <button 
                  key={t}
                  onClick={() => setTimeRange(t)}
                  className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    timeRange === t ? 'bg-white/10 text-white shadow-xl' : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button className="p-3 bg-zinc-900/50 border border-white/5 rounded-xl text-zinc-500 hover:text-white transition-all">
              <Download size={18} />
            </button>
          </div>
        </div>

        {/* Section 1: KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((stat, i) => (
            <div key={i} className="group bg-zinc-900/20 border border-white/5 rounded-3xl p-6 hover:bg-zinc-900/40 transition-all duration-500 relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-32 h-32 opacity-[0.03] -mr-8 -mt-8 bg-${stat.color}-500 rounded-full blur-3xl group-hover:opacity-[0.08] transition-opacity`}></div>
              
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{stat.label}</p>
                <div className={`px-2 py-1 rounded-md text-[9px] font-black flex items-center gap-1 ${
                  stat.trending === 'up' ? 'text-emerald-500 bg-emerald-500/10' : 
                  stat.trending === 'down' ? 'text-rose-500 bg-rose-500/10' : 
                  'text-zinc-500 bg-white/5'
                }`}>
                  {stat.trending === 'up' && <ArrowUpRight size={10} />}
                  {stat.trending === 'down' && <ArrowDownRight size={10} />}
                  {stat.change}
                </div>
              </div>
              <p className="text-4xl font-black text-white mb-2">{stat.value}</p>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mt-4">
                <div className={`h-full bg-${stat.color === 'emerald' ? 'emerald' : stat.color === 'rose' ? 'rose' : stat.color === 'sky' ? 'sky' : 'amber'}-500 rounded-full`} style={{ width: '65%' }}></div>
              </div>
            </div>
          ))}
        </div>

        {/* Section 2: Primary Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Attendance Flow */}
          <div className="bg-zinc-900/20 border border-white/5 rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/20">
                  <Activity size={18} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Attendance Flow</h3>
              </div>
              <button className="text-[10px] font-black text-zinc-500 hover:text-white uppercase flex items-center gap-1">
                View Log <ChevronRight size={12} />
              </button>
            </div>
            
            <div className="h-48 flex items-center justify-center border border-dashed border-white/5 rounded-[2rem] bg-white/[0.01]">
              <span className="text-zinc-600 text-xs font-bold uppercase tracking-[0.2em]">-</span>
            </div>
            <div className="flex justify-between mt-6 text-[8px] font-black text-zinc-700 uppercase tracking-widest border-t border-white/5 pt-6 px-2">
              <span>14 Days Ago</span>
              <span>Today</span>
            </div>
          </div>

          {/* Time Distribution */}
          <div className="bg-zinc-900/20 border border-white/5 rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-500 border border-sky-500/20">
                  <TrendingUp size={18} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Time Performance</h3>
              </div>
              <div className="flex gap-4">
                <LegendItem color="bg-emerald-500" label="IN Time" />
                <LegendItem color="bg-sky-500" label="OUT Time" />
              </div>
            </div>

            <div className="h-48 flex items-center justify-center border border-dashed border-white/5 rounded-[2rem] bg-white/[0.01]">
              <span className="text-zinc-600 text-xs font-bold uppercase tracking-[0.2em]">-</span>
            </div>
          </div>
        </div>

        {/* Section 3: Manager Watchlist & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-zinc-900/20 border border-white/5 rounded-[2.5rem] p-8 overflow-hidden relative group">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500 border border-rose-500/20">
                  <ShieldAlert size={16} />
                </div>
                Operational Watchlist
              </h3>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-white/[0.05] border border-white/5 text-zinc-500 text-[9px] font-black rounded-full uppercase tracking-widest">- High Risk</span>
              </div>
            </div>

            <div className="space-y-4">
              {RECENT_ALERTS.map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] transition-all group/item">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-zinc-500 font-black text-xs uppercase group-hover/item:text-white transition-colors">
                      {alert.user.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-white">{alert.user}</span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${
                          alert.severity === 'high' ? 'bg-rose-500/10 text-rose-500' : 
                          alert.severity === 'medium' ? 'bg-amber-500/10 text-amber-500' : 
                          'bg-sky-500/10 text-sky-500'
                        }`}>
                          {alert.type}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-zinc-500">{alert.desc}</p>
                    </div>
                  </div>
                  <button className="p-3 hover:bg-white/10 rounded-xl transition-all text-zinc-600 hover:text-white">
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              ))}
              {RECENT_ALERTS.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-[2rem] bg-white/[0.01]">
                  <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.2em]">-</p>
                </div>
              )}
            </div>
          </div>

          {/* Leave Utilization Mini-Widget */}
          <div className="bg-zinc-900/20 border border-white/5 rounded-[2.5rem] p-8 flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest text-white mb-8 flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
                <Calendar size={16} />
              </div>
              Leave Quotas
            </h3>
            
            <div className="space-y-8 flex-1">
              <QuotaItem label="Medical Leave" color="rose" />
              <QuotaItem label="Casual Leave" color="amber" />
              <QuotaItem label="Permissions" color="sky" />
            </div>

            <div className="mt-10 pt-8 border-t border-white/5">
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Team Efficiency</p>
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-black text-white">-</p>
                  <p className="text-[10px] font-black text-zinc-500">-</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`}></div>
      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function QuotaItem({ label, color }: { label: string, color: 'rose' | 'amber' | 'sky' }) {
  const colors = {
    rose: 'bg-rose-500/25',
    amber: 'bg-amber-500/25',
    sky: 'bg-sky-500/25'
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
        <p className="text-xs font-black text-zinc-500">-</p>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colors[color]} rounded-full transition-all duration-1000`} 
          style={{ width: `0%` }}
        ></div>
      </div>
    </div>
  );
}
