'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileDrawer } from './MobileDrawer';
import { RouteGuard } from './RouteGuard';
import { MobileBottomNav } from './MobileBottomNav';

export function InternalLayout({ children }: { children: React.ReactNode }) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <RouteGuard>
      <div className="min-h-screen bg-[#F6F7FB] flex font-sans antialiased text-[#1B2236]">
        {/* Desktop Fixed Sidebar (hidden < 1024px) */}
        <div className="hidden lg:block shrink-0 h-screen sticky top-0 z-30">
          <Sidebar />
        </div>

        {/* Mobile Slide-in Drawer */}
        <MobileDrawer
          isOpen={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <TopBar onToggleMobileMenu={() => setMobileDrawerOpen(true)} />

          {/* Page Body */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
            {children}
          </main>

          {/* Mobile Bottom Navigation (< 1024px) */}
          <MobileBottomNav onOpenMore={() => setMobileDrawerOpen(true)} />
        </div>
      </div>
    </RouteGuard>
  );
}
