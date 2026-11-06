'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDevUser } from '../../context/DevUserContext';
import { getNavigationForRole, NavigationItem } from '@hireflow/shared';
import { NavIcon } from './NavIcon';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  onItemClick?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ onItemClick, isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { currentRole, currentUser } = useDevUser();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = getNavigationForRole(currentRole);

  // Group items by section
  const workspaceItems = navItems.filter((i) => i.section === 'WORKSPACE' || !i.section);
  const managementItems = navItems.filter((i) => i.section === 'MANAGEMENT');
  const systemItems = navItems.filter((i) => i.section === 'SYSTEM');

  const isItemActive = (item: NavigationItem) => {
    if (item.exactMatch) {
      return pathname === item.path;
    }
    return pathname === item.path || pathname.startsWith(item.path + '/');
  };

  const renderNavGroup = (items: NavigationItem[], sectionLabel?: string) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-4">
        {sectionLabel && !isCollapsed && (
          <div className="px-3 mb-1.5 text-[10px] font-bold text-[#6B7490] uppercase tracking-wider">
            {sectionLabel}
          </div>
        )}
        <nav className="space-y-1">
          {items.map((item) => {
            const active = isItemActive(item);

            return (
              <Link
                key={item.id}
                href={item.path}
                onClick={onItemClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  active
                    ? 'bg-[#5B49D6] text-white shadow-sm font-semibold'
                    : 'text-[#6B7490] hover:text-white hover:bg-white/10'
                } ${isCollapsed && !isMobile ? 'justify-center px-2' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <NavIcon
                  name={item.icon}
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    active ? 'text-white' : 'text-[#6B7490] group-hover:text-white'
                  }`}
                />

                {(!isCollapsed || isMobile) && (
                  <span className="truncate flex-1">{item.label}</span>
                )}

                {(!isCollapsed || isMobile) && item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-white/20 text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <aside
      className={`bg-[#1E2A4A] text-white flex flex-col h-full border-r border-[#1E2A4A]/80 transition-all duration-200 select-none ${
        isMobile
          ? 'w-72'
          : isCollapsed
          ? 'w-20'
          : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <Link
          href="/dashboard"
          onClick={onItemClick}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="w-8 h-8 rounded-lg bg-[#5B49D6] flex items-center justify-center font-bold text-base text-white shadow-md shrink-0">
            H
          </div>
          {(!isCollapsed || isMobile) && (
            <div className="truncate">
              <span className="font-extrabold text-base tracking-tight text-white">
                HireFlow
              </span>
              <span className="ml-1 text-[10px] font-bold text-[#EEEBFB] px-1.5 py-0.5 rounded bg-white/10">
                ATS
              </span>
            </div>
          )}
        </Link>

        {!isMobile && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-[#6B7490] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation Lists */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {renderNavGroup(workspaceItems, 'WORKSPACE')}
        {renderNavGroup(managementItems, 'MANAGEMENT')}
        {renderNavGroup(systemItems, 'SYSTEM')}
      </div>

      {/* User Profile Card at Bottom */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <div
          className={`p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3 ${
            isCollapsed && !isMobile ? 'justify-center p-2' : ''
          }`}
        >
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${currentUser.avatarColor}`}
          >
            {currentUser.initials}
          </div>

          {(!isCollapsed || isMobile) && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-[#6B7490] truncate font-medium">
                {currentUser.role}
              </div>
            </div>
          )}

          {(!isCollapsed || isMobile) && (
            <button
              onClick={() => alert('Sign out clicked. Real authentication arrives in Prompt 5.')}
              className="p-1.5 text-[#6B7490] hover:text-[#E5484D] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
