'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import { acceptInvitationAction, AuthActionResult } from '@/actions/auth';

export default function AcceptInvitationPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#F6F7FB]" />}>
      <AcceptInvitationContent />
    </React.Suspense>
  );
}

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('token', token);
    startTransition(async () => {
      const res = await acceptInvitationAction(result, formData);
      if (res) setResult(res);
    });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F6F7FB]">
        <div className="w-full max-w-md bg-white rounded-xl border border-[#E6E8F0] p-8 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-[#E5484D] mx-auto mb-3" />
          <h2 className="text-xl font-bold text-[#1E2A4A] mb-2">Invalid Invitation Link</h2>
          <p className="text-sm text-[#6B7490] mb-6">
            The invitation link is missing a valid security token. Please ask your workspace administrator to resend your invite.
          </p>
          <Link
            href="/login"
            className="inline-block py-2.5 px-4 rounded-lg bg-[#5B49D6] text-white text-sm font-semibold hover:bg-[#4938B8]"
          >
            Return to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F6F7FB]">
      <div className="w-full max-w-md bg-white rounded-xl border border-[#E6E8F0] p-8 shadow-sm">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-[#5B49D6] flex items-center justify-center font-bold text-white text-base">
            H
          </div>
          <span className="font-bold text-lg text-[#1E2A4A]">HireFlow ATS</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#EEEBFB] text-[#5B49D6] text-xs font-semibold mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          Workspace Invitation
        </div>

        <h1 className="text-2xl font-extrabold text-[#1E2A4A] tracking-tight">
          Welcome to HireFlow
        </h1>
        <p className="text-sm text-[#6B7490] mt-1.5 mb-6">
          Set up a secure password to activate your account and join your recruitment team.
        </p>

        {result?.error && (
          <div className="mb-5 p-3 rounded-lg bg-[#FEE4E2] border border-[#FECDCA] flex items-start gap-2.5 text-[#E5484D] text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{result.error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-[#1B2236] mb-1.5">
              Create Password
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
                className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-[#E6E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B49D6] text-sm text-[#1B2236]"
              />
              <Lock className="w-4 h-4 text-[#6B7490] absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-[#6B7490] hover:text-[#1B2236]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {result?.fieldErrors?.password && (
              <p className="text-xs text-[#E5484D] mt-1">{result.fieldErrors.password[0]}</p>
            )}
            <p className="text-[11px] text-[#6B7490] mt-1">
              Must be at least 8 characters with uppercase, lowercase, numbers, and symbols.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-semibold text-[#1B2236] mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-[#E6E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B49D6] text-sm text-[#1B2236]"
              />
              <Lock className="w-4 h-4 text-[#6B7490] absolute left-3 top-3 pointer-events-none" />
            </div>
            {result?.fieldErrors?.confirmPassword && (
              <p className="text-xs text-[#E5484D] mt-1">{result.fieldErrors.confirmPassword[0]}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 px-4 rounded-lg bg-[#5B49D6] hover:bg-[#4938B8] text-white text-sm font-semibold transition-all shadow-md disabled:opacity-50"
          >
            {isPending ? 'Activating account...' : 'Activate Account & Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
