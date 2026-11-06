'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDevUser } from '../../context/DevUserContext';
import { CANDIDATE_NAVIGATION_ITEMS } from '@hireflow/shared';
import { NavIcon } from './NavIcon';
import { Menu, X } from 'lucide-react';
import { RouteGuard } from './RouteGuard';

export function CandidateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser } = useDevUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <RouteGuard>
      <div className="min-h-screen bg-[#F6F7FB] flex flex-col font-sans">
        {/* Candidate Portal Top Navigation Bar */}
        <header className="bg-white border-b border-[#E6E8F0] sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            {/* Left: Brand */}
            <div className="flex items-center gap-8">
              <Link href="/my-dashboard" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#5B49D6] flex items-center justify-center font-bold text-white shadow-sm">
                  H
                </div>
                <div>
                  <div className="font-extrabold text-sm tracking-tight text-[#1B2236] flex items-center gap-1.5">
                    <span>HireFlow</span>
                    <span className="text-[10px] bg-[#EEEBFB] text-[#5B49D6] px-1.5 py-0.5 rounded font-bold uppercase">
                      Applicant Portal
                    </span>
                  </div>
                  <div className="text-[10px] text-[#6B7490]">Careers & Application Center</div>
                </div>
              </Link>

              {/* Desktop Nav Items */}
              <nav className="hidden md:flex items-center gap-1.5">
                {CANDIDATE_NAVIGATION_ITEMS.map((item) => {
                  const isActive = item.exactMatch
                    ? pathname === item.path
                    : pathname === item.path || pathname.startsWith(item.path + '/');

                  return (
                    <Link
                      key={item.id}
                      href={item.path}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#EEEBFB] text-[#5B49D6] font-bold shadow-2xs'
                          : 'text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F6F7FB]'
                      }`}
                    >
                      <NavIcon
                        name={item.icon}
                        className={`w-3.5 h-3.5 ${isActive ? 'text-[#5B49D6]' : 'text-[#6B7490]'}`}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: User Profile & Mobile Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F6F7FB]"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <div className="flex items-center gap-2.5 pl-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${currentUser.avatarColor}`}
                >
                  {currentUser.initials}
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-semibold text-[#1B2236] leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-[#6B7490] leading-tight">{currentUser.roleTitle}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden px-4 pt-2 pb-4 border-t border-[#E6E8F0] space-y-1 bg-white animate-in slide-in-from-top-2 duration-150">
              {CANDIDATE_NAVIGATION_ITEMS.map((item) => {
                const isActive = item.exactMatch
                  ? pathname === item.path
                  : pathname === item.path || pathname.startsWith(item.path + '/');

                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-[#EEEBFB] text-[#5B49D6] font-bold'
                        : 'text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F6F7FB]'
                    }`}
                  >
                    <NavIcon name={item.icon} className="w-4 h-4 text-[#5B49D6]" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </header>

        {/* Main Applicant Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </RouteGuard>
  );
}
