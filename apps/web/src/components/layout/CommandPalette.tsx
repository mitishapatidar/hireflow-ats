'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowRight, Users, Briefcase, FileText } from 'lucide-react';
import { useDevUser } from '../../context/DevUserContext';
import { getNavigationForRole } from '@hireflow/shared';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { currentRole } = useDevUser();
  const [query, setQuery] = useState('');

  const navigationItems = getNavigationForRole(currentRole);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose(); // toggle
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNav = navigationItems.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
  );

  const mockQuickLinks = [
    { label: 'Search Candidates pool', path: '/candidates', icon: Users, roleLimit: ['RECRUITER', 'ADMIN'] },
    { label: 'View Active Job Mandates', path: '/jobs', icon: Briefcase, roleLimit: ['RECRUITER', 'ADMIN'] },
    { label: 'Design System Component Preview', path: '/design', icon: FileText, roleLimit: ['ALL'] },
  ].filter(l => l.roleLimit.includes('ALL') || l.roleLimit.includes(currentRole));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-[#1E2A4A]/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-[#E6E8F0] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#E6E8F0] gap-3">
          <Search className="w-5 h-5 text-[#6B7490]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, candidates, pipelines, shortcuts..."
            className="flex-1 text-sm bg-transparent outline-none text-[#1B2236] placeholder-[#6B7490]"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F6F7FB]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-[#6B7490] uppercase tracking-wider">
            Navigation Pages ({currentRole})
          </div>
          {filteredNav.length > 0 ? (
            filteredNav.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  router.push(item.path);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs text-[#1B2236] hover:bg-[#EEEBFB] hover:text-[#5B49D6] transition-colors group cursor-pointer"
              >
                <div>
                  <span className="font-medium text-sm">{item.label}</span>
                  {item.description && (
                    <p className="text-[11px] text-[#6B7490] group-hover:text-[#5B49D6]/80 truncate">
                      {item.description}
                    </p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-[#6B7490]">
              No matching pages found for "{query}"
            </div>
          )}

          {/* Quick Shortcuts */}
          <div className="pt-2 border-t border-[#E6E8F0]">
            <div className="px-3 py-1 text-[11px] font-semibold text-[#6B7490] uppercase tracking-wider">
              Quick Shortcuts
            </div>
            {mockQuickLinks.map((shortcut, idx) => {
              const Icon = shortcut.icon;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    router.push(shortcut.path);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs text-[#1B2236] hover:bg-[#F6F7FB] transition-colors"
                >
                  <Icon className="w-4 h-4 text-[#5B49D6]" />
                  <span>{shortcut.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-[#F6F7FB] border-t border-[#E6E8F0] flex items-center justify-between text-[11px] text-[#6B7490]">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-[#E6E8F0] rounded text-[10px] font-mono">ESC</kbd> to close</span>
          <span>Global Search (Phase 2 Preview)</span>
        </div>
      </div>
    </div>
  );
}
