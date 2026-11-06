'use client';

import React from 'react';
import { HelpCircle, X, Keyboard, Shield, BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2A4A]/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#E6E8F0] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1E2A4A] px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-[#5B49D6]" />
            <h3 className="font-semibold text-base">HireFlow Help & Navigation Guide</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#6B7490] hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-[#1B2236]">
          {/* Shortcuts */}
          <div>
            <div className="flex items-center gap-2 font-semibold text-sm mb-2 text-[#1B2236]">
              <Keyboard className="w-4 h-4 text-[#5B49D6]" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="space-y-1.5 bg-[#F6F7FB] p-3 rounded-lg border border-[#E6E8F0]">
              <div className="flex justify-between items-center">
                <span className="text-[#6B7490]">Open Global Search / Command Palette</span>
                <kbd className="px-2 py-0.5 bg-white border border-[#E6E8F0] rounded font-mono text-[11px] font-bold">
                  Ctrl + K
                </kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6B7490]">Close active modal or drawer</span>
                <kbd className="px-2 py-0.5 bg-white border border-[#E6E8F0] rounded font-mono text-[11px] font-bold">
                  Escape
                </kbd>
              </div>
            </div>
          </div>

          {/* Roles */}
          <div>
            <div className="flex items-center gap-2 font-semibold text-sm mb-2 text-[#1B2236]">
              <Shield className="w-4 h-4 text-[#5B49D6]" />
              <span>Role Permissions Matrix</span>
            </div>
            <p className="text-[#6B7490] mb-2 leading-relaxed">
              HireFlow supports 5 distinct role portals. Use the bottom-right floating <strong>Dev Role Switcher</strong> to switch between Recruiter, Manager, Admin, Client, and Candidate.
            </p>
          </div>

          {/* Resources */}
          <div>
            <div className="flex items-center gap-2 font-semibold text-sm mb-2 text-[#1B2236]">
              <BookOpen className="w-4 h-4 text-[#5B49D6]" />
              <span>Quick Links</span>
            </div>
            <div className="flex gap-2">
              <Link
                href="/design"
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#EEEBFB] text-[#5B49D6] rounded-lg font-semibold hover:bg-[#EEEBFB]/80 transition-colors"
              >
                <span>Design System Showcase</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#F6F7FB] border-t border-[#E6E8F0] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1E2A4A] text-white rounded-lg text-xs font-semibold hover:bg-[#1E2A4A]/90 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
