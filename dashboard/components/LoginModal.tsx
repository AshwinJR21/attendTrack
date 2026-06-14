'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, User, ArrowRight, Smartphone, CheckCircle2 } from 'lucide-react';
import { checkUserRole, loginUser, requestOtp, resetPassword, verifyOtp } from '@/lib/api';
import { toast } from 'sonner';

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
}

export default function LoginModal({ onClose, onLoginSuccess }: LoginModalProps) {
  const [step, setStep] = useState<'identify' | 'password' | 'otp-request' | 'otp-verify' | 'new-password'>('identify');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [roleData, setRoleData] = useState<any>(null);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return;
    
    setIsLoading(true);
    try {
      const data = await checkUserRole(identifier);
      setRoleData(data);
      if (data.login_allowed) {
        setStep('password');
      } else {
        toast.error(`Access Denied: ${data.name} is an Employee. Only Admins and Managers can log in.`);
      }
    } catch (error: any) {
      toast.error(error.message || "User not found");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await loginUser(identifier, password);
      toast.success(`Welcome back, ${res.user.name}!`);
      localStorage.removeItem('user'); // ensure legacy localStorage is cleared
      sessionStorage.setItem('user', JSON.stringify(res.user));
      onLoginSuccess(res.user);
    } catch (error: any) {
      toast.error(error.message || "Invalid password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setIsLoading(true);
    try {
      await requestOtp(identifier);
      toast.success("OTP sent to your Telegram!");
      setStep('otp-verify');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await verifyOtp(roleData.id, otp);
      setStep('new-password');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await resetPassword(roleData.id, otp, newPassword);
      toast.success("Password updated successfully! Please login.");
      setStep('password');
      setPassword('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md bg-black/60 animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 z-[-1]" 
        onClick={onClose}
      ></div>
      
      <div className="w-full max-w-md relative animate-in zoom-in-95 duration-300">
        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-[40px] p-10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10 group hover:border-emerald-500/50 transition-all duration-500">
              <Shield className="w-8 h-8 text-emerald-400 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-2">Realworks</h1>
            <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]">Management System</p>
          </div>

          {/* Form Step: Identify */}
          {step === 'identify' && (
            <form onSubmit={handleIdentify} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Employee Name or ID</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input
                    autoFocus
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your Name or ID"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  />
                </div>
              </div>
              <button
                disabled={isLoading || !identifier}
                className="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all duration-300 disabled:opacity-50 disabled:hover:bg-white group"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Form Step: Password */}
          {step === 'password' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 mb-6">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{roleData.role}</p>
                  <p className="text-sm font-black text-white">{roleData.name}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setStep('identify')}
                  className="ml-auto text-xs text-zinc-500 hover:text-white font-bold"
                >
                  Change
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input
                    autoFocus
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  />
                </div>
              </div>

              <button
                disabled={isLoading || !password}
                className="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all duration-300 disabled:opacity-50 group"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                ) : (
                  <>
                    Login
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRequestOtp}
                className="w-full text-[11px] font-black text-zinc-500 hover:text-emerald-400 uppercase tracking-widest transition-colors"
              >
                Forgot or Set Password?
              </button>
            </form>
          )}

          {/* Form Step: OTP Verify */}
          {step === 'otp-verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-black mb-1">Verify Telegram OTP</h3>
                <p className="text-xs text-zinc-500">Enter the 6-digit code sent to your bot.</p>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <input
                    autoFocus
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 text-center text-2xl font-black tracking-[0.5em] text-white placeholder:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              <button
                disabled={otp.length !== 6 || isLoading}
                className="w-full bg-blue-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-400 transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  "Verify OTP"
                )}
              </button>
              
              <button
                type="button"
                onClick={() => setStep('password')}
                className="w-full text-[11px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors"
              >
                Back to Login
              </button>
            </form>
          )}

          {/* Form Step: New Password */}
          {step === 'new-password' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-black mb-1">Set New Password</h3>
                <p className="text-xs text-zinc-500">Choose a strong password for your account.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">New Password</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input
                    autoFocus
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  />
                </div>
              </div>

              <button
                disabled={isLoading || newPassword.length < 4}
                className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  "Update Password"
                )}
              </button>
            </form>
          )}
        </div>
        
        {/* Footer info */}
        <div className="mt-8 flex flex-col items-center gap-4">
        </div>
      </div>
    </div>
  );
}
