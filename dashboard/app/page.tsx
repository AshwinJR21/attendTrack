"use client";

import React, { useState, useEffect } from 'react';
import ProgressTracker from '@/components/ProgressTracker';
import RequestsView from '@/components/RequestsView';
import AnalyticsView from '@/components/AnalyticsView';
import LoginModal from '@/components/LoginModal';
import { 
  LayoutDashboard, 
  ClipboardList, 
  BarChart3, 
  LogIn, 
  LogOut, 
  ShieldCheck,
  ArrowRight,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'dashboard' | 'requests' | 'analytics';

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);



  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user && (user.role === 'admin' || user.role === 'manager' || user.role === 'employee')) {
          setIsLoggedIn(true);
          setCurrentUser(user);
        }
      } catch (e) {
        localStorage.removeItem('user');
      }
    }

    const storedTab = localStorage.getItem('activeTab');
    if (storedTab === 'dashboard' || storedTab === 'requests' || storedTab === 'analytics') {
      setActiveTab(storedTab);
    }
  }, []);

  const changeTab = (tab: Tab) => {
    setActiveTab(tab);
    localStorage.setItem('activeTab', tab);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('activeTab');
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
                    onClick={() => { changeTab('dashboard'); setIsDropdownOpen(false); }} 
                    icon={<LayoutDashboard size={16} />} 
                    label="Dashboard" 
                  />
                  <DropdownItem 
                    active={activeTab === 'requests'} 
                    onClick={() => { changeTab('requests'); setIsDropdownOpen(false); }} 
                    icon={<ClipboardList size={16} />} 
                    label="Requests" 
                  />
                  <DropdownItem 
                    active={activeTab === 'analytics'} 
                    onClick={() => { changeTab('analytics'); setIsDropdownOpen(false); }} 
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
        <LoginModal 
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={(user) => {
            setIsLoggedIn(true);
            setCurrentUser(user);
            setShowLoginModal(false);
            toast.success('Authentication Successful', {
              description: `Welcome back, ${user.name}! Operational session initiated.`,
              icon: <ShieldCheck className="text-emerald-500" size={18} />,
            });
          }}
        />
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




