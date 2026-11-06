'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { requestPasswordResetAction, AuthActionResult } from '@/actions/auth';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await requestPasswordResetAction(result, formData);
      setResult(res);
      if (res.success) {
        setSubmitted(true);
      }
    });
  };

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

        <h1 className="text-2xl font-extrabold text-[#1E2A4A] tracking-tight">
          Reset your password
        </h1>
        <p className="text-sm text-[#6B7490] mt-1.5 mb-6">
          Enter your work email address and we will dispatch a password reset link.
        </p>

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-[#ECFDF3] border border-[#A6F4C5] flex items-start gap-3 text-[#12B76A] text-sm leading-relaxed">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Instructions sent!</strong> If an active account exists for this email address, password reset instructions have been dispatched.
              </div>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-lg bg-[#5B49D6] text-white text-sm font-semibold hover:bg-[#4938B8] transition-colors"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {result?.error && (
              <div className="p-3 rounded-lg bg-[#FEE4E2] border border-[#FECDCA] flex items-start gap-2.5 text-[#E5484D] text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>{result.error}</div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                Work email address
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@hireflow.io"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-[#E6E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B49D6] text-sm text-[#1B2236]"
                />
                <Mail className="w-4 h-4 text-[#6B7490] absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 px-4 rounded-lg bg-[#5B49D6] hover:bg-[#4938B8] text-white text-sm font-semibold transition-all shadow-md disabled:opacity-50"
            >
              {isPending ? 'Sending link...' : 'Send reset instructions'}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7490] hover:text-[#1E2A4A]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
