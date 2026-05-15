"use client";

import React, { useState, useEffect } from 'react';
import ProgressTracker from '@/components/ProgressTracker';
import RequestsView from '@/components/RequestsView';
import AnalyticsView from '@/components/AnalyticsView';
import { 
  LayoutDashboard, 
  ClipboardList, 
  BarChart3, 
  User, 
  LogIn, 
  LogOut, 
  ShieldCheck,
  Search,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'dashboard' | 'requests' | 'analytics';

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'test' && password === 'test') {
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setLoginError('');
      setUsername('');
      setPassword('');
      toast.success('Authentication Successful', {
        description: 'Operator session initiated. Access granted to tactical dashboard.',
        icon: <ShieldCheck className="text-emerald-500" size={18} />,
      });
    } else {
      setLoginError('Invalid credentials. Tactical override failed.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab('dashboard');
    toast.info('Session Terminated', {
      description: 'Operator logged out successfully. Tactical systems secured.',
      icon: <LogOut className="text-rose-500" size={18} />,
    });
  };

  return (
    <main className="min-h-screen bg-[#020202] text-zinc-100 selection:bg-emerald-500/30 overflow-x-hidden overflow-y-hidden">
      {/* Integrated Global Header Dropdown */}
      <div className="fixed top-6 right-10 z-[100]">
        {!isLoggedIn ? (
          <button 
            onClick={() => setShowLoginModal(true)}
            className="flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-900/80 border border-white/[0.05] hover:bg-white/[0.05] text-zinc-400 hover:text-white transition-all duration-300 shadow-2xl backdrop-blur-xl"
            title="Operator Login"
          >
            <LogIn size={20} />
          </button>
        ) : (
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 border backdrop-blur-xl ${
                isDropdownOpen ? 'bg-emerald-500 text-black border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-zinc-900/80 border-white/[0.05] text-emerald-500 hover:bg-white/[0.05]'
              }`}
              title="Command Menu"
            >
              <ShieldCheck size={20} />
            </button>

            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-[-1]" 
                  onClick={() => setIsDropdownOpen(false)}
                ></div>
                <div className="absolute top-12 right-0 w-48 bg-zinc-950/90 backdrop-blur-2xl border border-white/[0.05] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-200">
                  <DropdownItem 
                    active={activeTab === 'dashboard'} 
                    onClick={() => { setActiveTab('dashboard'); setIsDropdownOpen(false); }} 
                    icon={<LayoutDashboard size={16} />} 
                    label="Dashboard" 
                  />
                  <DropdownItem 
                    active={activeTab === 'requests'} 
                    onClick={() => { setActiveTab('requests'); setIsDropdownOpen(false); }} 
                    icon={<ClipboardList size={16} />} 
                    label="Requests" 
                  />
                  <DropdownItem 
                    active={activeTab === 'analytics'} 
                    onClick={() => { setActiveTab('analytics'); setIsDropdownOpen(false); }} 
                    icon={<BarChart3 size={16} />} 
                    label="Analytics" 
                  />
                  <div className="h-px bg-white/[0.05] my-1.5"></div>
                  <button 
                    onClick={() => { handleLogout(); setIsDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all duration-300 group"
                  >
                    <LogOut size={16} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="h-screen w-screen overflow-hidden">
        {activeTab === 'dashboard' && <ProgressTracker />}
        {activeTab === 'requests' && <RequestsView />}
        {activeTab === 'analytics' && <AnalyticsView />}
      </div>

      {/* Login Modal Overlay */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md bg-black/60">
          <div className="relative w-full max-w-md bg-[#0a0a0a] border border-white/[0.05] rounded-[3rem] p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden group">
            {/* Background decorative elements */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]"></div>
            
            <div className="relative z-10">
              <div className="flex flex-col items-center mb-10">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-700">
                  <ShieldCheck className="text-emerald-400 w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white mb-2">Tactical Authentication</h2>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">Enter Operator Credentials</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Identifier</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:border-emerald-500/40 transition-all placeholder:text-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Access Code</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:border-emerald-500/40 transition-all placeholder:text-zinc-700"
                  />
                </div>

                {loginError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3 text-rose-500 text-xs font-bold">
                    <XCircle size={16} />
                    <span>{loginError}</span>
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.2em] text-xs py-5 rounded-2xl transition-all duration-300 shadow-[0_10px_30px_rgba(16,185,129,0.2)] active:scale-95 group flex items-center justify-center gap-3"
                >
                  Initiate Session
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </form>

              <button 
                onClick={() => setShowLoginModal(false)}
                className="w-full mt-6 text-zinc-600 hover:text-zinc-400 text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                Cancel Override
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DropdownItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${
        active 
          ? 'bg-emerald-500/10 text-emerald-500' 
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]'
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
      <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
      {active && (
        <div className="ml-auto w-1 h-1 bg-emerald-500 rounded-full"></div>
      )}
    </button>
  );
}

function NavButton({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`relative flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-500 group ${
        active 
          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]'
      }`}
    >
      <div className={`transition-transform duration-500 ${active ? 'scale-110' : 'group-hover:scale-110 opacity-70 group-hover:opacity-100'}`}>
        {icon}
      </div>
      <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
      {badge && (
        <span className="bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
          {badge}
        </span>
      )}
      {active && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
      )}
    </button>
  );
}




