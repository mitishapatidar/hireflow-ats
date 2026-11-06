'use client';

import React, { useState } from 'react';
import { useDevUser, SEEDED_PROFILES } from '../../context/DevUserContext';
import { UserRole } from '@hireflow/shared';
import { Shield, ChevronDown, ChevronUp, UserCheck, ExternalLink, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function DevRoleSwitcher() {
  const { currentRole, setRole } = useDevUser();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside aria-label="Development Role Switcher" className="fixed bottom-4 right-4 z-50 font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#1E2A4A] text-white rounded-full shadow-lg border border-[#5B49D6]/40 hover:bg-[#1E2A4A]/90 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-medium cursor-pointer"
          title="Open Development Role Switcher"
        >
          <span className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse" />
          <Shield className="w-3.5 h-3.5 text-[#5B49D6]" />
          <span>Role: <strong className="text-[#EEEBFB]">{currentRole}</strong></span>
          <ChevronUp className="w-3.5 h-3.5 text-[#6B7490]" />
        </button>
      ) : (
        <div className="w-80 bg-white rounded-xl shadow-2xl border border-[#E6E8F0] overflow-hidden text-[#1B2236] animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="bg-[#1E2A4A] px-4 py-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#5B49D6]" />
              <span className="text-xs font-semibold tracking-wide uppercase">Dev Role Switcher</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#6B7490] hover:text-white transition-colors p-1 rounded-md"
              title="Minimize Switcher"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Dev Notice */}
          <div className="bg-[#EEEBFB] px-3.5 py-2 text-[11px] text-[#5B49D6] border-b border-[#E6E8F0] flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Development preview only. Real auth in Prompt 5.</span>
          </div>

          {/* Role selector list */}
          <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
            {Object.values(UserRole).map((role) => {
              const profile = SEEDED_PROFILES[role];
              const isSelected = currentRole === role;

              return (
                <button
                  key={role}
                  onClick={() => setRole(role, true)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'border-[#5B49D6] bg-[#EEEBFB]/50 ring-1 ring-[#5B49D6]'
                      : 'border-[#E6E8F0] hover:border-[#6B7490]/40 hover:bg-[#F6F7FB]'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5 ${profile.avatarColor}`}
                  >
                    {profile.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1B2236]">{role}</span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] text-[#5B49D6] font-bold bg-white px-1.5 py-0.5 rounded-full border border-[#5B49D6]/30">
                          <UserCheck className="w-2.5 h-2.5" /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6B7490] truncate">{profile.name}</p>
                    <p className="text-[10px] text-[#6B7490]/80 truncate">{profile.roleTitle}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer quick links */}
          <div className="bg-[#F6F7FB] px-3 py-2 border-t border-[#E6E8F0] flex items-center justify-between text-[11px]">
            <Link
              href="/design"
              className="text-[#5B49D6] hover:underline flex items-center gap-1 font-medium"
            >
              <span>Design System</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <span className="text-[#6B7490] text-[10px]">HireFlow ATS v0.1</span>
          </div>
        </div>
      )}
    </aside>
  );
}
