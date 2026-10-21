import React, { useState } from 'react';
import { 
  Store, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  KeyRound,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    const result = await login(username.trim(), password);
    if (result.success && onLoginSuccess) {
      onLoginSuccess(result.user);
    }
  };

  const handleQuickFill = (u, p) => {
    clearError();
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen w-screen bg-[#0F172A] flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Top Application Header */}
      <header className="h-16 px-8 flex items-center justify-between border-b border-slate-800/80 z-10 backdrop-blur-sm bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 ring-1 ring-white/20">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wider text-white">ANANTHA STORES</span>
              <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                POS Desktop
              </span>
            </div>
            <p className="text-[11px] text-blue-200/90 font-tamil font-semibold">
              ஆனந்தா ஸ்டோர்
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>SYSTEM READY</span>
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition duration-300">
          {/* Card Brand Header */}
          <div className="bg-gradient-to-b from-slate-50 to-white px-8 pt-8 pb-6 border-b border-slate-100 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4 ring-4 ring-blue-50">
              <Store className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Sign In to Terminal
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your credentials to access the POS terminal
            </p>
          </div>

          {/* Form */}
          <div className="p-8 space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200/80 flex items-start gap-3 text-red-700 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-xs font-medium leading-relaxed flex-1">
                  {error}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Username or ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      clearError();
                      setUsername(e.target.value);
                    }}
                    placeholder="Enter your username"
                    required
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      clearError();
                      setPassword(e.target.value);
                    }}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition duration-150 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Credentials for Fast Evaluation */}
            <div className="pt-4 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Role Selection (Testing)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin', 'admin123')}
                  className="px-2.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 text-xs font-semibold text-center transition flex flex-col items-center"
                >
                  <span className="font-bold">ADMIN</span>
                  <span className="text-[10px] text-blue-500 font-normal">Full Control</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('manager', 'manager123')}
                  className="px-2.5 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/60 text-xs font-semibold text-center transition flex flex-col items-center"
                >
                  <span className="font-bold">MANAGER</span>
                  <span className="text-[10px] text-purple-500 font-normal">Reports/Stock</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('cashier', 'cashier123')}
                  className="px-2.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 text-xs font-semibold text-center transition flex flex-col items-center"
                >
                  <span className="font-bold">CASHIER</span>
                  <span className="text-[10px] text-emerald-500 font-normal">Direct Billing</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 px-8 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 z-10 bg-slate-900/40">
        <div>
          <span>ANANTHA STORES | ஆனந்தா ஸ்டோர் • POS System v1.0.0</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Role-Based Authentication Active</span>
        </div>
      </footer>
    </div>
  );
}
