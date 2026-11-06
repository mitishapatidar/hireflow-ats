'use client';

import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F6F7FB]">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-[#E6E8F0] p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#EEEBFB] text-[#5B49D6] mx-auto flex items-center justify-center mb-5">
          <FileQuestion className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#EEEBFB] text-[#5B49D6] mb-3">
          404 • Page Not Found
        </span>

        <h1 className="text-xl font-bold text-[#1B2236] tracking-tight">
          Page Does Not Exist
        </h1>

        <p className="text-sm text-[#6B7490] mt-2 leading-relaxed">
          The route you are trying to reach is not part of HireFlow ATS or has been moved.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/dashboard"
            className="px-4 py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Go to Dashboard</span>
          </Link>
          <Link
            href="/design"
            className="px-4 py-2.5 bg-[#F6F7FB] hover:bg-[#EEEBFB] text-[#1B2236] hover:text-[#5B49D6] border border-[#E6E8F0] rounded-lg text-xs font-semibold transition-all flex items-center justify-center"
          >
            Design System
          </Link>
        </div>
      </div>
    </div>
  );
}
