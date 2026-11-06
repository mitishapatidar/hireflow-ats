'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { loginAction, AuthActionResult } from '@/actions/auth';

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#F6F7FB]" />}>
      <LoginFormContent />
    </React.Suspense>
  );
}

function LoginFormContent() {
  const searchParams = useSearchParams();
  const isAccepted = searchParams.get('accepted') === 'true';
  const isReset = searchParams.get('reset') === 'true';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await loginAction(result, formData);
      if (res) {
        setResult(res);
      }
    });
  };

  const handleGoogleMock = () => {
    // For demonstration / testing: mock Google sign in with seeded admin
    setEmail('anika.rao@hireflow.io');
    setPassword('HireFlow@2026!');
  };

  return (
    <div className="min-h-screen flex w-full bg-[#F6F7FB]">
      {/* ------------------------------------------------------------- */}
      {/* LEFT PANEL: FIGMA FRAME 15 DARK NAVY BRAND HERO PANEL */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#1E2A4A] flex-col justify-between p-12 text-white relative overflow-hidden">
        {/* Background Subtle Accent Circle */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#5B49D6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#5B49D6]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Logo Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#5B49D6] flex items-center justify-center font-bold text-xl text-white shadow-md">
            H
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-tight text-white leading-none">
              HireFlow
            </div>
            <div className="text-[10px] font-semibold text-[#6B7490] tracking-widest uppercase mt-0.5">
              RECRUITMENT OS
            </div>
          </div>
        </div>

        {/* Tagline & Main Value Proposition */}
        <div className="relative z-10 my-auto py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#EEEBFB] text-xs font-semibold tracking-wider uppercase mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-[#5B49D6]" />
            Your Recruitment Workspace
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-5">
            Good hiring starts with a clear view.
          </h1>
          <p className="text-[#A6B4D0] text-base leading-relaxed max-w-md">
            One secure place for your candidates, clients and every next step.
          </p>
        </div>

        {/* Bottom Workspace Metadata */}
        <div className="relative z-10 border-t border-white/10 pt-6">
          <div className="text-sm font-semibold text-white">HireFlow recruitment team</div>
          <div className="text-xs text-[#6B7490] mt-0.5">Mumbai · Organization-managed access</div>
          <div className="text-[11px] text-[#A6B4D0]/80 mt-2 leading-relaxed">
            Your role and team permissions are assigned by your administrator after sign-in.
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RIGHT PANEL: FIGMA FRAME 15 AUTHENTICATION FORM */}
      {/* ------------------------------------------------------------- */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          {/* Mobile-only Logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-[#5B49D6] flex items-center justify-center font-bold text-lg text-white">
              H
            </div>
            <span className="font-bold text-xl text-[#1E2A4A]">HireFlow ATS</span>
          </div>

          {/* Access Phase Tag */}
          <div className="text-[11px] font-bold text-[#6B7490] uppercase tracking-wider mb-2">
            15 / ACCESS · PHASE 1
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E2A4A] tracking-tight">
            Welcome back
          </h2>
          <p className="text-sm text-[#6B7490] mt-1.5 mb-6">
            Sign in to your organization&apos;s HireFlow workspace.
          </p>

          {/* Success Banners */}
          {isAccepted && (
            <div className="mb-5 p-3.5 rounded-lg bg-[#ECFDF3] border border-[#A6F4C5] flex items-start gap-2.5 text-[#12B76A] text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Invitation accepted!</span> Your account has been activated. Please sign in with your password.
              </div>
            </div>
          )}

          {isReset && (
            <div className="mb-5 p-3.5 rounded-lg bg-[#ECFDF3] border border-[#A6F4C5] flex items-start gap-2.5 text-[#12B76A] text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Password updated!</span> Your new password is now active. Please sign in.
              </div>
            </div>
          )}

          {/* Error Banner */}
          {(result?.error || errorParam) && (
            <div className="mb-5 p-3.5 rounded-lg bg-[#FEE4E2] border border-[#FECDCA] flex items-start gap-2.5 text-[#E5484D] text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{result?.error || 'Authentication failed. Please check your credentials.'}</div>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Organization Field (Frame 15) */}
            <div>
              <label className="block text-xs font-semibold text-[#1B2236] uppercase tracking-wider mb-1.5">
                Organization
              </label>
              <input
                type="text"
                readOnly
                value="Aureva Capital / HireFlow Team"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#F6F7FB] border border-[#E6E8F0] text-sm font-medium text-[#1B2236] cursor-not-allowed outline-none"
              />
              <div className="text-[11px] text-[#6B7490] mt-1">Workspace: hireflow-team</div>
            </div>

            {/* Continue with Google (OIDC) */}
            <div>
              <button
                type="button"
                onClick={handleGoogleMock}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-[#E6E8F0] bg-white hover:bg-[#F6F7FB] transition-colors text-sm font-semibold text-[#1B2236] shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-[#E6E8F0] w-full" />
              <span className="bg-[#F6F7FB] px-3 text-xs font-medium text-[#6B7490] absolute">
                Or sign in with your work email
              </span>
            </div>

            {/* Work Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                Work email
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@hireflow.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-[#E6E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B49D6] focus:border-transparent text-sm text-[#1B2236] transition-all"
                />
                <Mail className="w-4 h-4 text-[#6B7490] absolute left-3 top-3 pointer-events-none" />
              </div>
              {result?.fieldErrors?.email && (
                <p className="text-xs text-[#E5484D] mt-1">{result.fieldErrors.email[0]}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-[#E6E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B49D6] focus:border-transparent text-sm text-[#1B2236] transition-all"
                />
                <Lock className="w-4 h-4 text-[#6B7490] absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#6B7490] hover:text-[#1B2236] transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {result?.fieldErrors?.password && (
                <p className="text-xs text-[#E5484D] mt-1">{result.fieldErrors.password[0]}</p>
              )}
            </div>

            {/* Options Row: Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[#6B7490]">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#E6E8F0] text-[#5B49D6] focus:ring-[#5B49D6] w-4 h-4"
                />
                Remember this device
              </label>
              <Link
                href="/forgot-password"
                className="font-medium text-[#5B49D6] hover:text-[#4938B8] hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[#5B49D6] hover:bg-[#4938B8] text-white text-sm font-semibold tracking-wide transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in securely...</span>
                </>
              ) : (
                <>
                  <span>Sign in securely</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </form>

          {/* Info Banner (Figma Frame 15) */}
          <div className="mt-6 p-3.5 rounded-lg bg-[#EEEBFB] border border-[#D6D0F8] text-[#1E2A4A] text-xs leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#5B49D6] flex-shrink-0 mt-0.5" />
            <div>
              <strong>Two-step verification</strong> may be required by your organization. Signing in does not change your assigned role.
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-8 text-center text-xs text-[#6B7490] leading-relaxed">
            Need an invitation? Contact your workspace administrator.{' '}
            <span className="block mt-1 text-[11px] text-[#A6B4D0]">
              HireFlow ATS & Recruitment CRM · Confidential & Proprietary
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
