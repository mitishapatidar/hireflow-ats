'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useDevUser } from '../../context/DevUserContext';
import { canAccessRoute, getDefaultRouteForRole, ROUTE_PERMISSIONS, UserRole } from '@hireflow/shared';
import { ShieldAlert, ArrowLeft, RefreshCw, Lock } from 'lucide-react';
import Link from 'next/link';

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentRole, setRole } = useDevUser();

  const isAllowed = canAccessRoute(currentRole, pathname);

  if (!isAllowed) {
    // Find which roles ARE allowed for this route
    const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/';
    let allowedRolesForThisRoute: UserRole[] = [];
    if (ROUTE_PERMISSIONS[cleanPath]) {
      allowedRolesForThisRoute = ROUTE_PERMISSIONS[cleanPath];
    } else {
      for (const [routePattern, roles] of Object.entries(ROUTE_PERMISSIONS)) {
        if (cleanPath.startsWith(routePattern + '/')) {
          allowedRolesForThisRoute = roles;
          break;
        }
      }
    }

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-[#E6E8F0] p-8 text-center animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-[#FDECEC] text-[#E5484D] mx-auto flex items-center justify-center mb-5 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#FDECEC] text-[#E5484D] mb-3">
            403 • Access Restricted
          </span>

          <h2 className="text-xl font-bold text-[#1B2236] tracking-tight">
            Role Permission Required
          </h2>

          <p className="text-sm text-[#6B7490] mt-2 leading-relaxed">
            Your simulated role <strong className="text-[#1B2236]">{currentRole}</strong> does not have permission to view <code className="px-1.5 py-0.5 bg-[#F6F7FB] border border-[#E6E8F0] rounded text-xs text-[#5B49D6]">{pathname}</code>.
          </p>

          {allowedRolesForThisRoute.length > 0 && (
            <div className="mt-4 p-3 bg-[#F6F7FB] border border-[#E6E8F0] rounded-xl text-left">
              <span className="text-[11px] font-semibold text-[#6B7490] uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#5B49D6]" />
                Authorized Roles for this Page:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {allowedRolesForThisRoute.map((role) => (
                  <button
                    key={role}
                    onClick={() => setRole(role, true)}
                    className="px-2.5 py-1 bg-white hover:bg-[#EEEBFB] border border-[#E6E8F0] hover:border-[#5B49D6] rounded-md text-xs font-semibold text-[#1B2236] hover:text-[#5B49D6] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Switch to {role}</span>
                    <RefreshCw className="w-3 h-3 text-[#5B49D6]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              onClick={() => router.push(getDefaultRouteForRole(currentRole))}
              className="px-4 py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to {currentRole} Home</span>
            </button>

            <Link
              href="/design"
              className="px-4 py-2.5 bg-[#F6F7FB] hover:bg-[#EEEBFB] text-[#1B2236] hover:text-[#5B49D6] border border-[#E6E8F0] rounded-lg text-xs font-semibold transition-all flex items-center justify-center"
            >
              Design System
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
