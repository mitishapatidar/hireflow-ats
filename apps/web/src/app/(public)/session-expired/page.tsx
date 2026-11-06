'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, ArrowRight, Lock } from 'lucide-react';

export default function SessionExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7FB] px-4 py-12">
      <div className="w-full max-w-md bg-white border border-[#E6E8F0] rounded-2xl p-8 shadow-sm text-center">
        {/* Security / Timeout Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#EEEBFB] border border-[#5B49D6]/20 flex items-center justify-center mx-auto mb-6 text-[#5B49D6]">
          <Clock className="w-8 h-8" />
        </div>

        {/* Heading & Details */}
        <h1 className="text-2xl font-bold text-[#1B2236] tracking-tight mb-3">
          Your session has expired
        </h1>
        <p className="text-sm text-[#6B7490] leading-relaxed mb-6">
          To protect candidate confidential notes, commercial fee terms, and recruitment records, your session was automatically locked due to inactivity.
        </p>

        {/* Security Policy Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F6F7FB] border border-[#E6E8F0] text-xs font-medium text-[#1B2236] mb-8">
          <Lock className="w-3.5 h-3.5 text-[#5B49D6]" />
          <span>Server-Enforced 30-Minute Security Policy</span>
        </div>

        {/* Action Button */}
        <Link
          href="/login"
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-white bg-[#5B49D6] hover:bg-[#4d3db8] shadow-sm transition-all"
        >
          <span>Sign In to Continue</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Secondary Note */}
        <p className="text-xs text-[#6B7490] mt-6">
          Need help? Contact your Aureva Capital workspace administrator.
        </p>
      </div>
    </div>
  );
}
