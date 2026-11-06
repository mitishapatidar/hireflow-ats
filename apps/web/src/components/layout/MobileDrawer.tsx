'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1E2A4A]/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-[#1E2A4A] shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
        <div className="absolute top-3.5 right-3.5 z-10">
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B7490] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close mobile navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Sidebar onItemClick={onClose} isMobile={true} />
      </div>
    </div>
  );
}
