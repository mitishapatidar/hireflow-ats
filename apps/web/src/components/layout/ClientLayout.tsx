'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDevUser } from '../../context/DevUserContext';
import { CLIENT_NAVIGATION_ITEMS } from '@hireflow/shared';
import { NavIcon } from './NavIcon';
import { Building2, Menu, X, LogOut } from 'lucide-react';
import { RouteGuard } from './RouteGuard';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser } = useDevUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <RouteGuard>
      <div className="min-h-screen bg-[#F6F7FB] flex flex-col font-sans">
        {/* Client Top Navigation Bar */}
        <header className="bg-[#1E2A4A] text-white border-b border-white/10 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            {/* Left: Brand / Client Info */}
            <div className="flex items-center gap-6">
              <Link href="/portal" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#5B49D6] flex items-center justify-center font-bold text-white shadow-md">
                  H
                </div>
                <div>
                  <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                    <span>HireFlow</span>
                    <span className="text-[10px] bg-[#5B49D6] text-white px-1.5 py-0.5 rounded font-bold uppercase">
                      Client Portal
                    </span>
                  </div>
                  <div className="text-[10px] text-[#6B7490] flex items-center gap-1 font-medium">
                    <Building2 className="w-2.5 h-2.5 text-[#5B49D6]" />
                    <span className="truncate max-w-[140px] text-[#EEEBFB]">{currentUser.workspace}</span>
                  </div>
                </div>
              </Link>

              {/* Desktop Client Navigation Links */}
              <nav className="hidden md:flex items-center gap-1">
                {CLIENT_NAVIGATION_ITEMS.map((item) => {
                  const isActive = item.exactMatch
                    ? pathname === item.path
                    : pathname === item.path || pathname.startsWith(item.path + '/');

                  return (
                    <Link
                      key={item.id}
                      href={item.path}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#5B49D6] text-white font-semibold shadow-xs'
                          : 'text-[#6B7490] hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <NavIcon name={item.icon} className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: User Menu & Mobile Trigger */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-[#6B7490] hover:text-white hover:bg-white/10"
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
                  <div className="font-semibold text-white leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-[#6B7490] leading-tight">{currentUser.roleTitle}</div>
                </div>
                <Link
                  href="/login"
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-[#6B7490] hover:text-white hover:bg-white/10 transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden px-4 pt-2 pb-4 border-t border-white/10 space-y-1 bg-[#1E2A4A] animate-in slide-in-from-top-2 duration-150">
              {CLIENT_NAVIGATION_ITEMS.map((item) => {
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
                        ? 'bg-[#5B49D6] text-white font-semibold'
                        : 'text-[#6B7490] hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <NavIcon name={item.icon} className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </header>

        {/* Client Portal Main Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </RouteGuard>
  );
}
