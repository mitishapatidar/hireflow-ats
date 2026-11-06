'use client';

import React, { useState } from 'react';
import { Search, HelpCircle, Menu, Building2 } from 'lucide-react';
import { useDevUser } from '../../context/DevUserContext';
import { CommandPalette } from './CommandPalette';
import { NotificationsDropdown } from './NotificationsDropdown';
import { HelpModal } from './HelpModal';
import { UserProfileDropdown } from './UserProfileDropdown';

interface TopBarProps {
  onToggleMobileMenu?: () => void;
  showWorkspaceChip?: boolean;
}

export function TopBar({ onToggleMobileMenu, showWorkspaceChip = true }: TopBarProps) {
  const { currentUser } = useDevUser();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <>
      <header className="h-16 bg-white border-b border-[#E6E8F0] px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
        {/* Left Section: Mobile Toggle & Workspace & Search */}
        <div className="flex items-center gap-3 flex-1 min-w-0 max-w-2xl">
          {/* Mobile hamburger menu (visible < 1024px) */}
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 -ml-2 text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F6F7FB] rounded-lg transition-colors cursor-pointer"
              aria-label="Open mobile navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Current Workspace Chip */}
          {showWorkspaceChip && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-xs font-medium text-[#1B2236] shrink-0">
              <Building2 className="w-3.5 h-3.5 text-[#5B49D6]" />
              <span className="truncate max-w-[180px]">{currentUser.workspace}</span>
            </div>
          )}

          {/* Global Search Input Trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#F6F7FB] hover:bg-[#EEEBFB]/40 border border-[#E6E8F0] rounded-lg text-xs text-[#6B7490] w-full max-w-xs transition-all cursor-pointer group"
            title="Search candidates, jobs, and documents (Ctrl + K)"
          >
            <Search className="w-4 h-4 text-[#6B7490] group-hover:text-[#5B49D6] transition-colors" />
            <span className="hidden sm:inline flex-1 text-left truncate">Search candidates, jobs...</span>
            <span className="sm:hidden flex-1 text-left truncate">Search...</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-white border border-[#E6E8F0] rounded text-[10px] font-mono font-bold text-[#6B7490] shadow-2xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right Section: Help, Notifications, User Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Help Action */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-2 rounded-lg text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F6F7FB] transition-colors"
            title="Help and Keyboard Shortcuts"
            aria-label="Help and documentation"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Notifications Dropdown */}
          <NotificationsDropdown />

          {/* Divider */}
          <div className="h-6 w-px bg-[#E6E8F0] mx-1 hidden sm:block" />

          {/* User Profile Menu */}
          <UserProfileDropdown />
        </div>
      </header>

      {/* Modals */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
}
