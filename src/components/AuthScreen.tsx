import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Compass,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Moon,
  ShieldCheck,
  Sun,
  Waves,
} from 'lucide-react';
import { loginSchema } from '../types/kmfri.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { KmfriLogo } from './KmfriLogo.tsx';

// Generated crystal-clear photograph of the Kenyan Coastline
import kenyanCoastImg from '../assets/images/kenyan_coast_login_1790951761903.jpg';

type LoginFormValues = z.infer<typeof loginSchema>;

export function AuthScreen() {
  const { loginWithEmail } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'login' | 'reset_request' | 'reset_confirm'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onLoginSubmit = async (values: LoginFormValues) => {
    setAuthError(null);
    setSubmitting(true);
    try {
      await loginWithEmail(values.email, values.password);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset request failed');
      setGeneratedCode(data.verification_code);
      setVerificationCode(data.verification_code);
      setAuthNotice(`Verification code generated for ${resetEmail}: ${data.verification_code}`);
      setMode('reset_confirm');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/confirm-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          verification_code: verificationCode,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset failed');
      setAuthNotice('Password reset successful. Sign in with your updated password.');
      setValue('email', resetEmail);
      setValue('password', newPassword);
      setMode('login');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Left Institutional Marine Identity & Clear Kenyan Coast Column */}
      <div className="lg:w-7/12 bg-[#0A2540] text-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-sky-900/50">
        {/* Scenic High-Clarity Kenyan Coast Image as Background Layer with Marine Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={kenyanCoastImg}
            alt="Kenyan Coastline, Diani Beach and Mombasa Marine National Park"
            className="w-full h-full object-cover object-center opacity-30 mix-blend-luminosity scale-105 filter brightness-110 contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A2540] via-[#0A2540]/85 to-[#0A2540]/70 backdrop-blur-[1px]" />
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 18% 22%, #0284c7 0%, transparent 50%), radial-gradient(circle at 82% 78%, #0d9488 0%, transparent 55%)',
            }}
          />
        </div>

        {/* Content over background */}
        <div className="relative z-10 space-y-6">
          {/* Top Brand Header with Official KMFRI Logo */}
          <div className="flex items-center justify-between">
            <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 shadow-md">
              <KmfriLogo variant="full" size="md" />
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-sky-700/60 bg-sky-950/60 text-sky-200 hover:text-white hover:border-sky-500 transition-colors shadow-xs"
              title="Toggle Dark/Light Mode"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Featured Clear Photographic Showcase Card of the Kenyan Coast */}
          <div className="rounded-2xl overflow-hidden border border-white/20 shadow-2xl relative group max-w-xl">
            <div className="relative h-48 sm:h-56 w-full overflow-hidden">
              <img
                src={kenyanCoastImg}
                alt="Kenyan Marine & Coastal Systems - Mombasa & Diani Coral Reef Waters"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A2540] via-transparent to-black/30" />
              <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold text-teal-300 flex items-center gap-1.5 shadow-md">
                <Waves className="w-3.5 h-3.5 text-teal-400" />
                <span>Kenyan Coastline · Mombasa Marine National Park (WGS84)</span>
              </div>
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <div className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                  Western Indian Ocean Sovereignty
                </div>
                <div className="text-sm sm:text-base font-bold drop-shadow-sm">
                  142,000 sq km Exclusive Economic Zone (EEZ) &amp; Coral Reef Ecosystems
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-wider uppercase text-teal-300">
              Ministry of Mining, Blue Economy and Maritime Affairs
            </p>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight mt-1">
              Scientists &amp; Research Portfolio Management System
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-200 leading-relaxed">
              Institutional portal for managing KMFRI scientific personnel, marine &amp; freshwater programmes, collaborative SharePoint-style libraries, live researcher chat, hydrographic GIS tracking, and Balanced Scorecards.
            </p>
          </div>

          {/* Institutional Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-sky-800/60">
            <div className="bg-white/5 backdrop-blur-xs p-2.5 rounded-lg border border-white/10">
              <div className="text-[10px] text-sky-300/80">Directorates</div>
              <div className="text-base font-mono font-bold text-white mt-0.5">5 Official</div>
              <div className="text-[10px] text-slate-300 mt-0.5">OCS · FWS · ARD · SPG</div>
            </div>
            <div className="bg-white/5 backdrop-blur-xs p-2.5 rounded-lg border border-white/10">
              <div className="text-[10px] text-sky-300/80">Research Stations</div>
              <div className="text-base font-mono font-bold text-white mt-0.5">13 Centers</div>
              <div className="text-[10px] text-slate-300 mt-0.5">Coast &amp; Inland Waters</div>
            </div>
            <div className="bg-white/5 backdrop-blur-xs p-2.5 rounded-lg border border-white/10">
              <div className="text-[10px] text-sky-300/80">Balanced Scorecard</div>
              <div className="text-base font-mono font-bold text-amber-300 mt-0.5">Live BSC</div>
              <div className="text-[10px] text-slate-300 mt-0.5">4 Perspectives Audit</div>
            </div>
            <div className="bg-white/5 backdrop-blur-xs p-2.5 rounded-lg border border-white/10">
              <div className="text-[10px] text-sky-300/80">Research Fleet</div>
              <div className="text-base font-mono font-bold text-teal-300 mt-0.5">RV Mtafiti</div>
              <div className="text-[10px] text-slate-300 mt-0.5">Deep Sea Surveys</div>
            </div>
          </div>
        </div>

        {/* Institutional Governance Notice */}
        <div className="relative z-10 mt-6 pt-5 border-t border-sky-800/60">
          <div className="p-3 rounded-xl bg-sky-950/70 border border-sky-800/60 backdrop-blur-xs flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-white">Republic of Kenya · Authorized Scientific Access Only</div>
              <p className="text-[11px] text-slate-300/90 leading-relaxed">
                This system is reserved for KMFRI researchers, directorate directors, and authorized institutional stakeholders. All sign-in attempts, research publications, and data modifications are auditable and automatically confirmed via registered institutional email.
              </p>
              <div className="text-[10px] font-mono text-sky-300 pt-0.5">
                Support Desk: sysadmin@kmfri.go.ke · English Point HQs, Mombasa
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Authentication Form Column */}
      <div className="lg:w-5/12 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
          {/* Logo prominently at the top of the form */}
          <div className="mb-6 flex justify-center pb-4 border-b border-slate-100 dark:border-slate-800">
            <KmfriLogo variant="full" size="md" />
          </div>

          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              Institutional Authentication
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {mode === 'login'
                ? 'Sign in with Email & Password'
                : mode === 'reset_request'
                ? 'Reset Institutional Password'
                : 'Confirm Password Reset'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {mode === 'login'
                ? 'Enter your KMFRI staff email and password to access authorized modules.'
                : mode === 'reset_request'
                ? 'Enter your registered KMFRI email to generate a password reset verification code.'
                : 'Enter the 6-digit verification code and your new password.'}
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              {authError}
            </div>
          )}

          {authNotice && (
            <div className="mb-4 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-mono">
              {authNotice}
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Institutional Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    {...register('email')}
                    autoComplete="off"
                    placeholder="name@kmfri.go.ke"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setAuthNotice(null);
                      setMode('reset_request');
                    }}
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password')}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-hidden"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0A2540] hover:bg-sky-900 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 shadow-md"
              >
                <span>{submitting ? 'Authenticating...' : 'Sign in to KMFRI Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Reset Request Form */}
          {mode === 'reset_request' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Registered KMFRI Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="name@kmfri.go.ke"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:underline"
                >
                  Back to Sign In
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
                >
                  {submitting ? 'Generating...' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          )}

          {/* Reset Confirm Form */}
          {mode === 'reset_confirm' && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono tracking-widest text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Account Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-9 pr-10 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-hidden"
                    title={showResetPassword ? 'Hide password' : 'Show password'}
                    aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showResetPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  {submitting ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
