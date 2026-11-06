'use client';

import React from 'react';
import Link from 'next/link';
import { useDevUser, SEEDED_PROFILES } from '../context/DevUserContext';
import { UserRole } from '@hireflow/shared';
import {
  Shield,
  Briefcase,
  Users,
  Building2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Palette,
} from 'lucide-react';

export default function HomePage() {
  const { currentRole, setRole } = useDevUser();

  const rolePortals = [
    {
      role: UserRole.RECRUITER,
      title: 'Recruiter Dashboard',
      desc: 'Candidate sourcing, pipeline tracking, interview scheduling, and client submissions.',
      route: '/dashboard',
      icon: Users,
      badge: 'Internal Shell',
      color: 'bg-[#5B49D6]',
    },
    {
      role: UserRole.MANAGER,
      title: 'Manager Dashboard',
      desc: 'Approvals for new jobs and submissions, team assignments, and pipeline health.',
      route: '/dashboard',
      icon: Briefcase,
      badge: 'Management Shell',
      color: 'bg-[#1E2A4A]',
    },
    {
      role: UserRole.ADMIN,
      title: 'Admin Control Center',
      desc: 'Full system oversight, permissions, agency settings, and audit logs.',
      route: '/admin',
      icon: Shield,
      badge: 'Admin Shell',
      color: 'bg-[#12B76A]',
    },
    {
      role: UserRole.CLIENT,
      title: 'Client Portal',
      desc: 'Review submitted candidate profiles, track open positions, and view interview progress.',
      route: '/portal',
      icon: Building2,
      badge: 'Client Portal',
      color: 'bg-[#3B82F6]',
    },
    {
      role: UserRole.CANDIDATE,
      title: 'Candidate Portal',
      desc: 'Applicant self-service dashboard, track interview slots, and manage resume profile.',
      route: '/my-dashboard',
      icon: Sparkles,
      badge: 'Candidate Portal',
      color: 'bg-[#F59E0B]',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F6F7FB] py-12 px-4 sm:px-6 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#EEEBFB] text-[#5B49D6] mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>HireFlow ATS & Recruitment CRM • Phase 0</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1B2236] tracking-tight">
            Role-Based Application Shell
          </h1>
          <p className="text-sm text-[#6B7490] mt-2 max-w-xl mx-auto leading-relaxed">
            Select a target role portal below to experience the authenticated shell, role-driven navigation, and route protection.
          </p>
        </div>

        {/* Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {rolePortals.map((portal) => {
            const Icon = portal.icon;
            const isCurrent = currentRole === portal.role;
            const profile = SEEDED_PROFILES[portal.role];

            return (
              <div
                key={portal.role}
                className={`bg-white rounded-xl p-5 border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'border-[#5B49D6] ring-2 ring-[#5B49D6]/20 shadow-md'
                    : 'border-[#E6E8F0] hover:border-[#6B7490]/40 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                      {portal.badge}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-[#12B76A] bg-[#E3F6EC] px-2 py-0.5 rounded-full">
                        ● Currently Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl text-white ${portal.color} shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#1B2236]">{portal.title}</h3>
                      <p className="text-xs text-[#6B7490] mt-1 leading-relaxed">{portal.desc}</p>
                      <div className="text-[11px] text-[#6B7490] mt-2 font-medium">
                        User: <strong className="text-[#1B2236]">{profile.name}</strong> ({profile.email})
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-[#E6E8F0] flex items-center justify-between">
                  <button
                    onClick={() => setRole(portal.role, true)}
                    className="w-full py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <span>Enter as {portal.role}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Links Box */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#EEEBFB] text-[#5B49D6]">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-[#1B2236]">HireFlow Reusable Design System</div>
              <div className="text-[11px] text-[#6B7490]">Preview all 13 component sections built from Figma</div>
            </div>
          </div>
          <Link
            href="/design"
            className="px-4 py-2 bg-[#F6F7FB] border border-[#E6E8F0] hover:bg-[#EEEBFB] hover:text-[#5B49D6] rounded-lg text-xs font-semibold text-[#1B2236] transition-colors flex items-center gap-1.5"
          >
            <span>Open /design Showcase</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
