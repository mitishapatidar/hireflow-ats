'use client';

import React, { useState } from 'react';
import { useDevUser } from '../../context/DevUserContext';
import { User, LogOut, Shield, ChevronDown, Check, Building2 } from 'lucide-react';
import Link from 'next/link';

export function UserProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser, currentRole, setRole, availableRoles } = useDevUser();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1 sm:p-1.5 rounded-lg hover:bg-[#F6F7FB] transition-colors border border-transparent hover:border-[#E6E8F0]"
        aria-label="User menu"
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${currentUser.avatarColor}`}
        >
          {currentUser.initials}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-xs font-semibold text-[#1B2236] leading-tight">
            {currentUser.name}
          </div>
          <div className="text-[10px] text-[#6B7490] leading-tight">
            {currentUser.role}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#6B7490] hidden sm:block" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-[#E6E8F0] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* User profile header */}
            <div className="p-4 border-b border-[#E6E8F0] bg-[#F6F7FB]">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${currentUser.avatarColor}`}
                >
                  {currentUser.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#1B2236] truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-xs text-[#6B7490] truncate">
                    {currentUser.email}
                  </div>
                  <div className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#EEEBFB] text-[#5B49D6]">
                    {currentUser.roleTitle}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#E6E8F0] flex items-center gap-1.5 text-[11px] text-[#6B7490]">
                <Building2 className="w-3.5 h-3.5 text-[#5B49D6]" />
                <span className="truncate">{currentUser.workspace}</span>
              </div>
            </div>

            {/* Quick Switch Role */}
            <div className="p-2 border-b border-[#E6E8F0]">
              <div className="px-2 py-1 text-[10px] font-semibold text-[#6B7490] uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#5B49D6]" />
                <span>Simulated Role (Dev)</span>
              </div>
              <div className="space-y-0.5">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setRole(role, true);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      currentRole === role
                        ? 'bg-[#EEEBFB] text-[#5B49D6] font-semibold'
                        : 'text-[#1B2236] hover:bg-[#F6F7FB]'
                    }`}
                  >
                    <span>{role}</span>
                    {currentRole === role && <Check className="w-3.5 h-3.5 text-[#5B49D6]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="p-1.5">
              <Link
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-[#1B2236] hover:bg-[#F6F7FB] rounded-lg transition-colors"
              >
                <User className="w-4 h-4 text-[#6B7490]" />
                <span>Account Profile</span>
              </Link>
              <button
                onClick={() => {
                  setIsOpen(false);
                  alert('Signed out of development session. Real authentication workflow arrives in Prompt 5.');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#E5484D] hover:bg-[#FDECEC] rounded-lg transition-colors font-medium text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
