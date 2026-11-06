'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, RefreshCw, Home } from 'lucide-react';
import { useDevUser, SEEDED_PROFILES } from '../../context/DevUserContext';
import { getDefaultRouteForRole } from '@hireflow/shared';

export default function NoPermissionPage() {
  const router = useRouter();
  const { currentRole, setRole, availableRoles } = useDevUser();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 bg-[#F6F7FB]">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-[#E6E8F0] p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FDECEC] text-[#E5484D] mx-auto flex items-center justify-center mb-5">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#FDECEC] text-[#E5484D] mb-3">
          403 • No Permission
        </span>

        <h1 className="text-xl font-bold text-[#1B2236] tracking-tight">
          Access Restricted
        </h1>

        <p className="text-sm text-[#6B7490] mt-2 leading-relaxed">
          You are currently viewing HireFlow with simulated role{' '}
          <strong className="text-[#1B2236]">{currentRole}</strong> ({SEEDED_PROFILES[currentRole].roleTitle}). You do not have permissions to access this page.
        </p>

        {/* Switch simulated role prompt */}
        <div className="mt-5 p-3.5 bg-[#F6F7FB] border border-[#E6E8F0] rounded-xl text-left">
          <span className="text-[11px] font-semibold text-[#6B7490] uppercase tracking-wider block mb-2">
            Switch Simulated Role (Development Preview):
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {availableRoles.map((role) => (
              <button
                key={role}
                onClick={() => setRole(role, true)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center justify-between ${
                  currentRole === role
                    ? 'bg-[#EEEBFB] border-[#5B49D6] text-[#5B49D6]'
                    : 'bg-white border-[#E6E8F0] hover:border-[#6B7490]/40 text-[#1B2236]'
                }`}
              >
                <span>{role}</span>
                {currentRole === role && <RefreshCw className="w-3 h-3 text-[#5B49D6]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => router.push(getDefaultRouteForRole(currentRole))}
            className="px-4 py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go to {currentRole} Home</span>
          </button>
          <Link
            href="/"
            className="px-4 py-2.5 bg-[#F6F7FB] hover:bg-[#EEEBFB] text-[#1B2236] hover:text-[#5B49D6] border border-[#E6E8F0] rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>App Root</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
