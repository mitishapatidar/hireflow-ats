'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useDevUser } from '../../../context/DevUserContext';
import Link from 'next/link';

export default function CandidateDashboardPage() {
  const { currentUser } = useDevUser();

  return (
    <div>
      <PageHeader
        title={`Hi, ${currentUser.name}`}
        subtitle="Track your active job applications, upcoming interview schedules, and recruiter messages."
        breadcrumbs={[{ label: 'Candidate Portal' }]}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Active Applications</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">2 Jobs</div>
          <div className="text-xs text-[#5B49D6] mt-1 font-semibold">1 under client review</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Upcoming Interviews</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">1 Scheduled</div>
          <div className="text-xs text-[#12B76A] mt-1 font-semibold">Tomorrow at 11:00 AM</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Profile Completeness</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">95%</div>
          <div className="text-xs text-[#12B76A] mt-1 font-semibold">Resume parsed & verified</div>
        </div>
      </div>

      {/* Current Applications Status List */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs mb-6">
        <h3 className="font-bold text-base text-[#1B2236] mb-4">Application Progress</h3>

        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#1B2236]">Staff Frontend Engineer</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                  Interview Round 2
                </span>
              </div>
              <div className="text-xs text-[#6B7490] mt-1">Acme Corporation • Bengaluru (Hybrid)</div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/my-interviews"
                className="px-3.5 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-colors shadow-xs"
              >
                View Interview Details
              </Link>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#1B2236]">Engineering Lead - Core Platform</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E5F0FF] text-[#3B82F6]">
                  Profile Under Review
                </span>
              </div>
              <div className="text-xs text-[#6B7490] mt-1">Starlight Tech • Remote</div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B7490]">Awaiting hiring manager feedback</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Direct slot self-scheduling & interview link access will be functional in Phase 3.
      </div>
    </div>
  );
}
