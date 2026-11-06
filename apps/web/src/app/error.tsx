'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error
    console.error('Application Error Boundary caught:', error.message);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 bg-[#F6F7FB]">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-[#E6E8F0] p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 mb-2">
            Application Error
          </span>
          <h1 className="text-xl font-bold text-[#1B2236] tracking-tight">
            Unable to load page content
          </h1>
          <p className="text-xs text-[#6B7490] mt-2 leading-relaxed">
            The requested module encountered an unexpected condition. Your session and data remain safe.
            {error?.digest && (
              <span className="block mt-1 font-mono text-[10px] text-[#94A3B8]">
                Error ID: {error.digest}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2 border-t border-[#E6E8F0]">
          <button
            onClick={() => reset()}
            className="px-4 py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2.5 bg-[#F6F7FB] hover:bg-[#EEEBFB] text-[#1B2236] hover:text-[#5B49D6] border border-[#E6E8F0] rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
