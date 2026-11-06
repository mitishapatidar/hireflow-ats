'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useDevUser } from '../../../context/DevUserContext';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ClientPortalOverviewPage() {
  const { currentUser } = useDevUser();

  return (
    <div>
      <PageHeader
        title={`Welcome, ${currentUser.name}`}
        subtitle={`Client Portal for ${currentUser.workspace} — Track candidate submissions and interview schedules.`}
        breadcrumbs={[{ label: 'Client Portal' }]}
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Open Requisitions</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">6 Active</div>
          <div className="text-xs text-[#5B49D6] mt-1 font-semibold">2 new mandates added this month</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Profiles Pending Your Review</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">4 Profiles</div>
          <div className="text-xs text-[#F59E0B] mt-1 font-semibold">Awaiting client decision</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Scheduled Interviews</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">3 Upcoming</div>
          <div className="text-xs text-[#12B76A] mt-1 font-semibold">Next round today at 2:30 PM</div>
        </div>
      </div>

      {/* Quick Action Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs">
          <h3 className="font-bold text-base text-[#1B2236] mb-2">Review Submitted Profiles</h3>
          <p className="text-xs text-[#6B7490] mb-4 leading-relaxed">
            Standardized profiles submitted by your dedicated HireFlow talent team. Approve or reject candidates with feedback.
          </p>
          <Link
            href="/submitted-profiles"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-colors"
          >
            <span>View 4 Pending Profiles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs">
          <h3 className="font-bold text-base text-[#1B2236] mb-2">Your Open Job Orders</h3>
          <p className="text-xs text-[#6B7490] mb-4 leading-relaxed">
            Monitor hiring velocity, job specifications, and applicant volume across each engineering mandate.
          </p>
          <Link
            href="/positions"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F6F7FB] border border-[#E6E8F0] text-[#1B2236] hover:bg-[#EEEBFB] hover:text-[#5B49D6] rounded-lg text-xs font-semibold transition-colors"
          >
            <span>Explore Open Mandates</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Direct client feedback submission & candidate shortlisting will be active in Phase 1 (Prompt 8).
      </div>
    </div>
  );
}
