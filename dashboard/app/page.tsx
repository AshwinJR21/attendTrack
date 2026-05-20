"use client";

import React, { useState, useEffect } from 'react';
import ProgressTracker from '@/components/ProgressTracker';
import RequestsView from '@/components/RequestsView';
import AnalyticsView from '@/components/AnalyticsView';
import EmployeeRequestsView from '@/components/EmployeeRequestsView';
import EmployeeLeaveStats from '@/components/EmployeeLeaveStats';
import LoginModal from '@/components/LoginModal';
import { 
  LayoutDashboard, 
  ClipboardList, 
  BarChart3, 
  LogIn, 
  LogOut, 
  ShieldCheck,
  ArrowRight,
  XCircle,
  AlertTriangle,
  LineChart,
} from 'lucide-react';
import { toast } from 'sonner';
import { logoutUser } from '@/lib/api';

type Tab = 'dashboard' | 'requests' | 'analytics' | 'emp-requests' | 'emp-stats';

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Inactivity and absolute session timeout state
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(10);

  const INACTIVITY_LIMIT = 2 * 60 * 1000; // 2 minutes in milliseconds
  const WARNING_COUNTDOWN = 10;           // 10 seconds warning
  const SESSION_LIMIT = 10 * 60 * 1000;   // 10 minutes absolute limit

  // Reset inactivity timer on user interaction
  const resetInactivityTimer = () => {
    if (!sessionStorage.getItem('user')) return;
    sessionStorage.setItem('lastActiveTime', Date.now().toString());
  };

  useEffect(() => {
    // Clear legacy localStorage just to be completely clean
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }

    const stored = sessionStorage.getItem('user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user && (user.role === 'admin' || user.role === 'manager' || user.role === 'employee')) {
          setIsLoggedIn(true);
          setCurrentUser(user);
        }
      } catch (e) {
        sessionStorage.removeItem('user');
      }
    }

    const storedTab = localStorage.getItem('activeTab');
    const validTabs: Tab[] = ['dashboard', 'requests', 'analytics', 'emp-requests', 'emp-stats'];
    if (storedTab && validTabs.includes(storedTab as Tab)) {
      setActiveTab(storedTab as Tab);
    }
  }, []);

  const changeTab = (tab: Tab) => {
    setActiveTab(tab);
    localStorage.setItem('activeTab', tab);
  };

  const handleLogout = async (isAbsolute?: boolean) => {
    try {
      await logoutUser();
    } catch (e) {
      console.error("Failed to invalidate session cookie on logout:", e);
    }

    setIsLoggedIn(false);
    setCurrentUser(null);
    setShowInactivityWarning(false);
    
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('sessionStartTime');
    sessionStorage.removeItem('lastActiveTime');
    
    // Clear legacy localStorage in case it's still there
    localStorage.removeItem('user');
    
    setActiveTab('dashboard');

    if (isAbsolute) {
      toast.error('Session Expired', {
        description: 'Session ended, please relogin.',
        icon: <XCircle className="text-rose-500" size={18} />,
        duration: 8000,
      });
    } else {
      toast.info('Session Terminated', {
        description: 'Operator logged out successfully. Tactical systems secured.',
        icon: <LogOut className="text-rose-500" size={18} />,
      });
    }
  };

  // Setup user interaction event listeners to reset inactivity
  useEffect(() => {
    if (!isLoggedIn) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'click', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isLoggedIn]);

  // Periodic check for absolute session duration and inactivity limit
  useEffect(() => {
    if (!isLoggedIn) return;

    // Seed session metrics if missing
    if (!sessionStorage.getItem('sessionStartTime')) {
      sessionStorage.setItem('sessionStartTime', Date.now().toString());
    }
    if (!sessionStorage.getItem('lastActiveTime')) {
      sessionStorage.setItem('lastActiveTime', Date.now().toString());
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const sessionStart = parseInt(sessionStorage.getItem('sessionStartTime') || '0', 10);
      const lastActive = parseInt(sessionStorage.getItem('lastActiveTime') || '0', 10);

      // Check 10 minutes absolute limit first
      if (sessionStart > 0 && (now - sessionStart >= SESSION_LIMIT)) {
        clearInterval(interval);
        handleLogout(true);
        return;
      }

      // Check 2 minutes inactivity timeout
      if (lastActive > 0 && !showInactivityWarning) {
        if (now - lastActive >= INACTIVITY_LIMIT) {
          setShowInactivityWarning(true);
          setWarningCountdown(WARNING_COUNTDOWN);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoggedIn, showInactivityWarning]);

  // Handle inactivity warning 10 seconds countdown
  useEffect(() => {
    if (!showInactivityWarning) return;

    const timer = setInterval(() => {
      setWarningCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowInactivityWarning(false);
          handleLogout(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showInactivityWarning]);

  const keepSessionActive = () => {
    setShowInactivityWarning(false);
    sessionStorage.setItem('lastActiveTime', Date.now().toString());
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
                <div className="absolute top-12 right-0 w-52 bg-zinc-950/90 backdrop-blur-2xl border border-white/[0.05] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-200">

                  {/* Always: Dashboard */}
                  <DropdownItem 
                    active={activeTab === 'dashboard'} 
                    onClick={() => { changeTab('dashboard'); setIsDropdownOpen(false); }} 
                    icon={<LayoutDashboard size={16} />} 
                    label="Dashboard" 
                  />

                  {/* Admin / Manager nav */}
                  {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                    <>
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
                    </>
                  )}

                  {/* Employee nav */}
                  {currentUser?.role === 'employee' && (
                    <>
                      <DropdownItem 
                        active={activeTab === 'emp-requests'} 
                        onClick={() => { changeTab('emp-requests'); setIsDropdownOpen(false); }} 
                        icon={<ClipboardList size={16} />} 
                        label="Requests" 
                      />
                      <DropdownItem 
                        active={activeTab === 'emp-stats'} 
                        onClick={() => { changeTab('emp-stats'); setIsDropdownOpen(false); }} 
                        icon={<LineChart size={16} />} 
                        label="Leave Stats" 
                      />
                    </>
                  )}

                  <div className="h-px bg-white/[0.05] my-1.5"></div>
                  <button 
                    onClick={() => { handleLogout(false); setIsDropdownOpen(false); }}
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
        {activeTab === 'dashboard'     && <ProgressTracker />}
        {activeTab === 'requests'      && <RequestsView />}
        {activeTab === 'analytics'     && <AnalyticsView />}
        {activeTab === 'emp-requests'  && <EmployeeRequestsView user={currentUser} />}
        {activeTab === 'emp-stats'     && <EmployeeLeaveStats user={currentUser} />}
      </div>

      {/* Login Modal Overlay */}
      {showLoginModal && (
        <LoginModal 
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={(user) => {
            setIsLoggedIn(true);
            setCurrentUser(user);
            setShowLoginModal(false);
            
            // Seed session start metrics
            const now = Date.now();
            sessionStorage.setItem('sessionStartTime', now.toString());
            sessionStorage.setItem('lastActiveTime', now.toString());

            toast.success('Authentication Successful', {
              description: `Welcome back, ${user.name}! Operational session initiated.`,
              icon: <ShieldCheck className="text-emerald-500" size={18} />,
            });
          }}
        />
      )}

      {/* Premium Glassmorphic Inactivity Warning Overlay */}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-xl bg-black/80 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-zinc-950/70 border border-white/5 rounded-[40px] p-10 shadow-2xl overflow-hidden flex flex-col items-center relative animate-in zoom-in-95 duration-300">
            {/* Pulsing Alert Icon */}
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-6 animate-bounce">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>

            <h2 className="text-2xl font-black text-white text-center uppercase tracking-tight mb-2">
              Are you still there?
            </h2>
            <p className="text-zinc-400 text-sm text-center font-medium mb-8 leading-relaxed max-w-[280px]">
              Your administrative session is about to expire due to inactivity.
            </p>

            {/* Circular Countdown Ring */}
            <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  className="stroke-emerald-500 fill-none stroke-[4] transition-all duration-1000"
                  strokeDasharray="276.46"
                  strokeDashoffset={276.46 - (276.46 * warningCountdown) / 10}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] animate-pulse">
                {warningCountdown}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-3">
              <button
                onClick={keepSessionActive}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:scale-[1.02] cursor-pointer"
              >
                Keep Session Active
              </button>
              <button
                onClick={() => handleLogout(false)}
                className="w-full bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-500 text-zinc-400 font-bold py-4 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-[1.01] cursor-pointer"
              >
                Sign Out
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




