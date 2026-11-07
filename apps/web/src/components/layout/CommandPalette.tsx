'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  ArrowRight,
  Users,
  Briefcase,
  Building,
  Loader2,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useDevUser } from '../../context/DevUserContext';
import { getNavigationForRole } from '@hireflow/shared';
import { globalSearchAction, GlobalSearchResponse } from '../../actions/search';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'ALL' | 'CANDIDATES' | 'JOBS' | 'CLIENTS';

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { currentRole } = useDevUser();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [searchResults, setSearchResults] = useState<GlobalSearchResponse | null>(null);
  const [isSearching, startSearching] = useTransition();

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

  // Live search when query changes
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(() => {
      startSearching(async () => {
        try {
          const res = await globalSearchAction(query.trim());
          setSearchResults(res);
        } catch (err) {
          console.error('Command search failed:', err);
        }
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const filteredNav = navigationItems.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
  );

  const displayCandidates =
    activeTab === 'ALL' || activeTab === 'CANDIDATES' ? searchResults?.candidates || [] : [];
  const displayJobs =
    activeTab === 'ALL' || activeTab === 'JOBS' ? searchResults?.jobs || [] : [];
  const displayClients =
    activeTab === 'ALL' || activeTab === 'CLIENTS' ? searchResults?.clients || [] : [];

  const hasEntityResults =
    displayCandidates.length > 0 || displayJobs.length > 0 || displayClients.length > 0;

  const navigateTo = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-[#1E2A4A]/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E6E8F0] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#E6E8F0] gap-3 bg-white">
          <Search className="w-5 h-5 text-[#6B7490]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search candidates, jobs, clients, pages, or shortcuts... (Ctrl+K)"
            className="flex-1 text-sm bg-transparent outline-none text-[#1B2236] placeholder-[#6B7490]"
          />
          {isSearching && <Loader2 className="w-4 h-4 text-[#5B49D6] animate-spin" />}
          {query && !isSearching && (
            <button
              onClick={() => {
                setQuery('');
                setSearchResults(null);
              }}
              className="p-1 rounded-md text-[#6B7490] hover:text-[#1B2236]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#F6F7FB] border border-[#E6E8F0] text-[#6B7490]"
          >
            ESC
          </button>
        </div>

        {/* Filter Tabs if query present */}
        {query.trim().length >= 2 && (
          <div className="flex items-center gap-1 px-4 py-2 bg-[#F6F7FB] border-b border-[#E6E8F0] text-xs">
            {(['ALL', 'CANDIDATES', 'JOBS', 'CLIENTS'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white text-[#5B49D6] shadow-xs'
                    : 'text-[#6B7490] hover:text-[#1B2236]'
                }`}
              >
                {tab === 'ALL'
                  ? `All (${searchResults?.total || 0})`
                  : tab === 'CANDIDATES'
                  ? `Candidates (${searchResults?.candidates.length || 0})`
                  : tab === 'JOBS'
                  ? `Jobs (${searchResults?.jobs.length || 0})`
                  : `Clients (${searchResults?.clients.length || 0})`}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable Results */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {/* 1. Database Search Results */}
          {query.trim().length >= 2 && (
            <div className="space-y-3">
              {/* Candidates */}
              {displayCandidates.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-[#6B7490] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#5B49D6]" />
                    <span>Candidates</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {displayCandidates.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => navigateTo(c.href)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs hover:bg-[#EEEBFB] transition-colors group cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-sm text-[#1B2236] group-hover:text-[#5B49D6]">
                            {c.title}
                          </div>
                          <div className="text-[11px] text-[#6B7490] truncate">{c.subtitle}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F6F7FB] border border-[#E6E8F0] text-[#6B7490] group-hover:bg-[#5B49D6] group-hover:text-white">
                          Profile
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Jobs */}
              {displayJobs.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-[#6B7490] uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#5B49D6]" />
                    <span>Jobs</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {displayJobs.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => navigateTo(j.href)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs hover:bg-[#EEEBFB] transition-colors group cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-sm text-[#1B2236] group-hover:text-[#5B49D6]">
                            {j.title}
                          </div>
                          <div className="text-[11px] text-[#6B7490] truncate">{j.subtitle}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F6F7FB] border border-[#E6E8F0] text-[#6B7490]">
                          {j.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clients */}
              {displayClients.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-[#6B7490] uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-[#5B49D6]" />
                    <span>Clients</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {displayClients.map((cl) => (
                      <button
                        key={cl.id}
                        onClick={() => navigateTo(cl.href)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs hover:bg-[#EEEBFB] transition-colors group cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-sm text-[#1B2236] group-hover:text-[#5B49D6]">
                            {cl.title}
                          </div>
                          <div className="text-[11px] text-[#6B7490] truncate">{cl.subtitle}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F6F7FB] border border-[#E6E8F0] text-[#6B7490]">
                          {cl.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!hasEntityResults && !isSearching && (
                <div className="py-4 text-center text-xs text-[#6B7490]">
                  No matching candidates, jobs, or clients found.
                </div>
              )}
            </div>
          )}

          {/* 2. Navigation Pages */}
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold text-[#6B7490] uppercase tracking-wider">
              Navigation Pages
            </div>
            {filteredNav.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => navigateTo(item.path)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs hover:bg-[#F6F7FB] transition-colors group cursor-pointer"
              >
                <div>
                  <span className="font-medium text-sm text-[#1B2236]">{item.label}</span>
                  {item.description && (
                    <p className="text-[11px] text-[#6B7490] truncate">{item.description}</p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-[#6B7490] opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>

          {/* 3. Quick Shortcuts */}
          <div className="pt-2 border-t border-[#E6E8F0]">
            <div className="px-2 py-1 text-[10px] font-bold text-[#6B7490] uppercase tracking-wider">
              Quick Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => navigateTo('/offers')}
                className="flex items-center gap-2 p-2 rounded-xl border border-[#E6E8F0] hover:bg-[#F6F7FB] text-left text-xs text-[#1B2236]"
              >
                <Sparkles className="w-4 h-4 text-[#5B49D6]" />
                <span className="font-medium">Offers & Placements</span>
              </button>
              <button
                onClick={() => navigateTo('/reports')}
                className="flex items-center gap-2 p-2 rounded-xl border border-[#E6E8F0] hover:bg-[#F6F7FB] text-left text-xs text-[#1B2236]"
              >
                <FileText className="w-4 h-4 text-[#12B76A]" />
                <span className="font-medium">Recruitment Analytics</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#F6F7FB] border-t border-[#E6E8F0] flex items-center justify-between text-[11px] text-[#6B7490]">
          <span>Role Scoping: <strong>{currentRole}</strong> (Zero-leak verified)</span>
          <span>HireFlow Global Search</span>
        </div>
      </div>
    </div>
  );
}
