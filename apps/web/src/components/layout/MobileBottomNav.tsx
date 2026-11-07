'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, Briefcase, Users, MoreHorizontal } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMore: () => void;
}

export function MobileBottomNav({ onOpenMore }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Today',
      href: '/mobile/today',
      icon: CalendarCheck,
      isActive: pathname.startsWith('/mobile/today'),
    },
    {
      label: 'Jobs',
      href: '/jobs',
      icon: Briefcase,
      isActive: pathname.startsWith('/jobs'),
    },
    {
      label: 'Candidates',
      href: '/candidates',
      icon: Users,
      isActive: pathname.startsWith('/candidates'),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E6E8F0] shadow-lg pb-safe"
    >
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                item.isActive
                  ? 'text-[#5B49D6] font-semibold'
                  : 'text-[#6B7490] hover:text-[#1B2236]'
              }`}
            >
              <Icon className={`w-5 h-5 ${item.isActive ? 'text-[#5B49D6]' : 'text-[#6B7490]'}`} />
              <span className="text-[11px] leading-none">{item.label}</span>
            </Link>
          );
        })}

        <button
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center gap-1 text-[#6B7490] hover:text-[#1B2236] transition-colors cursor-pointer"
          aria-label="Open More Menu"
        >
          <MoreHorizontal className="w-5 h-5 text-[#6B7490]" />
          <span className="text-[11px] leading-none">More</span>
        </button>
      </div>
    </nav>
  );
}
